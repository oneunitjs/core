import { describe, it, expect, beforeEach } from "vitest";
import { LifecycleManager } from "../../src/lifecycle/manager.js";

describe("Lifecycle Manager - Mode Switching", () => {
    it("should start in advanced mode by default", () => {
        const mgr = new LifecycleManager();
        expect(mgr.getMode()).toBe("advanced");
    });

    it("should start in easy mode when specified", () => {
        const mgr = new LifecycleManager({ mode: "easy" });
        expect(mgr.getMode()).toBe("easy");
    });

    it("should start in strict mode when specified", () => {
        const mgr = new LifecycleManager({ mode: "strict" });
        expect(mgr.getMode()).toBe("strict");
    });

    it("should switch modes successfully", () => {
        const mgr = new LifecycleManager("advanced");
        const result = mgr.setMode("easy");
        expect(result.success).toBe(true);
        expect(mgr.getMode()).toBe("easy");
    });

    it("should switch to strict mode with tighter limits", () => {
        const mgr = new LifecycleManager("advanced");
        mgr.setMode("strict");
        const state = mgr.getState();
        expect(state.mode).toBe("strict");
        expect(state.middlewareCount).toBe(0);
    });
});

describe("Lifecycle Manager - Initialization", () => {
    it("should initialize successfully", () => {
        const mgr = new LifecycleManager();
        const result = mgr.initialize();
        expect(result.success).toBe(true);
        expect(mgr.getState().initialized).toBe(true);
    });

    it("should report already initialized", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const result = mgr.initialize();
        expect(result.success).toBe(true);
        expect(result.error).toContain("Already initialized");
    });

    it("should auto-register essential middleware in easy mode", () => {
        const mgr = new LifecycleManager({ mode: "easy" });
        const result = mgr.initialize();
        expect(result.success).toBe(true);
    });
});

describe("Lifecycle Manager - Middleware Registration", () => {
    it("should register middleware successfully", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        const result = mgr.registerMiddleware("cors", "cors", mw);
        expect(result.success).toBe(true);
        expect(mgr.hasMiddleware("cors")).toBe(true);
    });

    it("should detect duplicate type conflicts", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("cors-1", "cors", mw);
        const result = mgr.registerMiddleware("cors-2", "cors", mw);
        expect(result.success).toBe(false);
        expect(result.conflicts.length).toBeGreaterThan(0);
        expect(result.conflicts[0].type).toBe("middleware");
        expect(result.conflicts[0].severity).toBe("error");
    });

    it("should allow different types without conflict", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("cors", "cors", mw);
        mgr.registerMiddleware("csrf", "csrf", mw);
        mgr.registerMiddleware("helmet", "helmet", mw);
        const list = mgr.getMiddlewareList();
        expect(list.length).toBe(3);
        const report = mgr.getValidationReport();
        expect(report.errors.length).toBe(0);
    });

    it("should unregister middleware", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("mw1", "type1", mw);
        expect(mgr.hasMiddleware("mw1")).toBe(true);
        mgr.unregisterMiddleware("mw1");
        expect(mgr.hasMiddleware("mw1")).toBe(false);
    });

    it("should list middleware sorted by priority", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("low", "type1", mw, { priority: 1 });
        mgr.registerMiddleware("high", "type2", mw, { priority: 10 });
        const list = mgr.getMiddlewareList();
        expect(list[0].name).toBe("high");
    });
});

describe("Lifecycle Manager - Plugin Registration", () => {
    it("should register plugin successfully", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const hooks = { request: [async (_ctx: unknown) => {}] };
        const result = mgr.registerPlugin("auth", "security", hooks);
        expect(result.success).toBe(true);
        expect(mgr.hasPlugin("auth", "security")).toBe(true);
    });

    it("should detect duplicate plugin in same namespace", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const hooks = { request: [async (_ctx: unknown) => {}] };
        mgr.registerPlugin("auth", "security", hooks);
        const result = mgr.registerPlugin("auth", "security", hooks);
        expect(result.success).toBe(false);
        expect(result.conflicts[0].type).toBe("plugin");
    });

    it("should allow same plugin name in different namespaces", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const hooks = { request: [async (_ctx: unknown) => {}] };
        mgr.registerPlugin("auth", "security", hooks);
        const result = mgr.registerPlugin("auth", "logging", hooks);
        expect(result.success).toBe(true);
        expect(mgr.getNamespaces()).toContain("security");
        expect(mgr.getNamespaces()).toContain("logging");
    });

    it("should list plugins sorted by priority", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const hooks = { request: [async (_ctx: unknown) => {}] };
        mgr.registerPlugin("p1", "ns1", hooks, { priority: 1 });
        mgr.registerPlugin("p2", "ns2", hooks, { priority: 5 });
        const list = mgr.getPluginList();
        expect(list[0].name).toBe("p2");
    });
});

describe("Lifecycle Manager - Middleware Execution", () => {
    it("should execute single middleware", async () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        let executed = false;
        const mw = async (_req: unknown, _res: unknown, _next?: () => void) => { executed = true; };
        mgr.registerMiddleware("mw1", "type1", mw);
        const result = await mgr.executeMiddleware("mw1", {}, {}, "request");
        expect(result.success).toBe(true);
        expect(executed).toBe(true);
    });

    it("should execute middleware chain in priority order", async () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const order: string[] = [];
        const mw1 = async (_req: unknown, _res: unknown, next: () => void) => { order.push("mw1"); next(); };
        const mw2 = async (_req: unknown, _res: unknown, next: () => void) => { order.push("mw2"); };
        mgr.registerMiddleware("mw1", "type1", mw1, { priority: 2 });
        mgr.registerMiddleware("mw2", "type2", mw2, { priority: 1 });
        const results = await mgr.executeMiddlewareChain({}, {}, "request");
        expect(results.length).toBe(2);
        expect(order).toEqual(["mw1", "mw2"]);
    });

    it("should handle unknown middleware", async () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const result = await mgr.executeMiddleware("nonexistent", {}, {}, "request");
        expect(result.success).toBe(false);
    });

    it("should handle middleware that throws", async () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const mw = async (_req: unknown, _res: unknown, _next?: () => void) => { throw new Error("middleware error"); };
        mgr.registerMiddleware("failing", "type1", mw);
        const result = await mgr.executeMiddleware("failing", {}, {}, "request");
        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(Error);
    });
});

describe("Lifecycle Manager - Hook Execution", () => {
    it("should execute hooks through manager", async () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const calls: string[] = [];
        mgr.registerPlugin("p1", "ns1", { request: [async (_ctx: unknown) => { calls.push("p1"); }] });
        mgr.registerPlugin("p2", "ns2", { request: [async (_ctx: unknown) => { calls.push("p2"); }] });
        const results = await mgr.executeHook("request", {});
        expect(results.length).toBe(2);
        expect(calls).toEqual(["p1", "p2"]);
    });

    it("should execute hook isolated by namespace", async () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const calls: string[] = [];
        mgr.registerPlugin("p1", "ns1", { request: [async (_ctx: unknown) => { calls.push("p1"); }] });
        mgr.registerPlugin("p2", "ns2", { request: [async (_ctx: unknown) => { calls.push("p2"); }] });
        const result = await mgr.executeHookIsolated("request", {}, "ns1");
        expect(result.success).toBe(true);
        expect(calls).toEqual(["p1"]);
    });

    it("should isolate hook errors", async () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const calls: string[] = [];
        mgr.registerPlugin("failing", "ns1", { request: [async () => { throw new Error("plugin error"); }] });
        mgr.registerPlugin("working", "ns2", { request: [async (_ctx: unknown) => { calls.push("working"); }] });
        const results = await mgr.executeHook("request", {});
        expect(results[0].success).toBe(false);
        expect(results[1].success).toBe(true);
        expect(calls).toEqual(["working"]);
    });
});

describe("Lifecycle Manager - State and Validation", () => {
    it("should return lifecycle state", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const state = mgr.getState();
        expect(state.mode).toBe("advanced");
        expect(state.initialized).toBe(true);
        expect(state.middlewareCount).toBe(0);
        expect(state.pluginCount).toBe(0);
    });

    it("should report safe when no conflicts", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("cors", "cors", mw);
        mgr.registerMiddleware("csrf", "csrf", mw);
        expect(mgr.isSafe()).toBe(true);
    });

    it("should report unsafe when conflicts exist", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("cors-1", "cors", mw);
        mgr.registerMiddleware("cors-2", "cors", mw);
        expect(mgr.isSafe()).toBe(false);
    });

    it("should return validation report with conflicts", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("cors-1", "cors", mw);
        mgr.registerMiddleware("cors-2", "cors", mw);
        const report = mgr.getValidationReport();
        expect(report.safe).toBe(false);
        expect(report.errors.length).toBeGreaterThan(0);
        expect(report.warnings.length).toBe(0);
    });

    it("should track execution and error counts", async () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const mw = async (_req: unknown, _res: unknown, _next?: () => void) => { throw new Error("middleware error"); };
        mgr.registerMiddleware("failing", "type1", mw);
        await mgr.executeMiddleware("failing", {}, {}, "request");
        const state = mgr.getState();
        expect(state.executionCount).toBe(1);
        expect(state.errorCount).toBe(1);
    });

    it("should clear all state", () => {
        const mgr = new LifecycleManager();
        mgr.initialize();
        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("mw1", "type1", mw);
        mgr.registerPlugin("p1", "ns1", { request: [async () => {}] });
        expect(mgr.getState().middlewareCount).toBe(1);
        expect(mgr.getState().pluginCount).toBe(1);
        mgr.clear();
        expect(mgr.getState().middlewareCount).toBe(0);
        expect(mgr.getState().pluginCount).toBe(0);
        expect(mgr.getState().initialized).toBe(false);
    });
});
