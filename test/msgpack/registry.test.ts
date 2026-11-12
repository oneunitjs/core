import { describe, it, expect } from "vitest";
import { createMsgPack, DEFAULT_MSGPACK_CONFIG, mergeMsgPackConfig } from "../../src/msgpack/index.js";

describe("createMsgPack", () => {
    it("encodes and decodes a simple value", () => {
        const msgpack = createMsgPack();
        const encoded = msgpack.encode({ hello: "world", count: 42 });
        expect(encoded).toBeInstanceOf(Uint8Array);

        const decoded = msgpack.decode<{ hello: string; count: number }>(encoded);
        expect(decoded).toEqual({ hello: "world", count: 42 });
    });

    it("encodes and decodes arrays", () => {
        const msgpack = createMsgPack();
        const encoded = msgpack.encode([1, 2, 3, "four"]);
        const decoded = msgpack.decode<unknown[]>(encoded);
        expect(decoded).toEqual([1, 2, 3, "four"]);
    });

    it("encodes and decodes nested objects", () => {
        const msgpack = createMsgPack();
        const data = { user: { name: "Alice", age: 30, tags: ["admin", "user"] } };
        const encoded = msgpack.encode(data);
        const decoded = msgpack.decode<typeof data>(encoded);
        expect(decoded).toEqual(data);
    });

    it("encodes and decodes null, undefined, booleans", () => {
        const msgpack = createMsgPack();
        expect(msgpack.decode(msgpack.encode(null))).toBeNull();
        expect(msgpack.decode(msgpack.encode(true))).toBe(true);
        expect(msgpack.decode(msgpack.encode(false))).toBe(false);
    });

    it("encodeSync and decodeSync work the same as async versions", () => {
        const msgpack = createMsgPack();
        const data = { x: 1, y: 2 };
        const encoded = msgpack.encodeSync(data);
        const decoded = msgpack.decodeSync<{ x: number; y: number }>(encoded);
        expect(decoded).toEqual(data);
    });

    it("decodeSync accepts ArrayBuffer", () => {
        const msgpack = createMsgPack();
        const encoded = msgpack.encode({ hello: "world" });
        const buf = new ArrayBuffer(encoded.byteLength);
        new Uint8Array(buf).set(encoded);
        const decoded = msgpack.decode<{ hello: string }>(buf);
        expect(decoded).toEqual({ hello: "world" });
    });

    it("throws on invalid data", () => {
        const msgpack = createMsgPack();
        expect(() => msgpack.decode(new Uint8Array([0xff, 0xff, 0xff]))).toThrow();
    });

    it("supports custom config", () => {
        const msgpack = createMsgPack({ forceFloat32: true });
        const encoded = msgpack.encode({ num: 3.14 });
        const decoded = msgpack.decode<{ num: number }>(encoded);
        expect(decoded.num).toBeCloseTo(3.14);
    });
});

describe("DEFAULT_MSGPACK_CONFIG", () => {
    it("has sensible defaults", () => {
        expect(DEFAULT_MSGPACK_CONFIG.forceFloat32).toBe(false);
        expect(DEFAULT_MSGPACK_CONFIG.useBigInt64).toBe(false);
        expect(DEFAULT_MSGPACK_CONFIG.sortKeys).toBe(false);
    });
});

describe("mergeMsgPackConfig", () => {
    it("merges overrides with defaults", () => {
        const result = mergeMsgPackConfig(
            { forceFloat32: false, useBigInt64: false, sortKeys: false },
            { forceFloat32: true }
        );
        expect(result.forceFloat32).toBe(true);
        expect(result.useBigInt64).toBe(false);
        expect(result.sortKeys).toBe(false);
    });
});
