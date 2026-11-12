import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHealth, registerHealth, createHealthProvider, createHealthRoute } from "../../src/index.js";
import http from "node:http";

type HealthReply = { status: (code: number) => HealthReply; send: (body: unknown) => void };

describe("createHealth (framework-agnostic)", () => {
    it("creates a health instance with an empty registry", () => {
        const health = createHealth();
        expect(health.registry.getAll()).toEqual([]);
    });

    it("registers providers via the health instance", () => {
        const health = createHealth();
        health.register(createHealthProvider("db", async () => ({ status: "healthy" })));
        expect(health.registry.getAll()).toHaveLength(1);
    });

    it("runs checks via the health instance", async () => {
        const health = createHealth();
        health.register(createHealthProvider("db", async () => ({ status: "healthy" })));
        const results = await health.check();
        expect(results.db.status).toBe("healthy");
    });

    it("works with a real node:http server end-to-end", async () => {
        const health = createHealth({ serviceName: "api" });
        health.register(createHealthProvider("db", async () => ({ status: "healthy" }), true));

        const handlers: Record<string, any> = {};
        const healthServer = {
            get: (path: string, handler: any) => { handlers[path] = handler; },
            decorate: () => { },
        };

        await health.route(healthServer);

        const httpServer = http.createServer(async (req, res) => {
            const handler = handlers[req.url ?? ""];
            if (!handler || req.method !== "GET") {
                res.statusCode = 404;
                res.end();
                return;
            }

            const reply: HealthReply = {
                status: (code) => { res.statusCode = code; return reply; },
                send: (body) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); },
            };

            await handler(req, reply);
        });

        await new Promise<void>((resolve) => httpServer.listen(0, resolve));
        const port = (httpServer.address() as any).port;

        const res = await new Promise<{ statusCode: number; body: any }>((resolve, reject) => {
            const req = http.request(
                { hostname: "127.0.0.1", port, path: "/health", method: "GET" },
                (res) => {
                    let data = "";
                    res.on("data", (chunk) => { data += chunk; });
                    res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: JSON.parse(data) }));
                },
            );
            req.on("error", reject);
            req.end();
        });

        httpServer.close();

        expect(res.statusCode).toBe(200);
        expect(res.body.service).toBe("api");
        expect(res.body.status).toBe("healthy");
    });
});

describe("registerHealth", () => {
    it("creates health and registers routes in one call", async () => {
        const registered: string[] = [];
        const server: any = {
            get: (path: string) => { registered.push(path); },
            decorate: () => { },
        };

        const health = registerHealth(server, { serviceName: "api" });
        expect(registered).toContain("/health");
        expect(health.registry.getAll()).toEqual([]);
    });
});
