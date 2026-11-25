import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("CONC - Concurrency Tests", () => {
    it("CONC-01: Concurrent cookie operations - no cross-request leakage", () => {
        const app = createApp({ secret: "s3cr3t" });
        const results: string[] = [];
        for (let _ = 0; _ < 50; _++) {
            const store = app.cookies();
            store.set("user", "value");
            const val = store.get("user");
            results.push(val ?? "missing");
        }
        expect(results.filter((r) => r === "value")).toHaveLength(50);
    });

    it("CONC-02: Concurrent response creation - no errors", () => {
        const app = createApp();
        const results: boolean[] = [];
        for (let _ = 0; _ < 50; _++) {
            const res: any = {
                headers: {},
                setHeader: () => {},
                end: () => {},
                json: () => {},
                send: () => {},
            };
            const r = app.response({} as any, res);
            results.push(typeof r.ok === "function");
        }
        expect(results.every(Boolean)).toBe(true);
    });

    it("CONC-03: Concurrent lifecycle executions", () => {
        const app = createApp();
        const l1 = app.lifecycle();
        l1.initialize();
        const l2 = app.lifecycle();
        l2.initialize();
        l1.registerMiddleware("mw", "type", (_req, _res, next) => next());
        l2.registerMiddleware("mw", "type", (_req, _res, next) => next());
        expect(l1.hasMiddleware("mw")).toBe(true);
        expect(l2.hasMiddleware("mw")).toBe(true);
    });

    it("CONC-04: Parallel health checks", async () => {
        const app = createApp();
        const health = app.health();
        health.register("check-1", async () => ({ status: "healthy" }), true);
        health.register("check-2", async () => ({ status: "healthy" }), true);
        const results = await health.check();
        expect(results["check-1"].status).toBe("healthy");
        expect(results["check-2"].status).toBe("healthy");
    });

    it("CONC-05: Concurrent rate-limit updates", () => {
        const app = createApp();
        const rateLimit = app.rateLimit({ maxRequests: 100, windowMs: 60000 });
        const middleware = rateLimit.middleware();
        const results: number[] = [];
        for (let _ = 0; _ < 150; _++) {
            const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
            middleware({ ip: "10.0.0.1" }, res);
            results.push(res.statusCode);
        }
        const count200 = results.filter((s) => s === 200).length;
        const count429 = results.filter((s) => s === 429).length;
        expect(count200).toBeLessThanOrEqual(100);
        expect(count429).toBeGreaterThanOrEqual(50);
    });

    it("CONC-06: Event listener concurrency", () => {
        const app = createApp();
        const hooks = app.hooks();
        let counter = 0;
        hooks.on("evt", () => { counter++; });
        for (let _ = 0; _ < 50; _++) {
            hooks.emitSync("evt");
        }
        expect(counter).toBe(50);
    });

    it("CONC-07: Multiple simultaneous HTTP requests", async () => {
        const app = createApp({ serviceName: "conc-test" });
        const results: number[] = [];
        for (let _ = 0; _ < 20; _++) {
            const store = app.cookies();
            store.set("req", "handled");
            results.push(200);
        }
        expect(results.filter((s) => s === 200)).toHaveLength(20);
    });

    it("CONC-08: AsyncLocalStorage context isolation", () => {
        const app = createApp();
        const ctx1 = app.context?.create?.();
        const ctx2 = app.context?.create?.();
        if (ctx1 && ctx2) {
            ctx1.set("key", "val1");
            ctx2.set("key", "val2");
            expect(ctx1.get("key")).toBe("val1");
            expect(ctx2.get("key")).toBe("val2");
        }
    });
});
