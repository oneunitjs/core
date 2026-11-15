import { describe, expect, it } from "vitest";

import { createRequestContext } from "../../src/context/registry.js";
import type { RequestContext } from "../../src/context/types.js";

interface ContextSchema {
    requestId: string;
    userId?: string;
    clientIp?: string;
}

describe("createRequestContext", () => {
    it("should create a context instance", () => {
        const ctx = createRequestContext<ContextSchema>();
        expect(ctx).toBeDefined();
    });

    it("should return undefined for get when no context is active", () => {
        const ctx = createRequestContext<ContextSchema>();
        expect(ctx.get("requestId")).toBeUndefined();
    });

    it("should return false for set when no context is active", () => {
        const ctx = createRequestContext<ContextSchema>();
        expect(ctx.set("requestId", "req-1")).toBe(false);
    });

    it("should return false for delete when no context is active", () => {
        const ctx = createRequestContext<ContextSchema>();
        expect(ctx.delete("requestId")).toBe(false);
    });

    it("should return false for has when no context is active", () => {
        const ctx = createRequestContext<ContextSchema>();
        expect(ctx.has("requestId")).toBe(false);
    });

    it("should return empty object for getAll when no context is active", () => {
        const ctx = createRequestContext<ContextSchema>();
        expect(ctx.getAll()).toEqual({});
    });

    it("should be a no-op for clear when no context is active", () => {
        const ctx = createRequestContext<ContextSchema>();
        expect(() => ctx.clear()).not.toThrow();
    });

    it("should report isActive based on execution boundary", () => {
        const ctx = createRequestContext<ContextSchema>();
        expect(ctx.isActive()).toBe(false);
    });

    it("should run function within context", async () => {
        const ctx = createRequestContext<ContextSchema>();
        const result = await ctx.run(async () => {
            ctx.set("requestId", "value");
            return ctx.get("requestId");
        });
        expect(result).toBe("value");
    });

    it("should pass values to context", async () => {
        const ctx = createRequestContext<ContextSchema>();
        const result = await ctx.run(
            async () => ctx.get("userId"),
            { userId: "user-123" }
        );
        expect(result).toBe("user-123");
    });

    it("should seed initialValues into each run", async () => {
        const ctx = createRequestContext<ContextSchema>({
            initialValues: { requestId: "req-default" },
        });
        const result = await ctx.run(async () => ctx.get("requestId"));
        expect(result).toBe("req-default");
    });

    it("should let run values override initialValues", async () => {
        const ctx = createRequestContext<ContextSchema>({
            initialValues: { requestId: "req-default" },
        });
        const result = await ctx.run(
            async () => ctx.get("requestId"),
            { requestId: "req-override" }
        );
        expect(result).toBe("req-override");
    });

    it("should not leak state between multiple instances", async () => {
        const ctxA = createRequestContext<ContextSchema>();
        const ctxB = createRequestContext<ContextSchema>();
        let resultB: string | undefined;
        await ctxA.run(async () => {
            ctxA.set("requestId", "instance-A");
            resultB = await ctxB.run(async () => {
                ctxB.set("requestId", "instance-B");
                return ctxB.get("requestId");
            });
            expect(ctxA.get("requestId")).toBe("instance-A");
        });
        expect(resultB).toBe("instance-B");
    });

    it("should be typed with a context schema", async () => {
        const ctx: RequestContext<ContextSchema> =
            createRequestContext<ContextSchema>();
        const id: string | undefined = ctx.get("requestId");
        expect(typeof id === "string" || id === undefined).toBe(true);
        const setOk: boolean = ctx.set("userId", "u-1");
        expect(setOk).toBe(false);
    });
});
