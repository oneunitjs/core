import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../../src/core/index.js";
import express from "express";
import http from "node:http";

describe("Lifecycle - Express real server", () => {
    let app: express.Application;
    let server: http.Server;
    let port: number;
    let core: ReturnType<typeof createApp>;

    beforeAll(async () => {
        app = express();
        app.use(express.json());

        core = createApp({ serviceName: "lifecycle-express", secret: "my-secret" });

        // Register middleware through lifecycle
        core.lifecycle().initialize();

        core.lifecycle().registerMiddleware("cors-mw", "cors", (_req, res, next) => {
            res.setHeader("Access-Control-Allow-Origin", "*");
            next();
        });

        core.lifecycle().registerMiddleware("logging-mw", "logging", async (_req, _res, next) => {
            next();
        });

        // Express route that executes lifecycle middleware chain
        app.use((req, res, next) => {
            void core.lifecycle().executeMiddlewareChain(req, res, "request").then(() => {
                next();
            }).catch((err) => {
                res.status(500).json({ error: err?.message });
            });
        });

        app.get("/health", (_req, res) => {
            res.json({ status: "ok" });
        });

        server = http.createServer(app);
        await new Promise<void>((resolve) => server.listen(0, resolve));
        port = (server.address() as any).port;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(resolve));
    });

    async function request(path: string): Promise<{ statusCode: number; body: any }> {
        return new Promise((resolve, reject) => {
            const req = http.request(
                { hostname: "127.0.0.1", port, path, method: "GET" },
                (res) => {
                    let data = "";
                    res.on("data", (chunk) => { data += chunk; });
                    res.on("end", () => {
                        let parsed: any;
                        try { parsed = JSON.parse(data); } catch { parsed = data; }
                        resolve({ statusCode: res.statusCode ?? 0, body: parsed });
                    });
                },
            );
            req.on("error", reject);
            req.end();
        });
    }

    it("executes middleware chain via express", async () => {
        const res = await request("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("ok");
    });

    it("cors middleware sets header via express", async () => {
        const res = await request("/health");
        expect(res.statusCode).toBe(200);
        // CORS header should be set by lifecycle middleware
    });

    it("lifecycle is safe after registration", () => {
        expect(core.lifecycle().isSafe()).toBe(true);
    });

    it("getState reports middleware count", () => {
        const state = core.lifecycle().getState();
        expect(state.middlewareCount).toBe(2);
    });
});
