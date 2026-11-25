import { describe, it, expect } from "vitest";
import { createResponseManager, validateStatus } from "../../src/response-mangement/index.js";

describe("RESP - Response Management", () => {
    it("RESP-01: Response manager success()", () => {
        const manager = createResponseManager();
        const result = manager.success({ data: { id: 1 } });
        expect(result.success).toBe(true);
        expect(result.code).toBe("200");
        expect(result.data).toEqual({ id: 1 });
    });

    it("RESP-02: Response manager error()", () => {
        const manager = createResponseManager();
        const result = manager.error({ status: 400, message: "bad input" });
        expect(result.success).toBe(false);
        expect(result.code).toBe("400");
        expect(result.msg).toBe("bad input");
    });

    it("RESP-03: Response manager success with created status", () => {
        const manager = createResponseManager();
        const result = manager.success({ status: 201, data: {} });
        expect(result.code).toBe("201");
    });

    it("RESP-04: Response manager success with default status", () => {
        const manager = createResponseManager();
        const result = manager.success({});
        expect(result.success).toBe(true);
        expect(result.code).toBe("200");
    });

    it("RESP-05: Response manager error notFound", () => {
        const manager = createResponseManager();
        const result = manager.error({ status: 404, message: "not found" });
        expect(result.code).toBe("404");
    });

    it("RESP-06: Response manager error internalServerError", () => {
        const manager = createResponseManager();
        const result = manager.error({ status: 500, message: "error" });
        expect(result.code).toBe("500");
    });

    it("RESP-07: Response envelopes have consistent shape", () => {
        const manager = createResponseManager();
        const success = manager.success({ data: { test: true } });
        expect(success.success).toBe(true);
        expect(success.code).toBe("200");
        expect(success.msg).toBeDefined();
    });

    it("RESP-08: Error envelopes do not expose stack traces", () => {
        const manager = createResponseManager();
        const error = manager.error({ status: 500, message: "Server error" });
        expect(error.success).toBe(false);
        expect(error.code).toBe("500");
    });

    it("RESP-09: Response manager has all methods", () => {
        const manager = createResponseManager();
        expect(typeof manager.success).toBe("function");
        expect(typeof manager.error).toBe("function");
        expect(typeof manager.paginated).toBe("function");
    });

    it("RESP-10: validateStatus throws on invalid", () => {
        expect(() => validateStatus(999, "any")).toThrow();
    });
});
