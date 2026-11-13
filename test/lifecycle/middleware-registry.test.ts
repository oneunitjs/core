import { describe, it, expect } from "vitest";
import { MiddlewareRegistry } from "../../src/lifecycle/middleware-registry.js";
import type { LifecycleOptions } from "../../src/lifecycle/types.js";

const baseOptions: LifecycleOptions = {
    mode: "advanced",
    maxMiddleware: 10,
    maxPlugins: 10,
    executionTimeoutMs: 1000,
    throwOnError: false,
};

describe("MiddlewareRegistry", () => {
    it("registers middleware successfully", () => {
        const registry = new MiddlewareRegistry(baseOptions);
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};

        const result = registry.register("cors", "cors", mw);
        expect(result.success).toBe(true);
        expect(result.conflicts).toEqual([]);
        expect(registry.has("cors")).toBe(true);
        expect(registry.size()).toBe(1);
    });

    it("detects duplicate type conflicts", () => {
        const registry = new MiddlewareRegistry(baseOptions);
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};

        registry.register("cors-1", "cors", mw);
        const result = registry.register("cors-2", "cors", mw);

        expect(result.success).toBe(false);
        expect(result.conflicts.length).toBeGreaterThan(0);
        expect(result.conflicts[0].type).toBe("middleware");
        expect(result.conflicts[0].severity).toBe("error");
    });

    it("allows different types without conflict", () => {
        const registry = new MiddlewareRegistry(baseOptions);
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};

        registry.register("cors", "cors", mw);
        registry.register("csrf", "csrf", mw);
        registry.register("helmet", "helmet", mw);

        expect(registry.size()).toBe(3);
        expect(registry.getConflicts().filter((c) => c.severity === "error")).toEqual([]);
    });

    it("enforces max middleware limit", () => {
        const options: LifecycleOptions = { ...baseOptions, maxMiddleware: 2 };
        const registry = new MiddlewareRegistry(options);
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};

        registry.register("mw1", "type1", mw);
        registry.register("mw2", "type2", mw);
        const result = registry.register("mw3", "type3", mw);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Maximum middleware limit");
    });

    it("unregisters middleware", () => {
        const registry = new MiddlewareRegistry(baseOptions);
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};

        registry.register("mw1", "type1", mw);
        expect(registry.has("mw1")).toBe(true);

        registry.unregister("mw1");
        expect(registry.has("mw1")).toBe(false);
        expect(registry.size()).toBe(0);
    });

    it("clears conflicts on unregister", () => {
        const registry = new MiddlewareRegistry(baseOptions);
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};

        registry.register("cors-1", "cors", mw);
        registry.register("cors-2", "cors", mw);
        expect(registry.getConflicts().length).toBeGreaterThan(0);

        registry.unregister("cors-1");
        const errors = registry.getConflicts().filter((c) => c.severity === "error");
        expect(errors.length).toBe(0);
    });

    it("lists middleware sorted by priority", () => {
        const registry = new MiddlewareRegistry(baseOptions);
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};

        registry.register("low", "type1", mw, { priority: 1 });
        registry.register("high", "type2", mw, { priority: 10 });
        registry.register("mid", "type3", mw, { priority: 5 });

        const list = registry.list();
        expect(list[0].name).toBe("high");
        expect(list[1].name).toBe("mid");
        expect(list[2].name).toBe("low");
    });

    it("executes middleware successfully", async () => {
        const registry = new MiddlewareRegistry(baseOptions);
        let called = false;
        const mw = async (_req: unknown, _res: unknown, _next?: () => void) => {
            called = true;
        };

        registry.register("mw1", "type1", mw);
        const result = await registry.execute("mw1", { req: {}, res: {}, next: () => {}, phase: "request", aborted: false });

        expect(result.success).toBe(true);
        expect(called).toBe(true);
    });

    it("handles middleware timeout", async () => {
        const options: LifecycleOptions = { ...baseOptions, executionTimeoutMs: 50 };
        const registry = new MiddlewareRegistry(options);
        const mw = async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
        };

        registry.register("slow", "type1", mw);
        const result = await registry.execute("slow", { req: {}, res: {}, next: () => {}, phase: "request", aborted: false });

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("timed out");
    });

    it("returns error for unknown middleware", async () => {
        const registry = new MiddlewareRegistry(baseOptions);
        const result = await registry.execute("unknown", { req: {}, res: {}, next: () => {}, phase: "request", aborted: false });

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("not found");
    });

    it("executes middleware chain and stops on abort", async () => {
        const registry = new MiddlewareRegistry(baseOptions);
        const results: string[] = [];

        const mw1 = async (_req: unknown, _res: unknown, next: () => void) => {
            results.push("mw1");
            next();
        };
        const mw2 = async (_req: unknown, _res: unknown, _next: () => void) => {
            results.push("mw2");
            // Don't call next - abort
        };
        const mw3 = async (_req: unknown, _res: unknown, _next: () => void) => {
            results.push("mw3");
        };

        registry.register("mw1", "type1", mw1, { priority: 3 });
        registry.register("mw2", "type2", mw2, { priority: 2 });
        registry.register("mw3", "type3", mw3, { priority: 1 });

        const ctx = { req: {}, res: {}, next: () => {}, phase: "request" as const, aborted: false };
        const chainResults = await registry.executeAll(ctx);

        expect(chainResults.length).toBe(2);
        expect(results).toEqual(["mw1", "mw2"]);
    });
});
