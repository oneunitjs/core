import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../../src/core/index.js";
import Koa from "koa";
import http from "node:http";

describe("Lifecycle - Koa real server", () => {
    let app: Koa;
    let server: http.Server;
    let port: number;
    let core: ReturnType<typeof createApp>;

    beforeAll(async () => {
        app = new Koa();

        core = createApp({ serviceName: "lifecycle-koa", secret: "my-secret" });

        core.lifecycle().initialize();

        core.lifecycle().registerMiddleware("cors-mw", "cors", (_req, res: any, next) => {
            res.setHeader("Access-Control-Allow-Origin", "*");
            next();
        });

        core.lifecycle().registerMiddleware("logging-mw", "logging", async (_req, _res: any, next) => {
            next();
        });

        app.use(async (ctx) => {
            await core.lifecycle().executeMiddlewareChain(ctx.req, ctx.res, "request");
            ctx.body = { status: "ok" };
            ctx.set("Access-Control-Allow-Origin", "*");
        });

        server = http.createServer(app.callback());
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

    it("executes middleware chain via koa", async () => {
        const res = await request("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("ok");
    });

    it("cors middleware sets header via koa", async () => {
        const res = await request("/health");
        expect(res.statusCode).toBe(200);
    });

    it("lifecycle is safe after registration", () => {
        expect(core.lifecycle().isSafe()).toBe(true);
    });

    it("getState reports middleware count", () => {
        const state = core.lifecycle().getState();
        expect(state.middlewareCount).toBe(2);
    });
});
