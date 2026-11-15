import { describe, expect, it } from "vitest";

import { createRequestContext } from "../../src/context/registry.js";

interface ContextSchema {
    requestId: string;
    userId?: string;
    clientIp?: string;
}

describe("context isolation", () => {
    it("should not leak initialValues outside run", async () => {
        const ctx = createRequestContext<ContextSchema>({
            initialValues: { requestId: "req-default" },
        });
        expect(ctx.get("requestId")).toBeUndefined();
    });

    it("should isolate context between runs", async () => {
        const ctx = createRequestContext<ContextSchema>();
        await ctx.run(async () => {
            ctx.set("requestId", "first");
        });
        const result = await ctx.run(async () => ctx.get("requestId"));
        expect(result).toBeUndefined();
    });

    it("should clear current context only", async () => {
        const ctx = createRequestContext<ContextSchema>();
        await ctx.run(async () => {
            ctx.set("requestId", "req-1");
            ctx.set("userId", "user-1");
            ctx.clear();
            expect(ctx.get("requestId")).toBeUndefined();
            expect(ctx.get("userId")).toBeUndefined();
            expect(ctx.isActive()).toBe(true);
        });
    });

    it("should return a shallow snapshot from getAll", async () => {
        const ctx = createRequestContext<ContextSchema>();
        await ctx.run(async () => {
            ctx.set("requestId", "req-1");
            const snapshot = ctx.getAll();
            snapshot.requestId = "modified";
            expect(ctx.get("requestId")).toBe("req-1");
        });
    });
});
