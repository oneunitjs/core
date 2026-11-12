import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { connect } from "node:net";
import https from "node:https";

const execFileAsync = promisify(execFile);

const KUBECTL_TIMEOUT_MS = 5000;

async function tryKubectl(timeoutMs: number = KUBECTL_TIMEOUT_MS): Promise<{
    ok: boolean;
    version?: string;
    context?: string;
    error?: string;
}> {
    try {
        const [{ stdout: version }, { stdout: context }] = await Promise.all([
            execFileAsync("kubectl", ["version", "--client", "--short", "--output=text"], {
                timeout: timeoutMs,
                maxBuffer: 1024 * 1024,
            }),
            execFileAsync("kubectl", ["config", "current-context"], {
                timeout: timeoutMs,
                maxBuffer: 1024 * 1024,
            }),
        ]);

        return {
            ok: true,
            version: version.trim() || undefined,
            context: context.trim() || undefined,
        };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

async function tryK8sAPI(timeoutMs: number = KUBECTL_TIMEOUT_MS): Promise<{
    ok: boolean;
    error?: string;
}> {
    const k8sHost = process.env["KUBERNETES_SERVICE_HOST"];
    const k8sPort = process.env["KUBERNETES_SERVICE_PORT"];
    const tokenPath = "/var/run/secrets/kubernetes.io/serviceaccount/token";
    const caPath = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt";

    if (!k8sHost || !k8sPort) {
        return { ok: false, error: "no in-cluster K8s env vars" };
    }

    try {
        let token: string | undefined;
        try {
            const fs = await import("node:fs/promises");
            token = await fs.readFile(tokenPath, "utf8");
        } catch {
            token = undefined;
        }

        const url = `https://${k8sHost}:${k8sPort}/version`;

        return new Promise<{ ok: boolean; error?: string }>((resolve) => {
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                resolve({ ok: false, error: "timeout" });
            }, timeoutMs);

            const req = createServer(() => {}).listen(0);
            req.close();

            const options: any = {
                method: "GET",
                hostname: k8sHost,
                port: Number(k8sPort),
                path: "/version",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                timeout: timeoutMs,
                rejectUnauthorized: false,
            };

            const request = https.request(options, (res) => {
                if (!timedOut) {
                    clearTimeout(timer);
                    resolve({ ok: res.statusCode !== undefined && res.statusCode < 500 });
                }
            });

            request.on("error", (err) => {
                if (!timedOut) {
                    clearTimeout(timer);
                    resolve({ ok: false, error: err.message });
                }
            });

            request.on("timeout", () => {
                if (!timedOut) {
                    timedOut = true;
                    request.destroy();
                }
            });

            request.end();
        });
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export async function pingKubernetes(timeoutMs: number = KUBECTL_TIMEOUT_MS): Promise<{
    ok: boolean;
    version?: string;
    context?: string;
    error?: string;
    source?: "kubectl" | "in-cluster";
}> {
    const kubectlResult = await tryKubectl(timeoutMs);
    if (kubectlResult.ok) {
        return { ok: true, version: kubectlResult.version, context: kubectlResult.context, source: "kubectl" };
    }

    const apiResult = await tryK8sAPI(timeoutMs);
    if (apiResult.ok) {
        return { ok: true, source: "in-cluster" };
    }

    return {
        ok: false,
        error: kubectlResult.error || apiResult.error || "kubernetes unreachable",
    };
}

export interface K8sPodInfo {
    name: string;
    namespace: string;
    status: string;
    ready: string;
    restarts: number;
}

export async function listK8sPods(timeoutMs: number = KUBECTL_TIMEOUT_MS): Promise<{
    ok: boolean;
    pods: K8sPodInfo[];
    error?: string;
}> {
    try {
        const { stdout } = await execFileAsync("kubectl", ["get", "pods", "--all-namespaces", "--output=wide"], {
            timeout: timeoutMs,
            maxBuffer: 1024 * 1024,
        });

        const lines = stdout.trim().split("\n");
        const pods: K8sPodInfo[] = [];

        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(/\s+/);
            if (parts.length < 5) continue;
            pods.push({
                name: parts[0] ?? "",
                namespace: parts[1] ?? "",
                status: parts[2] ?? "",
                ready: parts[3] ?? "",
                restarts: Number(parts[4] ?? 0) || 0,
            });
        }

        return { ok: true, pods };
    } catch (err) {
        return {
            ok: false,
            pods: [],
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
