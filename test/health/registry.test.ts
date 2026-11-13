import { describe, it, expect } from "vitest";
import { createHealthRegistry } from "../../src/health/registry.js";
import { createHealthRoute } from "../../src/health/route.js";

describe("Health Registry - Registration", () => {
    it("should register a health provider", async () => {
        const registry = createHealthRegistry();
        registry.register({ name: "db", check: async () => ({ status: "healthy" }) });
        const result = await registry.checkAll();
        expect(result.db.status).toBe("healthy");
    });

    it("should register multiple providers", async () => {
        const registry = createHealthRegistry();
        registry.register({ name: "db", check: async () => ({ status: "healthy" }) });
        registry.register({ name: "cache", check: async () => ({ status: "degraded" }) });
        const results = await registry.checkAll();
        expect(results.db.status).toBe("healthy");
        expect(results.cache.status).toBe("degraded");
    });

    it("should unregister a provider", async () => {
        const registry = createHealthRegistry();
        registry.register({ name: "db", check: async () => ({ status: "healthy" }) });
        registry.unregister("db");
        const results = await registry.checkAll();
        expect(results.db).toBeUndefined();
    });

    it("should handle provider that throws", async () => {
        const registry = createHealthRegistry();
        registry.register({ name: "failing", check: async () => { throw new Error("connection failed"); } });
        const results = await registry.checkAll();
        expect(results.failing.status).toBe("unhealthy");
        expect(results.failing.message).toContain("connection failed");
    });

    it("should run checks in parallel", async () => {
        const registry = createHealthRegistry();
        let fastCompleted = false;
        let slowCompleted = false;
        registry.register({ name: "fast", check: async () => { await new Promise((r) => setTimeout(r, 10)); fastCompleted = true; return { status: "healthy" }; } });
        registry.register({ name: "slow", check: async () => { await new Promise((r) => setTimeout(r, 100)); slowCompleted = true; return { status: "healthy" }; } });
        const start = Date.now();
        await registry.checkAll();
        const duration = Date.now() - start;
        expect(fastCompleted).toBe(true);
        expect(slowCompleted).toBe(true);
        expect(duration).toBeLessThan(200);
    });
});

describe("Health Status Aggregation", () => {
    it("should return healthy when all checks are healthy", async () => {
        const registry = createHealthRegistry();
        registry.register({ name: "db", check: async () => ({ status: "healthy" }) });
        registry.register({ name: "cache", check: async () => ({ status: "healthy" }) });
        const results = await registry.checkAll();
        const hasUnhealthy = Object.values(results).some((r) => r.status === "unhealthy");
        const hasDegraded = Object.values(results).some((r) => r.status === "degraded");
        expect(hasUnhealthy).toBe(false);
        expect(hasDegraded).toBe(false);
    });

    it("should return degraded when any check is degraded", async () => {
        const registry = createHealthRegistry();
        registry.register({ name: "db", check: async () => ({ status: "healthy" }) });
        registry.register({ name: "cache", check: async () => ({ status: "degraded" }) });
        const results = await registry.checkAll();
        const hasUnhealthy = Object.values(results).some((r) => r.status === "unhealthy");
        const hasDegraded = Object.values(results).some((r) => r.status === "degraded");
        expect(hasUnhealthy).toBe(false);
        expect(hasDegraded).toBe(true);
    });

    it("should return unhealthy when any check is unhealthy", async () => {
        const registry = createHealthRegistry();
        registry.register({ name: "db", check: async () => ({ status: "healthy" }) });
        registry.register({ name: "api", check: async () => ({ status: "unhealthy" }) });
        const results = await registry.checkAll();
        const hasUnhealthy = Object.values(results).some((r) => r.status === "unhealthy");
        expect(hasUnhealthy).toBe(true);
    });
});

describe("Health Route - Express Adapter", () => {
    it("should register health route on express server", async () => {
        const registry = createHealthRegistry();
        registry.register({ name: "db", check: async () => ({ status: "healthy" }) });
        const route = createHealthRoute(registry, { path: "/health", serviceName: "test" });
        const server: any = { get: (path: string, handler: any) => { server._handlers = server._handlers || {}; server._handlers[path] = handler; }, decorate: (name: string, value: unknown) => { server[name] = value; } };
        route(server);
        const reply: any = { status: (code: number) => { reply.statusCode = code; return reply; }, send: (body: unknown) => { reply.body = body; } };
        await server._handlers["/health"]({}, reply);
        expect(reply.statusCode).toBe(200);
        expect(reply.body.status).toBe("healthy");
        expect(reply.body.service).toBe("test");
    });

    it("should return 503 when service is unhealthy", async () => {
        const registry = createHealthRegistry();
        registry.register({ name: "db", check: async () => ({ status: "unhealthy" }) });
        const route = createHealthRoute(registry, { path: "/health" });
        const server: any = { get: (path: string, handler: any) => { server._handlers = server._handlers || {}; server._handlers[path] = handler; }, decorate: () => {} };
        route(server);
        const reply: any = { status: (code: number) => { reply.statusCode = code; return reply; }, send: (body: unknown) => { reply.body = body; } };
        await server._handlers["/health"]({}, reply);
        expect(reply.statusCode).toBe(503);
        expect(reply.body.status).toBe("unhealthy");
    });

    it("should register /health/details route when includeDetails is true", async () => {
        const registry = createHealthRegistry();
        registry.register({ name: "db", check: async () => ({ status: "healthy", latency: 42 }) });
        const route = createHealthRoute(registry, { path: "/health", includeDetails: true });
        const server: any = { _handlers: {}, get: (path: string, handler: any) => { server._handlers[path] = handler; }, decorate: () => {} };
        route(server);
        expect(server._handlers["/health/details"]).toBeDefined();
    });

    it("should not register /health/details route when includeDetails is false", async () => {
        const registry = createHealthRegistry();
        const route = createHealthRoute(registry, { path: "/health", includeDetails: false });
        const server: any = { _handlers: {}, get: (path: string, handler: any) => { server._handlers[path] = handler; }, decorate: () => {} };
        route(server);
        expect(server._handlers["/health/details"]).toBeUndefined();
    });
});

describe("Health Route - Status Aggregation", () => {
    it("should aggregate status as healthy when all are healthy", async () => {
        const registry = createHealthRegistry();
        registry.register({ name: "db", check: async () => ({ status: "healthy" }) });
        registry.register({ name: "cache", check: async () => ({ status: "healthy" }) });
        const results = await registry.checkAll();
        const resultsArray = Object.entries(results);
        const hasUnhealthy = resultsArray.some(([, r]) => r.status === "unhealthy");
        const hasDegraded = resultsArray.some(([, r]) => r.status === "degraded");
        let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
        if (hasUnhealthy) overallStatus = "unhealthy";
        else if (hasDegraded) overallStatus = "degraded";
        expect(overallStatus).toBe("healthy");
    });

    it("should aggregate status as degraded when any is degraded", async () => {
        const registry = createHealthRegistry();
        registry.register({ name: "db", check: async () => ({ status: "healthy" }) });
        registry.register({ name: "cache", check: async () => ({ status: "degraded" }) });
        const results = await registry.checkAll();
        const resultsArray = Object.entries(results);
        const hasUnhealthy = resultsArray.some(([, r]) => r.status === "unhealthy");
        const hasDegraded = resultsArray.some(([, r]) => r.status === "degraded");
        let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
        if (hasUnhealthy) overallStatus = "unhealthy";
        else if (hasDegraded) overallStatus = "degraded";
        expect(overallStatus).toBe("degraded");
    });

    it("should aggregate status as unhealthy when any is unhealthy", async () => {
        const registry = createHealthRegistry();
        registry.register({ name: "db", check: async () => ({ status: "healthy" }) });
        registry.register({ name: "api", check: async () => ({ status: "unhealthy" }) });
        const results = await registry.checkAll();
        const resultsArray = Object.entries(results);
        const hasUnhealthy = resultsArray.some(([, r]) => r.status === "unhealthy");
        let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
        if (hasUnhealthy) overallStatus = "unhealthy";
        else if (hasDegraded) overallStatus = "degraded";
        expect(overallStatus).toBe("unhealthy");
    });
});
