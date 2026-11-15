import { describe, expect, it } from "vitest";

import { createRequestContext } from "../../src/context/registry.js";

interface ContextSchema {
    requestId: string;
    userId?: string;
    clientIp?: string;
}

describe("context nested execution", () => {
    it("should isolate nested executions without inheritance", async () => {
        const ctx = createRequestContext<ContextSchema>();
        await ctx.run(async () => {
            ctx.set("requestId", "parent");
            await ctx.run(async () => {
                ctx.set("requestId", "child");
                expect(ctx.get("requestId")).toBe("child");
            });
            expect(ctx.get("requestId")).toBe("parent");
        });
    });
});
