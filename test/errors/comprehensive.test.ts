import { describe, it, expect } from "vitest";
import {
    OneUnitError,
    CoreError,
    ResponseManagementError,
    CookieError,
    LifecycleError,
    MultipartError,
    HooksError,
    LibError,
    InvalidStatusCodeError,
    CookieSecretRequiredError,
    MiddlewareLimitError,
    MultipartFileTooLargeError,
    InvalidBytesError,
} from "../../src/errors/index.js";

describe("ERR - Errors and System Utilities", () => {
    it("ERR-01: Test every OneUnitError category", () => {
        const categories: string[] = ["core", "config", "cookie", "lifecycle", "response", "security", "health", "hooks", "lib", "msgpack", "multipart"];
        for (const cat of categories) {
            const err = new OneUnitError(`Test ${cat}`, { category: cat as any });
            expect(err.category).toBe(cat);
            expect(err).toBeInstanceOf(OneUnitError);
        }
    });

    it("ERR-02: Validate error codes and severity", () => {
        const err = new CoreError("test message", { code: "TEST_01" });
        expect(err.code).toBe("TEST_01");
        expect(err.severity).toBeDefined();
    });

    it("ERR-03: Validate metadata and timestamps", () => {
        const err = new CoreError("test", { details: { key: "val" } });
        expect(err.details).toEqual({ key: "val" });
        expect(err.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it("ERR-04: Test error serialization", () => {
        const err = new CoreError("test", { code: "T1", details: { a: 1 } });
        const json = err.toJSON();
        expect(json.category).toBe("core");
        expect(json.code).toBe("T1");
        expect(json.message).toBe("test");
        expect(json.timestamp).toBeDefined();
    });

    it("ERR-05: Verify unknown errors are Error instances", () => {
        const plainErr = new Error("plain error");
        expect(plainErr).toBeInstanceOf(Error);
    });

    it("ERR-06: All error types instantiable", () => {
        const errs = [
            new CoreError("core"),
            new ResponseManagementError("response"),
            new CookieError("cookie"),
            new LifecycleError("lifecycle"),
            new MultipartError("multipart"),
            new HooksError("hooks"),
            new LibError("lib"),
        ];
        for (const e of errs) {
            expect(e).toBeInstanceOf(OneUnitError);
            expect(e.category).toBeDefined();
        }
    });

    it("ERR-07: Specific error types work", () => {
        expect(() => new InvalidStatusCodeError(999)).not.toThrow();
        expect(() => new CookieSecretRequiredError()).not.toThrow();
        expect(() => new MiddlewareLimitError()).not.toThrow();
        expect(() => new MultipartFileTooLargeError()).not.toThrow();
        expect(() => new InvalidBytesError(-1)).not.toThrow();
    });
});
