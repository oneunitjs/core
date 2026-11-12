import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHooks } from "../../src/hooks/index.js";
import express from "express";
import http from "node:http";

describe("hooks with Express", () => {
    let server: http.Server;
    let port: number;

    beforeAll(async () => {
        const app = express();

        // Framework-agnostic hooks used within Express middleware
        const hooks = createHooks<{ req: express.Request; res: express.Response }>();
        const events: string[] = [];

        hooks.on("request", async (ctx) => {
            events.push(`req:${ctx.req.method} ${ctx.req.url}`);
        });
        hooks.on("response", async (ctx) => {
            events.push(`res:${ctx.res.statusCode}`);
        });

        app.use(async (req, res, next) => {
            await hooks.emit("request", { req, res });
            next();
        });

        app.get("/hello", (_req, res) => {
            res.json({ message: "hello" });
        });

        app.use(async (_req, res) => {
            await hooks.emit("response", { req: _req, res });
        });

        server = http.createServer(app);
        await new Promise<void>((resolve) => server.listen(0, resolve));
        port = (server.address() as any).port;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(resolve));
    });

    it("fires hooks during request/response lifecycle", async () => {
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
