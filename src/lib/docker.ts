import { createServer } from "node:http";
import { connect } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DOCKER_SOCKET_PATH = "/var/run/docker.sock";

function pingDockerSocket(timeoutMs: number = 3000): Promise<{ ok: boolean; version?: string; error?: string }> {
    return new Promise((resolve) => {
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            resolve({ ok: false, error: "timeout" });
        }, timeoutMs);

        const socket = connect(DOCKER_SOCKET_PATH);

        socket.on("connect", () => {
            socket.write(
                "GET /_ping HTTP/1.1\r\n" +
                "Host: docker\r\n" +
                "Connection: close\r\n" +
                "\r\n",
            );
        });

        socket.on("data", (data) => {
            const text = data.toString();
            const ok = text.includes("HTTP/1.1 200");
            const versionMatch = text.match(/Docker-Version:\s*([^\r\n]+)/i);
            resolve({ ok, version: versionMatch ? versionMatch[1].trim() : undefined });
            socket.destroy();
        });

        socket.on("error", (err) => {
            if (!timedOut) {
                resolve({ ok: false, error: err.message });
            }
        });

        socket.on("timeout", () => {
            if (!timedOut) {
                timedOut = true;
                socket.destroy();
            }
        });
    });
}

function pingDockerCli(timeoutMs: number = 3000): Promise<{ ok: boolean; version?: string; error?: string }> {
    return execFileAsync("docker", ["version", "--format", "{{.Server.Version}}"], {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
    })
        .then(({ stdout }) => {
            const version = stdout.trim();
            return { ok: true, version: version || undefined };
        })
        .catch((err) => {
            return { ok: false, error: err.stderr?.toString() || err.message };
        });
}

export async function pingDocker(timeoutMs: number = 3000): Promise<{
    ok: boolean;
    version?: string;
    error?: string;
    source?: "socket" | "cli";
}> {
    const socketResult = await pingDockerSocket(timeoutMs);
    if (socketResult.ok) {
        return { ok: true, version: socketResult.version, source: "socket" };
    }

    const cliResult = await pingDockerCli(timeoutMs);
    if (cliResult.ok) {
        return { ok: true, version: cliResult.version, source: "cli" };
    }

    return {
        ok: false,
        error: socketResult.error || cliResult.error || "docker unreachable",
    };
}

export interface DockerContainerInfo {
    id: string;
    names: string[];
    status: string;
    state: string;
    health?: string;
}

export async function listDockerContainers(timeoutMs: number = 3000): Promise<{
    ok: boolean;
    containers: DockerContainerInfo[];
    error?: string;
}> {
    try {
        const { stdout } = await execFileAsync("docker", ["ps", "--format", "{{.ID}}|{{.Names}}|{{.Status}}|{{.State}}|{{.Health}}"], {
            timeout: timeoutMs,
            maxBuffer: 1024 * 1024,
        });

        const containers: DockerContainerInfo[] = [];
        for (const line of stdout.trim().split("\n")) {
            if (!line) continue;
            const [id, names, status, state, health] = line.split("|");
            containers.push({
                id: id ?? "",
                names: names ? [names] : [],
                status: status ?? "",
                state: state ?? "",
                health: health || undefined,
            });
        }

        return { ok: true, containers };
    } catch (err) {
        return {
            ok: false,
            containers: [],
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
