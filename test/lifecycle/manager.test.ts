import { describe, it, expect } from "vitest";
import { LifecycleManager } from "../../src/lifecycle/manager.js";
import type { LifecycleMode } from "../../src/lifecycle/types.js";

function createManager(mode: LifecycleMode = "advanced") {
    return new LifecycleManager({
        mode,
        maxMiddleware: 10,
        maxPlugins: 10,
        executionTimeoutMs: 1000,
        throwOnError: false,
    });
}

describe("LifecycleManager - Mode Switching", () => {
    it("starts in advanced mode by default", () => {
        const mgr = createManager();
        expect(mgr.getMode()).toBe("advanced");
    });

    it("starts in easy mode when specified", () => {
        const mgr = new LifecycleManager({ mode: "easy" });
        expect(mgr.getMode()).toBe("easy");
    });

    it("starts in strict mode when specified", () => {
        const mgr = new LifecycleManager({ mode: "strict" });
        expect(mgr.getMode()).toBe("strict");
    });

    it("switches modes successfully", () => {
        const mgr = createManager("advanced");
        const result = mgr.setMode("easy");

        expect(result.success).toBe(true);
        expect(mgr.getMode()).toBe("easy");
    });

    it("switches to strict mode with tighter limits", () => {
        const mgr = createManager("advanced");
        mgr.setMode("strict");

        expect(mgr.getMode()).toBe("strict");
        // Strict mode should have lower limits
        const state = mgr.getState();
        expect(state.mode).toBe("strict");
    });
});

describe("LifecycleManager - Initialization", () => {
    it("initializes successfully", () => {
        const mgr = createManager();
        const result = mgr.initialize();

        expect(result.success).toBe(true);
        expect(mgr.getState().initialized).toBe(true);
    });

    it("reports already initialized", () => {
        const mgr = createManager();
        mgr.initialize();
        const result = mgr.initialize();

        expect(result.success).toBe(true);
        expect(result.error).toContain("Already initialized");
    });

    it("auto-registers essential middleware in easy mode", () => {
        const mgr = new LifecycleManager({ mode: "easy" });
        const result = mgr.initialize();

        expect(result.success).toBe(true);
    });
});

describe("LifecycleManager - Middleware Registration", () => {
    it("registers middleware through manager", () => {
        const mgr = createManager();
        mgr.initialize();

        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        const result = mgr.registerMiddleware("cors", "cors", mw);

        expect(result.success).toBe(true);
        expect(mgr.hasMiddleware("cors")).toBe(true);
    });

    it("detects conflicts through manager", () => {
        const mgr = createManager();
        mgr.initialize();

        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("cors-1", "cors", mw);
        const result = mgr.registerMiddleware("cors-2", "cors", mw);

        expect(result.success).toBe(false);
        expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it("unregisters middleware through manager", () => {
        const mgr = createManager();
        mgr.initialize();

        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("mw1", "type1", mw);
        expect(mgr.hasMiddleware("mw1")).toBe(true);

        mgr.unregisterMiddleware("mw1");
        expect(mgr.hasMiddleware("mw1")).toBe(false);
    });

    it("lists middleware through manager", () => {
        const mgr = createManager();
        mgr.initialize();

        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("low", "type1", mw, { priority: 1 });
        mgr.registerMiddleware("high", "type2", mw, { priority: 10 });

        const list = mgr.getMiddlewareList();
        expect(list[0].name).toBe("high");
    });
});

describe("LifecycleManager - Plugin Registration", () => {
    it("registers plugin through manager", () => {
        const mgr = createManager();
        mgr.initialize();

        const hooks = { request: [async (_ctx: unknown) => {}] };
        const result = mgr.registerPlugin("auth", "security", hooks);

        expect(result.success).toBe(true);
        expect(mgr.hasPlugin("auth", "security")).toBe(true);
    });

    it("detects plugin conflicts through manager", () => {
        const mgr = createManager();
        mgr.initialize();

        const hooks = { request: [async (_ctx: unknown) => {}] };
        mgr.registerPlugin("auth", "security", hooks);
        const result = mgr.registerPlugin("auth", "security", hooks);

        expect(result.success).toBe(false);
        expect(result.conflicts[0].type).toBe("plugin");
    });

    it("lists plugins through manager", () => {
        const mgr = createManager();
        mgr.initialize();

        const hooks = { request: [async (_ctx: unknown) => {}] };
        mgr.registerPlugin("p1", "ns1", hooks, { priority: 1 });
        mgr.registerPlugin("p2", "ns2", hooks, { priority: 5 });

        const list = mgr.getPluginList();
        expect(list[0].name).toBe("p2");
    });

    it("gets namespaces through manager", () => {
        const mgr = createManager();
        mgr.initialize();

        const hooks = { request: [async (_ctx: unknown) => {}] };
        mgr.registerPlugin("p1", "ns-alpha", hooks);
        mgr.registerPlugin("p2", "ns-beta", hooks);

        const namespaces = mgr.getNamespaces();
        expect(namespaces).toContain("ns-alpha");
        expect(namespaces).toContain("ns-beta");
    });
});

describe("LifecycleManager - Middleware Execution", () => {
    it("executes single middleware", async () => {
        const mgr = createManager();
        mgr.initialize();

        let executed = false;
        const mw = async (_req: unknown, _res: unknown, _next?: () => void) => {
            executed = true;
        };

        mgr.registerMiddleware("mw1", "type1", mw);
        const result = await mgr.executeMiddleware("mw1", {}, {}, "request");

        expect(result.success).toBe(true);
        expect(executed).toBe(true);
    });

    it("executes middleware chain", async () => {
        const mgr = createManager();
        mgr.initialize();

        const order: string[] = [];
        const mw1 = async (_req: unknown, _res: unknown, next: () => void) => {
            order.push("mw1");
            next();
        };
        const mw2 = async (_req: unknown, _res: unknown, _next: () => void) => {
            order.push("mw2");
        };

        mgr.registerMiddleware("mw1", "type1", mw1, { priority: 2 });
        mgr.registerMiddleware("mw2", "type2", mw2, { priority: 1 });

        const results = await mgr.executeMiddlewareChain({}, {}, "request");

        expect(results.length).toBe(2);
        expect(order).toEqual(["mw1", "mw2"]);
    });

    it("handles unknown middleware", async () => {
        const mgr = createManager();
        mgr.initialize();

        const result = await mgr.executeMiddleware("nonexistent", {}, {}, "request");
        expect(result.success).toBe(false);
    });
});

describe("LifecycleManager - Hook Execution", () => {
    it("executes hooks through manager", async () => {
        const mgr = createManager();
        mgr.initialize();

        const calls: string[] = [];
        mgr.registerPlugin("p1", "ns1", {
            request: [async (_ctx: unknown) => { calls.push("p1"); }],
        });
        mgr.registerPlugin("p2", "ns2", {
            request: [async (_ctx: unknown) => { calls.push("p2"); }],
        });

        const results = await mgr.executeHook("request", {});

        expect(results.length).toBe(2);
        expect(calls).toEqual(["p1", "p2"]);
    });

    it("executes hook isolated by namespace", async () => {
        const mgr = createManager();
        mgr.initialize();

        const calls: string[] = [];
        mgr.registerPlugin("p1", "ns1", {
            request: [async (_ctx: unknown) => { calls.push("p1"); }],
        });
        mgr.registerPlugin("p2", "ns2", {
            request: [async (_ctx: unknown) => { calls.push("p2"); }],
        });

        const result = await mgr.executeHookIsolated("request", {}, "ns1");

        expect(result.success).toBe(true);
        expect(calls).toEqual(["p1"]);
    });
});

describe("LifecycleManager - State and Validation", () => {
    it("returns lifecycle state", () => {
        const mgr = createManager();
        mgr.initialize();

        const state = mgr.getState();
        expect(state.mode).toBe("advanced");
        expect(state.initialized).toBe(true);
        expect(state.middlewareCount).toBe(0);
        expect(state.pluginCount).toBe(0);
    });

    it("reports safe when no conflicts", () => {
        const mgr = createManager();
        mgr.initialize();

        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("cors", "cors", mw);
        mgr.registerMiddleware("csrf", "csrf", mw);

        expect(mgr.isSafe()).toBe(true);
    });

    it("reports unsafe when conflicts exist", () => {
        const mgr = createManager();
        mgr.initialize();

        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("cors-1", "cors", mw);
        mgr.registerMiddleware("cors-2", "cors", mw);

        expect(mgr.isSafe()).toBe(false);
    });

    it("returns validation report", () => {
        const mgr = createManager();
        mgr.initialize();

        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        mgr.registerMiddleware("cors-1", "cors", mw);
        mgr.registerMiddleware("cors-2", "cors", mw);

        const report = mgr.getValidationReport();
        expect(report.safe).toBe(false);
        expect(report.errors.length).toBeGreaterThan(0);
        expect(report.warnings.length).toBe(0);
    });

    it("tracks execution and error counts", async () => {
        const mgr = createManager();
        mgr.initialize();

        const mw = async (_req: unknown, _res: unknown, _next?: () => void) => {
            throw new Error("middleware error");
        };

        mgr.registerMiddleware("failing", "type1", mw);
        await mgr.executeMiddleware("failing", {}, {}, "request");

        const state = mgr.getState();
        expect(state.executionCount).toBe(1);
        expect(state.errorCount).toBe(1);
    });

    it("clears all state", () => {
        const mgr = createManager();
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
