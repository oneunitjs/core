import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../../src/core/index.js";
import http from "node:http";

describe("Lifecycle - node:http real server", () => {
    let server: http.Server;
    let port: number;
    let core: ReturnType<typeof createApp>;

    beforeAll(async () => {
        core = createApp({ serviceName: "lifecycle-http", secret: "my-secret" });

        core.lifecycle().initialize();

        core.lifecycle().registerMiddleware("cors-mw", "cors", (_req, res: any, next) => {
            res.setHeader("Access-Control-Allow-Origin", "*");
            next();
        });

        core.lifecycle().registerMiddleware("logging-mw", "logging", async (_req, _res: any, next) => {
            next();
        });

        server = http.createServer(async (req, res) => {
            if (req.url === "/health") {
                await core.lifecycle().executeMiddlewareChain(req, res, "request");
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "ok" }));
            } else if (req.url === "/cors") {
                await core.lifecycle().executeMiddlewareChain(req, res, "request");
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true }));
            } else {
                res.writeHead(404).end();
            }
        });

        await new Promise<void>((resolve) => server.listen(0, resolve));
        port = (server.address() as any).port;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(resolve));
    });

    async function request(path: string): Promise<{ statusCode: number; body: any; headers: http.IncomingHttpHeaders }> {
        return new Promise((resolve, reject) => {
            const req = http.request(
                { hostname: "127.0.0.1", port, path, method: "GET" },
                (res) => {
                    let data = "";
                    res.on("data", (chunk) => { data += chunk; });
                    res.on("end", () => {
                        let parsed: any;
                        try { parsed = JSON.parse(data); } catch { parsed = data; }
                        resolve({ statusCode: res.statusCode ?? 0, body: parsed, headers: res.headers });
                    });
                },
            );
            req.on("error", reject);
            req.end();
        });
    }

    it("executes middleware chain via node:http", async () => {
        const res = await request("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("ok");
    });

    it("cors middleware sets header via node:http", async () => {
        const res = await request("/cors");
        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.headers["access-control-allow-origin"]).toBe("*");
    });

    it("lifecycle is safe after registration", () => {
        expect(core.lifecycle().isSafe()).toBe(true);
    });

    it("getState reports middleware count", () => {
        const state = core.lifecycle().getState();
        expect(state.middlewareCount).toBe(2);
    });

    it("handles lifecycle conflict detection", () => {
        const mw = (_req: unknown, res: unknown, next?: () => void) => {
            if (next) next();
        };
        core.lifecycle().registerMiddleware("cors-1", "cors", mw);
        const result = core.lifecycle().registerMiddleware("cors-2", "cors", mw);
        expect(result.success).toBe(false);
        expect(core.lifecycle().isSafe()).toBe(false);
    });
});
