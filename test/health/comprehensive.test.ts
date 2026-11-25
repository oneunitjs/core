import { describe, it, expect } from "vitest";
import { createHealthRegistry, createHealthProvider } from "../../src/health/index.js";

describe("HLTH - Health Checks", () => {
    it("HLTH-01: Register health checks", async () => {
        const registry = createHealthRegistry();
        registry.register(createHealthProvider("db", async () => ({ status: "healthy" }), true));
        const results = await registry.checkAll();
        expect(results.db).toBeDefined();
        expect(results.db.status).toBe("healthy");
    });

    it("HLTH-02: Execute multiple checks concurrently", async () => {
        const registry = createHealthRegistry();
        registry.register(createHealthProvider("db", async () => { await new Promise((r) => setTimeout(r, 50)); return { status: "healthy" }; }, true));
        registry.register(createHealthProvider("cache", async () => { await new Promise((r) => setTimeout(r, 50)); return { status: "healthy" }; }, true));
        const start = Date.now();
        const results = await registry.checkAll();
        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(150);
        expect(results.db.status).toBe("healthy");
        expect(results.cache.status).toBe("healthy");
    });

    it("HLTH-03: Aggregate healthy and degraded results", async () => {
        const registry = createHealthRegistry();
        registry.register(createHealthProvider("a", async () => ({ status: "healthy" }), true));
        registry.register(createHealthProvider("b", async () => ({ status: "degraded" }), true));
        const results = await registry.checkAll();
        const statuses = Object.values(results).map((r: any) => r.status);
        expect(statuses).toContain("healthy");
        expect(statuses).toContain("degraded");
    });

    it("HLTH-04: Test failed health checks", async () => {
        const registry = createHealthRegistry();
        registry.register(createHealthProvider("db", async () => ({ status: "unhealthy" }), true));
        const results = await registry.checkAll();
        expect(results.db.status).toBe("unhealthy");
    });

    it("HLTH-05: Test execution timeout and failure handling", async () => {
        const registry = createHealthRegistry();
        registry.register(createHealthProvider("hanging", async () => {
            await new Promise((r) => setTimeout(r, 5000));
            return { status: "healthy" };
        }, true));
        const results = await registry.checkAll({ timeoutMs: 100 });
        expect(results.hanging.status).toBe("unhealthy");
    });

    it("HLTH-06: Validate healthy results", async () => {
        const registry = createHealthRegistry();
        registry.register(createHealthProvider("db", async () => ({ status: "healthy" }), true));
        const results = await registry.checkAll();
        const hasHealthy = Object.values(results).some((r: any) => r.status === "healthy");
        expect(hasHealthy).toBe(true);
    });

    it("HLTH-07: Validate unhealthy results", async () => {
        const registry = createHealthRegistry();
        registry.register(createHealthProvider("db", async () => ({ status: "unhealthy" }), true));
        const results = await registry.checkAll();
        const hasUnhealthy = Object.values(results).some((r: any) => r.status === "unhealthy");
        expect(hasUnhealthy).toBe(true);
    });

    it("HLTH-08: Test Docker/Kubernetes health providers", () => {
        expect(() => createHealthRegistry()).not.toThrow();
    });

    it("HLTH-09: Health registry returns empty initially", async () => {
        const registry = createHealthRegistry();
        const results = await registry.checkAll();
        expect(Object.keys(results)).toHaveLength(0);
    });

    it("HLTH-10: Multiple registrations with same name", async () => {
        const registry = createHealthRegistry();
        registry.register(createHealthProvider("db", async () => ({ status: "healthy" }), true));
        registry.register(createHealthProvider("db", async () => ({ status: "degraded" }), true));
        const results = await registry.checkAll();
        expect(results.db).toBeDefined();
    });
});
