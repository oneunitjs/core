import { describe, it, expect } from "vitest";
import { createCsrf } from "../../src/security/csrf.js";

describe("CSRF - Token Generation", () => {
    it("should generate cryptographically random tokens", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        expect(token).toMatch(/^[0-9a-f]{64}$/);
        expect(csrf.generateToken()).not.toBe(token);
    });

    it("should generate unique tokens on each call", () => {
        const csrf = createCsrf();
        const token1 = csrf.generateToken();
        const token2 = csrf.generateToken();
        const token3 = csrf.generateToken();
        expect(token1).not.toBe(token2);
        expect(token2).not.toBe(token3);
        expect(token1).not.toBe(token3);
    });
});

describe("CSRF - Token Validation", () => {
    it("should validate a valid token", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        expect(csrf.validateToken(token)).toBe(true);
    });

    it("should reject empty token", () => {
        const csrf = createCsrf();
        expect(csrf.validateToken("")).toBe(false);
    });

    it("should reject undefined token", () => {
        const csrf = createCsrf();
        expect(csrf.validateToken(undefined as unknown as string)).toBe(false);
    });

    it("should reject tokens of different length", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        expect(csrf.validateToken("short")).toBe(false);
        expect(csrf.validateToken(token + "extra")).toBe(false);
    });

    it("should reject tampered tokens", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        const tampered = token.slice(0, 10) + "X" + token.slice(11);
        expect(csrf.validateToken(tampered)).toBe(false);
    });
});

describe("CSRF - Middleware Protection", () => {
    it("should skip GET requests", () => {
        const csrf = createCsrf();
        const middleware = csrf.middleware();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const req: any = { method: "GET", headers: {} };
        middleware(req, res);
        expect(res.statusCode).toBe(200);
    });

    it("should skip HEAD requests", () => {
        const csrf = createCsrf();
        const middleware = csrf.middleware();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const req: any = { method: "HEAD", headers: {} };
        middleware(req, res);
        expect(res.statusCode).toBe(200);
    });

    it("should skip OPTIONS requests", () => {
        const csrf = createCsrf();
        const middleware = csrf.middleware();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const req: any = { method: "OPTIONS", headers: {} };
        middleware(req, res);
        expect(res.statusCode).toBe(200);
    });

    it("should reject POST without CSRF token", () => {
        const csrf = createCsrf();
        const middleware = csrf.middleware();
        const res: any = {
            statusCode: 200,
            setHeader: () => {},
            end: (data: string) => { res.body = data; },
        };
        const req: any = { method: "POST", headers: {} };
        middleware(req, res);
        expect(res.statusCode).toBe(403);
        expect(res.body).toContain("CSRF");
    });

    it("should reject POST with invalid CSRF token", () => {
        const csrf = createCsrf();
        const middleware = csrf.middleware();
        const res: any = {
            statusCode: 200,
            setHeader: () => {},
            end: (data: string) => { res.body = data; },
        };
        const req: any = { method: "POST", headers: { "x-csrf-token": "invalid-token" } };
        middleware(req, res);
        expect(res.statusCode).toBe(403);
    });

    it("should allow POST with valid CSRF token", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        const middleware = csrf.middleware();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const req: any = { method: "POST", headers: { "x-csrf-token": token } };
        middleware(req, res);
        expect(res.statusCode).toBe(200);
    });

    it("should disable protection when disabled", () => {
        const csrf = createCsrf();
        csrf.disable();
        const middleware = csrf.middleware();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const req: any = { method: "POST", headers: {} };
        middleware(req, res);
        expect(res.statusCode).toBe(200);
    });

    it("should enable protection when re-enabled", () => {
        const csrf = createCsrf();
        csrf.disable();
        csrf.enable();
        const middleware = csrf.middleware();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const req: any = { method: "POST", headers: {} };
        middleware(req, res);
        expect(res.statusCode).toBe(403);
    });
});

describe("CSRF - Double Submit Cookie Pattern", () => {
    it("should reject when cookie token missing", () => {
        const csrf = createCsrf();
        const middleware = csrf.middlewareWithToken();
        const res: any = {
            statusCode: 200,
            setHeader: () => {},
            end: (data: string) => { res.body = data; },
        };
        const req: any = { method: "POST", headers: { "x-csrf-token": "sometoken", cookie: "" } };
        middleware(req, res);
        expect(res.statusCode).toBe(403);
    });

    it("should reject when cookie and header tokens differ", () => {
        const csrf = createCsrf();
        const middleware = csrf.middlewareWithToken();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const tokenA = csrf.generateToken();
        const tokenB = csrf.generateToken();
        const req: any = { method: "POST", headers: { "x-csrf-token": tokenA, cookie: `_csrf=${tokenB}` } };
        middleware(req, res);
        expect(res.statusCode).toBe(403);
    });

    it("should allow when cookie and header tokens match", () => {
        const csrf = createCsrf();
        const middleware = csrf.middlewareWithToken();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const token = csrf.generateToken();
        const req: any = { method: "POST", headers: { "x-csrf-token": token, cookie: `_csrf=${token}` } };
        middleware(req, res);
        expect(res.statusCode).toBe(200);
        expect(res["Set-Cookie"]).toContain("_csrf=");
        expect(res["Set-Cookie"]).toContain("HttpOnly");
        expect(res["Set-Cookie"]).toContain("SameSite=lax");
    });

    it("should set Secure flag in production", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        try {
            const csrf = createCsrf({ cookieOptions: { secure: true } });
            const middleware = csrf.middlewareWithToken();
            const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
            const token = csrf.generateToken();
            const req: any = { method: "POST", headers: { "x-csrf-token": token, cookie: `_csrf=${token}` } };
            middleware(req, res);
            expect(res["Set-Cookie"]).toContain("Secure");
        } finally {
            process.env.NODE_ENV = originalEnv;
        }
    });
});
