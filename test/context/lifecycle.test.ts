import { describe, expect, it } from "vitest";

import { createRequestContext } from "../../src/context/registry.js";

interface ContextSchema {
    requestId: string;
    userId?: string;
    clientIp?: string;
}

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

describe("context lifecycle", () => {
    it("should propagate thrown errors", async () => {
        const ctx = createRequestContext<ContextSchema>();
        await expect(
            ctx.run(async () => {
                ctx.set("requestId", "req-1");
                throw new Error("Request failed");
            })
        ).rejects.toThrow("Request failed");
    });

    it("should propagate rejected promises", async () => {
        const ctx = createRequestContext<ContextSchema>();
        await expect(
            ctx.run(async () => {
                return Promise.reject(new Error("boom"));
            })
        ).rejects.toThrow("boom");
    });

    it("should support synchronous callback results", async () => {
        const ctx = createRequestContext<ContextSchema>();
        const result = await ctx.run(() => {
            ctx.set("requestId", "sync");
            return ctx.get("requestId");
        });
        expect(result).toBe("sync");
    });

    it("should retain context in detached async tasks", async () => {
        const ctx = createRequestContext<ContextSchema>();
        const observed = await ctx.run(async () => {
            ctx.set("requestId", "detached");
            await delay(5);
            return ctx.get("requestId");
        });
        expect(observed).toBe("detached");
    });
});
