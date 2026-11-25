import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("LC - Lifecycle and Middleware", () => {
    it("LC-01: Register middleware", () => {
        const app = createApp();
        const lc = app.lifecycle();
        lc.initialize();
        lc.registerMiddleware("mw1", "type1", (_req, _res, next) => next());
        expect(lc.hasMiddleware("mw1")).toBe(true);
    });

    it("LC-02: Middleware registration returns result", () => {
        const app = createApp();
        const lc = app.lifecycle();
        lc.initialize();
        const result = lc.registerMiddleware("mw", "type", (_req, _res, next) => next());
        expect(result.success).toBe(true);
    });

    it("LC-03: Lifecycle has middleware check", () => {
        const app = createApp();
        const lc = app.lifecycle();
        lc.initialize();
        lc.registerMiddleware("mw", "type", (_req, _res, next) => next());
        expect(lc.hasMiddleware("mw")).toBe(true);
        expect(lc.hasMiddleware("nonexistent")).toBe(false);
    });

    it("LC-04: Lifecycle clear removes middleware", () => {
        const app = createApp();
        const lc = app.lifecycle();
        lc.initialize();
        lc.registerMiddleware("mw", "type", (_req, _res, next) => next());
        lc.clear();
        expect(lc.hasMiddleware("mw")).toBe(false);
    });

    it("LC-05: Strict mode middleware limits", () => {
        const app = createApp({ lifecycle: { mode: "strict", maxMiddleware: 3 } });
        const lc = app.lifecycle();
        lc.initialize();
        lc.registerMiddleware("m1", "type", (_req, _res, next) => next());
        lc.registerMiddleware("m2", "type", (_req, _res, next) => next());
        lc.registerMiddleware("m3", "type", (_req, _res, next) => next());
        const result = lc.registerMiddleware("m4", "type", (_req, _res, next) => next());
        expect(result.success).toBe(false);
    });

    it("LC-06: Validation report", () => {
        const app = createApp();
        const lc = app.lifecycle();
        lc.initialize();
        const report = lc.getValidationReport();
        expect(report).toBeDefined();
        expect(report.safe).toBeDefined();
    });

    it("LC-07: Namespace isolation", () => {
        const app = createApp();
        const lc = app.lifecycle();
        lc.initialize();
        lc.registerMiddleware("mw", "type", (_req, _res, next) => next(), { conflictTypes: ["type"] });
        expect(lc.hasMiddleware("mw")).toBe(true);
    });

    it("LC-08: getState returns lifecycle state", () => {
        const app = createApp();
        const lc = app.lifecycle();
        lc.initialize();
        const state = lc.getState();
        expect(state).toBeDefined();
    });

    it("LC-09: getMiddlewareList returns registrations", () => {
        const app = createApp();
        const lc = app.lifecycle();
        lc.initialize();
        lc.registerMiddleware("mw", "type", (_req, _res, next) => next());
        const list = lc.getMiddlewareList();
        expect(Array.isArray(list)).toBe(true);
    });

    it("LC-10: executeMiddlewareChain processes middleware", async () => {
        const app = createApp();
        const lc = app.lifecycle();
        lc.initialize();
        lc.registerMiddleware("mw", "type", (_req, _res, next) => next());
        const results = await lc.executeMiddlewareChain({} as any, {} as any);
        expect(Array.isArray(results)).toBe(true);
    });

    it("LC-11: getPluginList returns empty initially", () => {
        const app = createApp();
        const lc = app.lifecycle();
        lc.initialize();
        const list = lc.getPluginList();
        expect(Array.isArray(list)).toBe(true);
        expect(list.length).toBe(0);
    });

    it("LC-12: isSafe returns boolean", () => {
        const app = createApp();
        const lc = app.lifecycle();
        lc.initialize();
        expect(typeof lc.isSafe()).toBe("boolean");
    });

    it("LC-13: setMode changes lifecycle mode", () => {
        const app = createApp();
        const lc = app.lifecycle();
        lc.initialize();
        const result = lc.setMode("strict");
        expect(result.success).toBe(true);
    });

    it("LC-14: unregisterMiddleware removes registration", () => {
        const app = createApp();
        const lc = app.lifecycle();
        lc.initialize();
        lc.registerMiddleware("mw", "type", (_req, _res, next) => next());
        expect(lc.hasMiddleware("mw")).toBe(true);
        lc.unregisterMiddleware("mw");
        expect(lc.hasMiddleware("mw")).toBe(false);
    });
});
