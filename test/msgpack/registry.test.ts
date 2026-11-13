import { describe, it, expect, beforeEach } from "vitest";
import { createMsgPack } from "../../src/msgpack/index.js";

describe("MsgPack - Encode/Decode", () => {
    let msgpack: ReturnType<typeof createMsgPack>;

    beforeEach(() => { msgpack = createMsgPack(); });

    it("should encode and decode string", () => {
        const bytes = msgpack.encode("hello");
        const decoded = msgpack.decode(bytes);
        expect(decoded).toBe("hello");
    });

    it("should encode and decode number", () => {
        const bytes = msgpack.encode(42);
        const decoded = msgpack.decode(bytes);
        expect(decoded).toBe(42);
    });

    it("should encode and decode boolean", () => {
        const bytes = msgpack.encode(true);
        const decoded = msgpack.decode(bytes);
        expect(decoded).toBe(true);
    });

    it("should encode and decode null", () => {
        const bytes = msgpack.encode(null);
        const decoded = msgpack.decode(bytes);
        expect(decoded).toBeNull();
    });

    it("should encode and decode object", () => {
        const obj = { name: "John", age: 30, active: true };
        const bytes = msgpack.encode(obj);
        const decoded = msgpack.decode<{ name: string; age: number; active: boolean }>(bytes);
        expect(decoded.name).toBe("John");
        expect(decoded.age).toBe(30);
        expect(decoded.active).toBe(true);
    });

    it("should encode and decode nested object", () => {
        const obj = { user: { name: "John", address: { city: "NYC" } } };
        const bytes = msgpack.encode(obj);
        const decoded = msgpack.decode(bytes);
        expect(decoded.user.name).toBe("John");
        expect(decoded.user.address.city).toBe("NYC");
    });

    it("should encode and decode array", () => {
        const arr = [1, 2, 3, 4, 5];
        const bytes = msgpack.encode(arr);
        const decoded = msgpack.decode<number[]>(bytes);
        expect(decoded).toEqual([1, 2, 3, 4, 5]);
    });

    it("should encode and decode mixed array", () => {
        const arr = [1, "hello", true, null, { nested: true }];
        const bytes = msgpack.encode(arr);
        const decoded = msgpack.decode(bytes);
        expect(decoded[0]).toBe(1);
        expect(decoded[1]).toBe("hello");
        expect(decoded[2]).toBe(true);
        expect(decoded[3]).toBeNull();
        expect(decoded[4].nested).toBe(true);
    });

    it("should encode and decode empty object", () => {
        const bytes = msgpack.encode({});
        const decoded = msgpack.decode(bytes);
        expect(decoded).toEqual({});
    });

    it("should encode and decode empty array", () => {
        const bytes = msgpack.encode([]);
        const decoded = msgpack.decode(bytes);
        expect(decoded).toEqual([]);
    });

    it("should encode and decode empty string", () => {
        const bytes = msgpack.encode("");
        const decoded = msgpack.decode(bytes);
        expect(decoded).toBe("");
    });

    it("should encode and decode zero", () => {
        const bytes = msgpack.encode(0);
        const decoded = msgpack.decode(bytes);
        expect(decoded).toBe(0);
    });

    it("should encode and decode negative number", () => {
        const bytes = msgpack.encode(-42);
        const decoded = msgpack.decode(bytes);
        expect(decoded).toBe(-42);
    });

    it("should encode and decode float", () => {
        const bytes = msgpack.encode(3.14);
        const decoded = msgpack.decode(bytes);
        expect(decoded).toBeCloseTo(3.14);
    });

    it("should encode and decode unicode string", () => {
        const bytes = msgpack.encode("こんにちは");
        const decoded = msgpack.decode(bytes);
        expect(decoded).toBe("こんにちは");
    });

    it("should encode and decode nested arrays", () => {
        const arr = [[1, 2], [3, 4], [5, 6]];
        const bytes = msgpack.encode(arr);
        const decoded = msgpack.decode<number[][]>(bytes);
        expect(decoded).toEqual([[1, 2], [3, 4], [5, 6]]);
    });
});

describe("MsgPack - Sync Encode/Decode", () => {
    let msgpack: ReturnType<typeof createMsgPack>;

    beforeEach(() => { msgpack = createMsgPack(); });

    it("should encode and decode synchronously", () => {
        const bytes = msgpack.encodeSync({ hello: "world" });
        const decoded = msgpack.decodeSync<{ hello: string }>(bytes);
        expect(decoded.hello).toBe("world");
    });
});

describe("MsgPack - Round-trip Consistency", () => {
    it("should maintain data integrity through multiple encode/decode cycles", () => {
        const msgpack = createMsgPack();
        const original = { user: { id: 1, name: "Test", tags: ["a", "b", "c"] }, active: true };
        let current = original;
        for (let i = 0; i < 5; i++) {
            const bytes = msgpack.encode(current);
            current = msgpack.decode(bytes);
        }
        expect(current.user.id).toBe(1);
        expect(current.user.name).toBe("Test");
        expect(current.user.tags).toEqual(["a", "b", "c"]);
        expect(current.active).toBe(true);
    });
});
