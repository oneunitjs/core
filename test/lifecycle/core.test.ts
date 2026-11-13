import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("createApp - Lifecycle Integration", () => {
    it("exposes lifecycle() on the App", () => {
        const core = createApp();
        const lifecycle = core.lifecycle();
        expect(lifecycle).toBeDefined();
        expect(typeof lifecycle.mode).toBe("function");
        expect(typeof lifecycle.setMode).toBe("function");
        expect(typeof lifecycle.initialize).toBe("function");
        expect(typeof lifecycle.registerMiddleware).toBe("function");
        expect(typeof lifecycle.registerPlugin).toBe("function");
        expect(typeof lifecycle.executeMiddleware).toBe("function");
        expect(typeof lifecycle.executeHook).toBe("function");
        expect(typeof lifecycle.getState).toBe("function");
        expect(typeof lifecycle.isSafe).toBe("function");
        expect(typeof lifecycle.getValidationReport).toBe("function");
    });

    it("returns cached lifecycle instance", () => {
        const core = createApp();
        const l1 = core.lifecycle();
        const l2 = core.lifecycle();
        expect(l1).toBe(l2);
    });

    it("defaults to advanced mode", () => {
        const core = createApp();
        expect(core.lifecycle().mode()).toBe("advanced");
    });

    it("starts in easy mode", () => {
        const core = createApp({ lifecycle: { mode: "easy" } });
        expect(core.lifecycle().mode()).toBe("easy");
    });

    it("starts in strict mode", () => {
        const core = createApp({ lifecycle: { mode: "strict" } });
        expect(core.lifecycle().mode()).toBe("strict");
    });

    it("switches modes through app", () => {
        const core = createApp();
        const result = core.lifecycle().setMode("easy");
        expect(result.success).toBe(true);
        expect(core.lifecycle().mode()).toBe("easy");
    });

    it("registers middleware through app lifecycle", () => {
        const core = createApp();
        core.lifecycle().initialize();

        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        const result = core.lifecycle().registerMiddleware("my-cors", "cors", mw);

        expect(result.success).toBe(true);
        expect(core.lifecycle().hasMiddleware("my-cors")).toBe(true);
    });

    it("detects conflicts through app lifecycle", () => {
        const core = createApp();
        core.lifecycle().initialize();

        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        core.lifecycle().registerMiddleware("cors-1", "cors", mw);
        const result = core.lifecycle().registerMiddleware("cors-2", "cors", mw);

        expect(result.success).toBe(false);
        expect(core.lifecycle().isSafe()).toBe(false);
    });

    it("registers plugins through app lifecycle", () => {
        const core = createApp();
        core.lifecycle().initialize();

        const hooks = { request: [async (_ctx: unknown) => {}] };
        const result = core.lifecycle().registerPlugin("auth", "security", hooks);

        expect(result.success).toBe(true);
        expect(core.lifecycle().hasPlugin("auth", "security")).toBe(true);
    });

    it("executes hooks through app lifecycle", async () => {
        const core = createApp();
        core.lifecycle().initialize();

        const calls: string[] = [];
        core.lifecycle().registerPlugin("p1", "ns1", {
            request: [async (_ctx: unknown) => { calls.push("p1"); }],
        });

        await core.lifecycle().executeHook("request", {});
        expect(calls).toEqual(["p1"]);
    });

    it("returns validation report through app", () => {
        const core = createApp();
        core.lifecycle().initialize();

        const mw = (_req: unknown, _res: unknown, _next?: () => void) => {};
        core.lifecycle().registerMiddleware("cors-1", "cors", mw);
        core.lifecycle().registerMiddleware("cors-2", "cors", mw);

        const report = core.lifecycle().getValidationReport();
        expect(report.safe).toBe(false);
        expect(report.errors.length).toBeGreaterThan(0);
    });

    it("creates plugin context through app", () => {
        const core = createApp();
        core.lifecycle().initialize();

        core.lifecycle().registerPlugin("my-plugin", "my-ns", { request: [async () => {}] });
        const ctx = core.lifecycle().createPluginContext("my-plugin", "my-ns");

        expect(ctx.name).toBe("my-plugin");
        expect(ctx.namespace).toBe("my-ns");
    });

    it("easy mode enables throwOnError", () => {
        const core = createApp({ lifecycle: { mode: "easy" } });
        core.lifecycle().initialize();

        const state = core.lifecycle().getState();
        expect(state.mode).toBe("easy");
    });

    it("strict mode has lower limits", () => {
        const core = createApp({ lifecycle: { mode: "strict" } });
        core.lifecycle().initialize();

        const state = core.lifecycle().getState();
        expect(state.mode).toBe("strict");
    });
});
