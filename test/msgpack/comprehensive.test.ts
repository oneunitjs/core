import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("MP - MessagePack", () => {
    it("MP-01: Encode and decode strings", () => {
        const app = createApp();
        const encoded = app.msgpack().encode("hello");
        const decoded = app.msgpack().decode(encoded);
        expect(decoded).toBe("hello");
    });

    it("MP-02: Encode and decode numbers", () => {
        const app = createApp();
        expect(app.msgpack().decode(app.msgpack().encode(42))).toBe(42);
        expect(app.msgpack().decode(app.msgpack().encode(3.14))).toBe(3.14);
    });

    it("MP-03: Test arrays and nested objects", () => {
        const app = createApp();
        const obj = [1, { a: [2, 3] }];
        const decoded = app.msgpack().decode(app.msgpack().encode(obj));
        expect(decoded).toEqual(obj);
    });

    it("MP-04: Test binary values", () => {
        const app = createApp();
        const bin = new Uint8Array([1, 2, 3, 255]);
        const decoded = app.msgpack().decode(app.msgpack().encode(bin));
        expect(Array.from(decoded as Uint8Array)).toEqual([1, 2, 3, 255]);
    });

    it("MP-05: Test null values", () => {
        const app = createApp();
        expect(app.msgpack().decode(app.msgpack().encode(null))).toBeNull();
    });

    it("MP-06: Test large payloads", () => {
        const app = createApp();
        const large = { data: "x".repeat(100 * 1024) };
        const decoded = app.msgpack().decode(app.msgpack().encode(large));
        expect(decoded.data).toBe(large.data);
    });

    it("MP-07: Test invalid encoded data throws error", () => {
        const app = createApp();
        expect(() => app.msgpack().decode(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toThrow();
    });

    it("MP-08: Test sync and async APIs equivalent", () => {
        const app = createApp();
        const obj = { test: true };
        const syncResult = app.msgpack().decodeSync(app.msgpack().encodeSync(obj));
        const asyncResult = app.msgpack().decode(app.msgpack().encode(obj));
        expect(syncResult).toEqual(asyncResult);
    });

    it("MP-09: Verify round-trip integrity", () => {
        const app = createApp();
        const values = [
            "string",
            42,
            3.14,
            null,
            true,
            [1, 2, 3],
            { a: 1, b: "c" },
            { nested: { deep: [true, false] } },
        ];
        for (const v of values) {
            const decoded = app.msgpack().decode(app.msgpack().encode(v));
            expect(decoded).toEqual(v);
        }
    });
});
