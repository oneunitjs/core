import { describe, it, expect } from "vitest";
import {
    createHooks,
    createHooksWithDefaults,
    DEFAULT_HOOKS,
    APPLICATION_HOOKS,
    LIFECYCLE_HOOKS,
    SERVER_HOOKS,
    CACHE_HOOKS,
    CONNECTION_HOOKS,
    type DefaultHookName,
} from "../../src/hooks/index.js";

describe("DEFAULT_HOOKS", () => {
    it("has 28 default hooks", () => {
        expect(DEFAULT_HOOKS.length).toBe(28);
    });

    it("includes application lifecycle hooks", () => {
        expect(APPLICATION_HOOKS).toContain("init");
        expect(APPLICATION_HOOKS).toContain("start");
        expect(APPLICATION_HOOKS).toContain("ready");
        expect(APPLICATION_HOOKS).toContain("shutdown");
    });

    it("includes lifecycle hooks", () => {
        expect(LIFECYCLE_HOOKS).toContain("request");
        expect(LIFECYCLE_HOOKS).toContain("beforeHandler");
        expect(LIFECYCLE_HOOKS).toContain("afterHandler");
        expect(LIFECYCLE_HOOKS).toContain("beforeSend");
        expect(LIFECYCLE_HOOKS).toContain("afterSend");
        expect(LIFECYCLE_HOOKS).toContain("response");
        expect(LIFECYCLE_HOOKS).toContain("error");
        expect(LIFECYCLE_HOOKS).toContain("notFound");
        expect(LIFECYCLE_HOOKS).toContain("timeout");
    });

    it("includes server lifecycle hooks", () => {
        expect(SERVER_HOOKS).toContain("beforeListen");
        expect(SERVER_HOOKS).toContain("afterListen");
        expect(SERVER_HOOKS).toContain("beforeClose");
        expect(SERVER_HOOKS).toContain("afterClose");
    });

    it("includes cache hooks", () => {
        expect(CACHE_HOOKS).toContain("cacheHit");
        expect(CACHE_HOOKS).toContain("cacheMiss");
    });

    it("includes connection hooks", () => {
        expect(CONNECTION_HOOKS).toContain("connection");
        expect(CONNECTION_HOOKS).toContain("disconnection");
    });

    it("all default hooks are valid DefaultHookName type", () => {
        const names: DefaultHookName[] = DEFAULT_HOOKS;
        expect(names.length).toBe(28);
    });
});

describe("createHooks with default hooks", () => {
    it("supports all default hooks by default", () => {
        const hooks = createHooks();
        expect(hooks.isSupported("request")).toBe(true);
        expect(hooks.isSupported("init")).toBe(true);
        expect(hooks.isSupported("error")).toBe(true);
        expect(hooks.isSupported("notFound")).toBe(true);
        expect(hooks.supportedHooks().length).toBe(28);
    });

    it("registers and emits a default hook", async () => {
        const hooks = createHooks();
        const calls: string[] = [];

        hooks.on("request", async (ctx: { url: string }) => {
            calls.push(`request:${ctx.url}`);
        });

        await hooks.emit("request", { url: "/api" });

        expect(calls).toEqual(["request:/api"]);
    });

    it("supports throwOnError with default hooks", async () => {
        const hooks = createHooks({ throwOnError: true });
        hooks.on("error", async () => {
            throw new Error("boom");
        });

        await expect(hooks.emit("error", {})).rejects.toThrow("boom");
    });

    it("toJSON shows registered hook counts", () => {
        const hooks = createHooks();
        hooks.on("start", () => {});
        hooks.on("start", () => {});
        hooks.on("ready", () => {});

        expect(hooks.toJSON()).toEqual({ start: 2, ready: 1 });
    });

    it("use is an alias for on", async () => {
        const hooks = createHooks<{ url: string }>();
        const calls: string[] = [];

        hooks.use("request", async (ctx) => {
            calls.push(`request:${ctx.url}`);
        });

        await hooks.emit("request", { url: "/api" });

        expect(calls).toEqual(["request:/api"]);
    });

    it("use is chainable", () => {
        const hooks = createHooks();
        const result = hooks.use("start", () => {});
        expect(result).toBe(hooks);
    });

    it("typed hook names with createHooksWithDefaults", async () => {
        const hooks = createHooksWithDefaults<{ url: string }>();
        const calls: string[] = [];

        expect(() => hooks.on("custom-hook" as any, async () => {})).toThrow(
            'Hook "custom-hook" is not allowed',
        );

        hooks.on("request", async (ctx) => {
            calls.push(`request:${ctx.url}`);
        });

        await hooks.emit("request", { url: "/api" });

        expect(calls).toEqual(["request:/api"]);
    });
});

describe("off (specific listener)", () => {
    it("removes one listener from a hook", async () => {
        const hooks = createHooks<{ url: string }>();
        const calls: string[] = [];
        const listener = async (ctx: { url: string }) => {
            calls.push(`request:${ctx.url}`);
        };

        hooks.on("request", listener);
        hooks.on("request", async (ctx) => {
            calls.push(`second:${ctx.url}`);
        });

        expect(hooks.listenerCount("request")).toBe(2);

        hooks.off("request", listener);

        expect(hooks.listenerCount("request")).toBe(1);
        await hooks.emit("request", { url: "/api" });
        expect(calls).toEqual(["second:/api"]);
    });

    it("removing a non-existent listener is a no-op", () => {
        const hooks = createHooks();
        hooks.on("start", () => {});

        expect(() => hooks.off("start", () => {})).not.toThrow();
        expect(hooks.listenerCount("start")).toBe(1);
    });

    it("removing all listeners deletes the hook entry", () => {
        const hooks = createHooks();
        const cb1 = () => {};
        const cb2 = () => {};

        hooks.on("start", cb1);
        hooks.on("start", cb2);
        expect(hooks.has("start")).toBe(true);

        hooks.off("start", cb1);
        hooks.off("start", cb2);

        expect(hooks.has("start")).toBe(false);
        expect(hooks.listenerCount("start")).toBe(0);
    });

    it("off is chainable", () => {
        const hooks = createHooks();
        const result = hooks.on("start", () => {}).off("start", () => {});
        expect(result).toBe(hooks);
    });
});

describe("clear (all hooks)", () => {
    it("clear() clears every hook", () => {
        const hooks = createHooks();
        hooks.on("start", () => {});
        hooks.on("ready", () => {});
        hooks.on("request", () => {});

        expect(hooks.listenerCount("start")).toBe(1);
        expect(hooks.listenerCount("ready")).toBe(1);
        expect(hooks.listenerCount("request")).toBe(1);

        hooks.clear();

        expect(hooks.has("start")).toBe(false);
        expect(hooks.has("ready")).toBe(false);
        expect(hooks.has("request")).toBe(false);
        expect(Object.keys(hooks.toJSON())).toEqual([]);
    });

    it("clear() is chainable", () => {
        const hooks = createHooks();
        const result = hooks.clear();
        expect(result).toBe(hooks);
    });

    it("clear() on empty hooks is a no-op", () => {
        const hooks = createHooks();
        expect(() => hooks.clear()).not.toThrow();
    });
});

describe("clearHook (specific hook)", () => {
    it("clearHook(name) clears only that hook", () => {
        const hooks = createHooks();
        hooks.on("start", () => {});
        hooks.on("ready", () => {});
        hooks.on("request", () => {});

        hooks.clearHook("start");

        expect(hooks.has("start")).toBe(false);
        expect(hooks.has("ready")).toBe(true);
        expect(hooks.has("request")).toBe(true);
        expect(hooks.listenerCount("ready")).toBe(1);
        expect(hooks.listenerCount("request")).toBe(1);
    });

    it("clearHook(name) is chainable", () => {
        const hooks = createHooks();
        const result = hooks.clearHook("start");
        expect(result).toBe(hooks);
    });

    it("clearHook(name) on non-existent hook is a no-op", () => {
        const hooks = createHooks();
        expect(() => hooks.clearHook("nonexistent")).not.toThrow();
    });
});

describe("once auto-removes after firing", () => {
    it("fires once then removes itself", async () => {
        const hooks = createHooks();
        const calls: string[] = [];

        hooks.once("boot", async () => {
            calls.push("booted");
        });

        await hooks.emit("boot", {});
        await hooks.emit("boot", {});

        expect(calls).toEqual(["booted"]);
        expect(hooks.listenerCount("boot")).toBe(0);
        expect(hooks.has("boot")).toBe(false);
    });
});

describe("createHooksWithDefaults", () => {
    it("restricts to default hooks only", () => {
        const hooks = createHooksWithDefaults();
        expect(hooks.isSupported("request")).toBe(true);
        expect(hooks.isSupported("custom-event")).toBe(false);
    });

    it("throws when registering non-default hook", () => {
        const hooks = createHooksWithDefaults();
        expect(() => hooks.on("custom-event", () => {})).toThrow(
            'Hook "custom-event" is not allowed',
        );
    });

    it("allows custom allowedHooks", () => {
        const hooks = createHooksWithDefaults({
            allowedHooks: ["custom-event", "start"],
        });
        expect(hooks.isSupported("custom-event")).toBe(true);
        expect(hooks.isSupported("start")).toBe(true);
        expect(hooks.isSupported("request")).toBe(false);

        hooks.on("custom-event", () => {});
        expect(hooks.listenerCount("custom-event")).toBe(1);
    });

    it("emit validates hook against allowed list", async () => {
        const hooks = createHooksWithDefaults({
            allowedHooks: ["start"],
        });
        await expect(hooks.emit("request", {})).rejects.toThrow(
            'Hook "request" is not allowed',
        );
    });
});
