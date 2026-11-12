import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
    createHealthRegistry,
    createHealthProvider,
    createDatabaseHealthProvider,
    createRedisHealthProvider,
    createKafkaHealthProvider,
    expressHealth,
    fastifyHealth,
    koaHealth,
} from "../../src/health/index.js";
import express from "express";
import Fastify from "fastify";
import Koa from "koa";
import http from "node:http";

describe("Health Registry - Express Real Server", () => {
    let app: express.Application;
    let server: http.Server;
    let port: number;

    beforeAll(async () => {
        app = express();
        app.use(express.json());

        const health = expressHealth(app, { serviceName: "test-service" });
        health.register(createHealthProvider("db", async () => ({ status: "healthy" })));

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

    it("registers and serves health check via express server", async () => {
        const res = await request("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("healthy");
        expect(res.body.service).toBe("test-service");
    });
});

describe("Health Registry - Fastify Real Server", () => {
    let fastify: Fastify.FastifyInstance;
    let port: number;

    beforeAll(async () => {
        fastify = Fastify();
        const health = fastifyHealth(fastify, { serviceName: "test-service" });
        health.register(createHealthProvider("db", async () => ({ status: "healthy" })));

        await fastify.ready();
        await new Promise<void>((resolve) => fastify.server.listen(0, resolve));
        port = (fastify.server.address() as any).port;
    });

    afterAll(async () => {
        await fastify.close();
    });

    async function request(path: string): Promise<{ statusCode: number; body: any }> {
        return fastify.inject({ method: "GET", url: path }).then((res) => ({
            statusCode: res.statusCode,
            body: JSON.parse(res.payload),
        }));
    }

    it("registers and serves health check via fastify server", async () => {
        const res = await request("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("healthy");
    });
});

describe("Health Registry - Koa Real Server", () => {
    let app: Koa;
    let server: http.Server;
    let port: number;

    beforeAll(async () => {
        app = new Koa();
        const health = koaHealth(app, { serviceName: "test-service" });
        health.register(createHealthProvider("db", async () => ({ status: "healthy" })));

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

    it("registers and serves health check via koa server", async () => {
        const res = await request("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("healthy");
    });
});

describe("Health Providers - Real Framework Integration", () => {
    it("database provider reports healthy", async () => {
        const provider = createDatabaseHealthProvider(async () => undefined);
        const result = await provider.check();
        expect(result.status).toBe("healthy");
    });

    it("redis provider reports healthy", async () => {
        const provider = createRedisHealthProvider(async () => undefined);
        const result = await provider.check();
        expect(result.status).toBe("healthy");
    });

    it("kafka provider reports healthy", async () => {
        const provider = createKafkaHealthProvider(async () => undefined);
        const result = await provider.check();
        expect(result.status).toBe("healthy");
    });

    it("database provider reports unhealthy on failure", async () => {
        const provider = createDatabaseHealthProvider(async () => {
            throw new Error("connection refused");
        }, true);
        const result = await provider.check();
        expect(result.status).toBe("unhealthy");
        expect(result.message).toBe("connection refused");
    });

    it("critical provider marks overall as unhealthy", async () => {
        const registry = createHealthRegistry();
        registry.register(createDatabaseHealthProvider(async () => {
            throw new Error("db down");
        }, true));
        registry.register(createRedisHealthProvider(async () => ({ status: "healthy" }), false));

        const results = await registry.checkAll();
        expect(results.database.status).toBe("unhealthy");
        expect(results.database.message).toBe("db down");
        expect(results.redis.status).toBe("healthy");
    });

    it("non-critical unhealthy does not affect overall", async () => {
        const registry = createHealthRegistry();
        registry.register(createDatabaseHealthProvider(async () => ({ status: "healthy" }), false));
        registry.register(createRedisHealthProvider(async () => {
            throw new Error("redis down");
        }, false));

        const results = await registry.checkAll();
        expect(results.database.status).toBe("healthy");
        expect(results.redis.status).toBe("unhealthy");
    });
});
