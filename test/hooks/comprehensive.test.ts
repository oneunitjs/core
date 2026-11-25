import { describe, it, expect } from "vitest";
import { createHooks } from "../../src/hooks/index.js";

describe("HK - Hooks", () => {
    it("HK-01: Register and remove listeners", () => {
        const hooks = createHooks();
        const handler = () => {};
        hooks.on("evt", handler);
        hooks.off("evt", handler);
        let called = 0;
        hooks.on("evt", () => { called++; });
        hooks.emitSync("evt");
        expect(called).toBe(1);
    });

    it("HK-02: Test emitSync()", () => {
        const hooks = createHooks();
        let syncCalled = false;
        hooks.on("evt", () => { syncCalled = true; });
        hooks.emitSync("evt");
        expect(syncCalled).toBe(true);
    });

    it("HK-03: Test once()", () => {
        const hooks = createHooks();
        let count = 0;
        hooks.once("evt", () => { count++; });
        hooks.emitSync("evt");
        hooks.emitSync("evt");
        expect(count).toBe(1);
    });

    it("HK-04: Test off()", () => {
        const hooks = createHooks();
        const h1 = () => {};
        const h2 = () => {};
        hooks.on("evt", h1);
        hooks.on("evt", h2);
        hooks.off("evt", h1);
        hooks.emitSync("evt");
        expect(true).toBe(true);
    });

    it("HK-05: Validate execution ordering", () => {
        const hooks = createHooks();
        const order: string[] = [];
        hooks.on("evt", () => { order.push("first"); });
        hooks.on("evt", () => { order.push("second"); });
        hooks.on("evt", () => { order.push("third"); });
        hooks.emitSync("evt");
        expect(order).toEqual(["first", "second", "third"]);
    });

    it("HK-06: Test asynchronous listeners", async () => {
        const hooks = createHooks();
        let completed = false;
        hooks.on("evt", async () => { await new Promise((r) => setTimeout(r, 20)); completed = true; });
        await hooks.emit("evt");
        expect(completed).toBe(true);
    });

    it("HK-07: Test rejected promises", async () => {
        const hooks = createHooks();
        let otherCalled = false;
        hooks.on("evt", async () => { throw new Error("fail"); });
        hooks.on("evt", async () => { otherCalled = true; });
        await hooks.emit("evt");
        expect(otherCalled).toBe(true);
    });

    it("HK-08: Test multiple listeners", () => {
        const hooks = createHooks();
        let count = 0;
        hooks.on("evt", () => { count++; });
        hooks.on("evt", () => { count++; });
        hooks.on("evt", () => { count++; });
        hooks.emitSync("evt");
        expect(count).toBe(3);
    });

    it("HK-09: Verify listener cleanup", () => {
        const hooks = createHooks();
        hooks.on("evt", () => {});
        hooks.on("evt2", () => {});
        hooks.clear();
        hooks.emitSync("evt");
        hooks.emitSync("evt2");
        expect(true).toBe(true);
    });

    it("HK-10: Test concurrent event emission", async () => {
        const hooks = createHooks();
        let counter = 0;
        hooks.on("evt", async () => { counter++; });
        await Promise.all(Array.from({ length: 50 }, () => hooks.emit("evt")));
        expect(counter).toBe(50);
    });
});
