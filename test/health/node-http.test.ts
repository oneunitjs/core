import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
    createHealthProvider,
    createHealthRegistry,
    createHealthRoute,
    registerHealth,
} from "../../src/index.js";
import http from "node:http";

type HealthReply = { status: (code: number) => HealthReply; send: (body: unknown) => void };

describe("health with node:http (framework-agnostic)", () => {
    it("registers routes via createHealthRoute on raw node:http", async () => {
        const registry = createHealthRegistry();
        registry.register(createHealthProvider("db", async () => ({ status: "healthy" }), true));

        const handlers: Record<string, any> = {};
        const healthServer = {
            get: (path: string, handler: any) => { handlers[path] = handler; },
            decorate: () => { },
        };

        await createHealthRoute(registry, { serviceName: "api" })(healthServer);

        const server = http.createServer(async (req, res) => {
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

        await new Promise<void>((resolve) => server.listen(0, resolve));
        const port = (server.address() as any).port;

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

        server.close();

        expect(res.statusCode).toBe(200);
        expect(res.body.service).toBe("api");
        expect(res.body.status).toBe("healthy");
    });

    it("responds 503 when critical provider is unhealthy", async () => {
        const registry = createHealthRegistry();
        registry.register(createHealthProvider("db", async () => ({ status: "unhealthy" }), true));

        const handlers: Record<string, any> = {};
        const healthServer = {
            get: (path: string, handler: any) => { handlers[path] = handler; },
            decorate: () => { },
        };

        await createHealthRoute(registry, { path: "/health" })(healthServer);

        const server = http.createServer(async (req, res) => {
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

        await new Promise<void>((resolve) => server.listen(0, resolve));
        const port = (server.address() as any).port;

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

        server.close();

        expect(res.statusCode).toBe(503);
        expect(res.body.status).toBe("unhealthy");
    });

    it("registerHealth one-liner works on raw node:http", async () => {
        const handlers: Record<string, any> = {};
        const healthServer = {
            get: (path: string, handler: any) => { handlers[path] = handler; },
            decorate: () => { },
        };

        const health = registerHealth(healthServer, { serviceName: "raw" });
        health.registry.register(createHealthProvider("cache", async () => ({ status: "healthy" })));

        const server = http.createServer(async (req, res) => {
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

        await new Promise<void>((resolve) => server.listen(0, resolve));
        const port = (server.address() as any).port;

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

        server.close();

        expect(res.statusCode).toBe(200);
        expect(res.body.service).toBe("raw");
        expect(res.body.status).toBe("healthy");
    });
});
