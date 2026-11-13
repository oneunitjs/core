import { describe, it, expect } from "vitest";
import { createRequestContext } from "../../src/context/registery.js";

describe("createRequestContext", () => {
    it("should create a context instance", () => {
        const ctx = createRequestContext();
        expect(ctx).toBeDefined();
    });

    it("should return undefined for get when no context is active", () => {
        const ctx = createRequestContext();
        expect(ctx.get("nonexistent")).toBeUndefined();
    });

    it("should return false for set when no context is active", () => {
        const ctx = createRequestContext();
        expect(ctx.set("key", "value")).toBe(false);
    });

    it("should run function within context", async () => {
        const ctx = createRequestContext();
        const result = await ctx.run(async () => {
            ctx.set("key", "value");
            return ctx.get("key");
        });
        expect(result).toBe("value");
    });

    it("should pass values to context", async () => {
        const ctx = createRequestContext();
        const result = await ctx.run(async () => {
            ctx.set("userId", "user-123");
            return ctx.get("userId");
        }, { userId: "user-123" });
        expect(result).toBe("user-123");
    });

    it("should isolate context between runs", async () => {
        const ctx = createRequestContext();
        await ctx.run(async () => {
            ctx.set("key", "first");
        });
        const result = await ctx.run(async () => {
            return ctx.get("key");
        });
        expect(result).toBeUndefined();
    });

    it("should disable all operations", async () => {
        const ctx = createRequestContext();
        ctx.disable();
        expect(ctx.set("key", "value")).toBe(false);
        expect(ctx.get("key")).toBeUndefined();

        const result = await ctx.run(async () => {
            ctx.set("key", "value");
            return ctx.get("key");
        });
        expect(result).toBeUndefined();
    });

    it("should enable after disable", async () => {
        const ctx = createRequestContext();
        ctx.disable();
        ctx.enable();
        const result = await ctx.run(async () => {
            ctx.set("key", "value");
            return ctx.get("key");
        });
        expect(result).toBe("value");
    });
});