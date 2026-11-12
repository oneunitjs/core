import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHealthProvider, fastifyHealth } from "../../../src/index.js";
import Fastify from "fastify";

describe("fastifyHealth", () => {
    let fastify: any;
    let port: number;

    beforeAll(async () => {
        fastify = Fastify();
        const health = fastifyHealth(fastify, { path: "/health", serviceName: "api" });
        health.registry.register(createHealthProvider("db", async () => ({ status: "healthy" }), true));

        await fastify.ready();
        const address = await new Promise<string>((resolve) => {
            fastify.server.listen(0, () => resolve(""));
        });
        port = (fastify.server.address() as any).port;
    });

    afterAll(async () => {
        await fastify.close();
    });

    it("responds 200 with healthy status", async () => {
        const res = await fastify.inject({ method: "GET", url: "/health" });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.service).toBe("api");
        expect(body.status).toBe("healthy");
    });

    it("responds 503 when critical check fails", async () => {
        const fastify2 = Fastify();
        const health2 = fastifyHealth(fastify2, { path: "/health" });
        health2.registry.register(createHealthProvider("db", async () => ({ status: "unhealthy" }), true));

        await fastify2.ready();
        await new Promise<void>((resolve) => fastify2.server.listen(0, resolve));
        const port2 = (fastify2.server.address() as any).port;

        const res = await fastify2.inject({ method: "GET", url: "/health" });
        expect(res.statusCode).toBe(503);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe("unhealthy");

        await fastify2.close();
    });
});
