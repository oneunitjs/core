import { describe, expect, it } from "vitest";

import { createRequestContext } from "../../src/context/registry.js";

interface ContextSchema {
    requestId: string;
    userId?: string;
    clientIp?: string;
    timestamp?: string | number;
}

describe("context timestamp", () => {
    it("should apply autoTimestamp in iso format by default", async () => {
        const ctx = createRequestContext<ContextSchema>({
            autoTimestamp: true,
        });
        await ctx.run(async () => {
            const ts = ctx.get("timestamp");
            expect(typeof ts).toBe("string");
            expect(String(ts)).toMatch(/\d{4}-\d{2}-\d{2}T/);
        });
    });

    it("should apply autoTimestamp in unix format", async () => {
        const ctx = createRequestContext<ContextSchema>({
            autoTimestamp: true,
            timestampFormat: "unix",
        });
        await ctx.run(async () => {
            const ts = ctx.get("timestamp");
            expect(typeof ts).toBe("number");
        });
    });

    it("should apply autoTimestamp in unix-ms format", async () => {
        const ctx = createRequestContext<ContextSchema>({
            autoTimestamp: true,
            timestampFormat: "unix-ms",
        });
        await ctx.run(async () => {
            const ts = ctx.get("timestamp");
            expect(typeof ts).toBe("number");
            expect(ts).toBeGreaterThan(1_000_000_000_000);
        });
    });

    it("should use custom timestampKey", async () => {
        const ctx = createRequestContext<ContextSchema>({
            autoTimestamp: true,
            timestampKey: "requestTime",
        });
        await ctx.run(async () => {
            expect(ctx.get("requestTime")).toBeDefined();
            expect(ctx.get("timestamp")).toBeUndefined();
        });
    });

    it("should let run values override autoTimestamp", async () => {
        const ctx = createRequestContext<ContextSchema>({
            autoTimestamp: true,
        });
        await ctx.run(
            async () => {
                expect(ctx.get("timestamp")).toBe("explicit");
            },
            { timestamp: "explicit" }
        );
    });
});
