import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHealthProvider, koaHealth } from "../../../src/index.js";
import Koa from "koa";
import http from "node:http";

describe("koaHealth", () => {
    let server: http.Server;
    let port: number;

    beforeAll(async () => {
        const app = new Koa();
        const health = koaHealth(app, { path: "/health", serviceName: "api" });
        health.registry.register(createHealthProvider("db", async () => ({ status: "healthy" }), true));

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
                        resolve({ statusCode: res.statusCode ?? 0, body: JSON.parse(data) });
                    });
                },
            );
            req.on("error", reject);
            req.end();
        });
    }

    it("responds 200 with healthy status", async () => {
        const res = await request("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.service).toBe("api");
        expect(res.body.status).toBe("healthy");
    });

    it("passes through to next middleware for non-matching paths", async () => {
        const app2 = new Koa();
        const health2 = koaHealth(app2, { path: "/health" });
        health2.registry.register(createHealthProvider("db", async () => ({ status: "healthy" })));

        let nextCalled = false;
        app2.use(async (_ctx, next) => {
            await next();
            nextCalled = true;
        });

        const server2 = http.createServer(app2.callback());
        await new Promise<void>((resolve) => server2.listen(0, resolve));
        const port2 = (server2.address() as any).port;

        const res = await new Promise<{ statusCode: number }>((resolve, reject) => {
            const req = http.request(
                { hostname: "127.0.0.1", port: port2, path: "/other", method: "GET" },
                (res) => {
                    let data = "";
                    res.on("data", (chunk) => { data += chunk; });
                    res.on("end", () => resolve({ statusCode: res.statusCode ?? 0 }));
                },
            );
            req.on("error", reject);
            req.end();
        });

        await new Promise<void>((resolve) => server2.close(resolve));
        expect(nextCalled).toBe(true);
    });
});
