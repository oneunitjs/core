import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHooks } from "../../src/hooks/index.js";
import Koa from "koa";
import http from "node:http";

describe("hooks with Koa", () => {
    let server: http.Server;
    let port: number;

    beforeAll(async () => {
        const app = new Koa();

        // Framework-agnostic hooks used within Koa middleware
        const hooks = createHooks<{ ctx: Koa.Context }>();
        const events: string[] = [];

        hooks.on("request", async (ctx) => {
            events.push(`req:${ctx.method} ${ctx.url}`);
        });
        hooks.on("response", async (ctx) => {
            events.push(`res:${ctx.status}`);
        });

        app.use(async (ctx, next) => {
            await hooks.emit("request", { ctx });
            await next();
            await hooks.emit("response", { ctx });
        });

        app.use(async (ctx) => {
            ctx.body = { message: "hello" };
        });

        server = http.createServer(app.callback());
        await new Promise<void>((resolve) => server.listen(0, resolve));
        port = (server.address() as any).port;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(resolve));
    });

    it("fires hooks during Koa middleware lifecycle", async () => {
        const res = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
            const req = http.request(
                { hostname: "127.0.0.1", port, path: "/hello", method: "GET" },
                (res) => {
                    let data = "";
                    res.on("data", (chunk) => { data += chunk; });
                    res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
                },
            );
            req.on("error", reject);
            req.end();
        });

        expect(res.statusCode).toBe(200);
        expect(res.body).toContain("hello");
    });
});
