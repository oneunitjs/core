import { describe, it, expect } from "vitest";
import { createHooks } from "../../src/hooks/index.js";

describe("Hooks - Registration", () => {
    let hooks: ReturnType<typeof createHooks>;

    beforeEach(() => { hooks = createHooks(); });

    it("should register and emit a hook", async () => {
        const calls: string[] = [];
        hooks.on("greet", async (ctx: unknown) => { calls.push(`greet-${ctx}`); });
        await hooks.emit("greet", "world");
        expect(calls).toEqual(["greet-world"]);
    });

    it("should register multiple listeners for same hook", async () => {
        const calls: string[] = [];
        hooks.on("event", async () => { calls.push("first"); });
        hooks.on("event", async () => { calls.push("second"); });
        await hooks.emit("event", {});
        expect(calls).toEqual(["first", "second"]);
    });

    it("should execute hooks in registration order", async () => {
        const order: string[] = [];
        hooks.on("seq", async () => { order.push("first"); });
        hooks.on("seq", async () => { order.push("second"); });
        hooks.on("seq", async () => { order.push("third"); });
        await hooks.emit("seq", {});
        expect(order).toEqual(["first", "second", "third"]);
    });
});

describe("Hooks - Once Listener", () => {
    it("should only execute once listener one time", async () => {
        const hooks = createHooks();
        const calls: string[] = [];
        hooks.once("once-event", async () => { calls.push("fired"); });
        await hooks.emit("once-event", {});
        await hooks.emit("once-event", {});
        await hooks.emit("once-event", {});
        expect(calls).toEqual(["fired"]);
    });
});

describe("Hooks - Off Listener", () => {
    it("should remove listener with off", async () => {
        const hooks = createHooks();
        const calls: string[] = [];
        const listener = async () => { calls.push("fired"); };
        hooks.on("remove-test", listener);
        hooks.off("remove-test", listener);
        await hooks.emit("remove-test", {});
        expect(calls).toEqual([]);
    });
});

describe("Hooks - EmitSync", () => {
    it("should execute sync hooks", () => {
        const hooks = createHooks();
        const calls: string[] = [];
        hooks.on("sync-event", (ctx: unknown) => { calls.push(`sync-${ctx}`); });
        hooks.emitSync("sync-event", "data");
        expect(calls).toEqual(["sync-data"]);
    });
});

describe("Hooks - Has and Listeners", () => {
    it("should report has listener", () => {
        const hooks = createHooks();
        hooks.on("test-hook", async () => {});
        expect(hooks.has("test-hook")).toBe(true);
        expect(hooks.has("nonexistent")).toBe(false);
    });

    it("should return listener count", () => {
        const hooks = createHooks();
        hooks.on("count-test", async () => {});
        hooks.on("count-test", async () => {});
        hooks.on("count-test", async () => {});
        expect(hooks.listenerCount("count-test")).toBe(3);
    });

    it("should return listeners array", () => {
        const hooks = createHooks();
        const listener1 = async () => {};
        const listener2 = async () => {};
        hooks.on("listeners-test", listener1);
        hooks.on("listeners-test", listener2);
        const listeners = hooks.listeners("listeners-test");
        expect(listeners).toHaveLength(2);
        expect(listeners).toContain(listener1);
        expect(listeners).toContain(listener2);
    });
});

describe("Hooks - Clear", () => {
    it("should clear all hooks", () => {
        const hooks = createHooks();
        hooks.on("clear-test", async () => {});
        hooks.clear();
        expect(hooks.has("clear-test")).toBe(false);
    });

    it("should clear specific hook", () => {
        const hooks = createHooks();
        hooks.on("clear-a", async () => {});
        hooks.on("clear-b", async () => {});
        hooks.clearHook("clear-a");
        expect(hooks.has("clear-a")).toBe(false);
        expect(hooks.has("clear-b")).toBe(true);
    });
});

describe("Hooks - toJSON", () => {
    it("should return listener counts", () => {
        const hooks = createHooks();
        hooks.on("json-a", async () => {});
        hooks.on("json-a", async () => {});
        hooks.on("json-b", async () => {});
        const json = hooks.toJSON();
        expect(json["json-a"]).toBe(2);
        expect(json["json-b"]).toBe(1);
    });
});

describe("Hooks - Error Isolation", () => {
    it("should throw when hook listener throws with throwOnError enabled", async () => {
        const hooks = createHooks({ throwOnError: true });
        hooks.on("error-isolation", async () => { throw new Error("listener error"); });
        await expect(hooks.emit("error-isolation", {})).rejects.toThrow("listener error");
    });

    it("should not throw when hook listener throws with throwOnError disabled", async () => {
        const hooks = createHooks({ throwOnError: false });
        const calls: string[] = [];
        hooks.on("error-isolation", async () => { throw new Error("listener error"); });
        hooks.on("error-isolation", async () => { calls.push("still-fired"); });
        await hooks.emit("error-isolation", {});
        expect(calls).toEqual(["still-fired"]);
    });
});
