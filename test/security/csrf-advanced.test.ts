import { describe, it, expect } from "vitest";
import { createCsrf } from "../../src/security/csrf.js";

describe("CSRF - Advanced Security Tests", () => {
    it("CSRF-01: Generate valid tokens matching format", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        expect(token).toMatch(/^[0-9a-f]{64}\.[0-9a-f]{64}$/);
        expect(token.length).toBe(129);
    });

    it("CSRF-02: Validate matching tokens", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        expect(csrf.validateToken(token, token)).toBe(true);
    });

    it("CSRF-03: Reject missing tokens on unsafe methods", () => {
        const csrf = createCsrf();
        const middleware = csrf.middleware();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const req: any = { method: "POST", headers: {} };
        middleware(req, res);
        expect(res.statusCode).toBe(403);
    });

    it("CSRF-04: Reject invalid signatures", () => {
        const csrf = createCsrf();
        const middleware = csrf.middleware();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const req: any = { method: "POST", headers: { "x-csrf-token": "invalid" } };
        middleware(req, res);
        expect(res.statusCode).toBe(403);
    });

    it("CSRF-05: Reject tokens of wrong format", () => {
        const csrf = createCsrf();
        expect(csrf.validateToken("short")).toBe(false);
        expect(csrf.validateToken("")).toBe(false);
    });

    it("CSRF-06: Reject tampered tokens", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        const tampered = token.slice(0, 10) + "X" + token.slice(11);
        expect(csrf.validateToken(tampered)).toBe(false);
    });

    it("CSRF-07: Safe method middleware passes through", () => {
        const csrf = createCsrf();
        const middleware = csrf.middleware();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const req: any = { method: "GET", headers: {} };
        middleware(req, res);
        expect(res.statusCode).toBe(200);
    });

    it("CSRF-08: middlewareWithToken enforces double-submit", () => {
        const csrf = createCsrf();
        const middleware = csrf.middlewareWithToken();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const req: any = { method: "POST", headers: { "x-csrf-token": "token", cookie: "" } };
        middleware(req, res);
        expect(res.statusCode).toBe(403);
    });
});
