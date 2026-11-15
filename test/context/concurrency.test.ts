import { describe, expect, it } from "vitest";

import { createRequestContext } from "../../src/context/registry.js";

interface ContextSchema {
    requestId: string;
    userId?: string;
    clientIp?: string;
}

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

describe("context concurrency", () => {
    it("should isolate concurrent requests", async () => {
        const ctx = createRequestContext<ContextSchema>();
        const [first, second] = await Promise.all([
            ctx.run(async () => {
                ctx.set("requestId", "request-A");
                await delay(20);
                return ctx.get("requestId");
            }),
            ctx.run(async () => {
                ctx.set("requestId", "request-B");
                await delay(10);
                return ctx.get("requestId");
            })
        ]);
        expect(first).toBe("request-A");
        expect(second).toBe("request-B");
    });
});
