import { describe, it, expect } from "vitest";
import { createRequestContext } from "../../src/context/registery.js";

describe("createRequestContext", () => {
    it("should create a context instance", () => {
        const ctx = createRequestContext();
        expect(ctx).toBeDefined();
        expect(typeof ctx.get).toBe("function");
        expect(typeof ctx.set).toBe("function");
        expect(typeof ctx.delete).toBe("function");
        expect(typeof ctx.has).toBe("function");
        expect(typeof ctx.getAll).toBe("function");
        expect(typeof ctx.clear).toBe("function");
        expect(typeof ctx.isActive).toBe("function");
        expect(typeof ctx.run).toBe("function");
        expect(typeof ctx.runWithValues).toBe("function");
    });

    it("should return undefined for get when no context is active", () => {
        const ctx = createRequestContext();
        expect(ctx.get("nonexistent")).toBeUndefined();
        expect(ctx.get("anything")).toBeUndefined();
    });

    it("should return false for set when no context is active", () => {
        const ctx = createRequestContext();
        const result = ctx.set("key", "value");
        expect(result).toBe(false);
    });

    it("should return false for delete when no context is active", () => {
        const ctx = createRequestContext();
        const result = ctx.delete("key");
        expect(result).toBe(false);
    });

    it("should return false for has when no context is active", () => {
        const ctx = createRequestContext();
        expect(ctx.has("key")).toBe(false);
    });

    it("should return empty object for getAll when no context is active", () => {
        const ctx = createRequestContext();
        expect(ctx.getAll()).toEqual({});
    });

    it("should not throw on clear when no context is active", () => {
        const ctx = createRequestContext();
        expect(() => ctx.clear()).not.toThrow();
    });

    it("should return false for isActive when no context is active", () => {
        const ctx = createRequestContext();
        expect(ctx.isActive()).toBe(false);
    });
});

describe("createRequestContext - run()", () => {
    it("should run function within context", async () => {
        const ctx = createRequestContext();
        const result = await ctx.run(async () => {
            ctx.set("key", "value");
            return ctx.get("key");
        });
        expect(result).toBe("value");
    });

    it("should preserve context within same run callback", async () => {
        const ctx = createRequestContext();
        const inner: string[] = [];
        await ctx.run(async () => {
            ctx.set("userId", "user-123");
            // Inner run creates new context - pass value explicitly
            const currentVal = ctx.get("userId");
            await ctx.runWithValues({ userId: currentVal }, async () => {
                inner.push(ctx.get("userId") as string);
            });
        });
        expect(inner).toEqual(["user-123"]);
    });

    it("should run multiple operations within same context", async () => {
        const ctx = createRequestContext();
        const all = await ctx.run(async () => {
            ctx.set("a", "1");
            ctx.set("b", "2");
            ctx.set("c", "3");
            return ctx.getAll();
        });
        expect(all).toEqual({ a: "1", b: "2", c: "3" });
    });

    it("should run multiple operations within same runWithValues", async () => {
        const ctx = createRequestContext();
        const all = await ctx.runWithValues({ a: "1", b: "2", c: "3" }, async () => ctx.getAll());
        expect(all).toEqual({ a: "1", b: "2", c: "3" });
    });
});

describe("createRequestContext - runWithValues()", () => {
    it("should run with initial values", async () => {
        const ctx = createRequestContext();
        const result = await ctx.runWithValues(
            { key1: "val1", key2: "val2" },
            async () => {
                return { a: ctx.get("key1"), b: ctx.get("key2") };
            },
        );
        expect(result).toEqual({ a: "val1", b: "val2" });
    });

    it("should isolate runWithValues calls", async () => {
        const ctx = createRequestContext();
        await ctx.runWithValues({ key: "first" }, async () => {
            const inner = await ctx.runWithValues({ key: "first" }, async () => ctx.get("key"));
            expect(inner).toBe("first");
        });
        const result = await ctx.run(async () => ctx.get("key"));
        expect(result).toBeUndefined();
    });

    it("should allow nested runWithValues calls", async () => {
        const ctx = createRequestContext();
        const outer: string[] = [];
        await ctx.runWithValues({ level: "outer" }, async () => {
            outer.push(ctx.get("level") as string);
            await ctx.runWithValues({ level: "inner" }, async () => {
                outer.push(ctx.get("level") as string);
            });
            outer.push(ctx.get("level") as string);
        });
        expect(outer).toEqual(["outer", "inner", "outer"]);
    });
});
