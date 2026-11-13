import { describe, it, expect } from "vitest";
import { createCsrf } from "../../src/security/csrf.js";

describe("createCsrf", () => {
    it("creates CSRF middleware with token", () => {
        const csrf = createCsrf();
        expect(csrf.enabled).toBe(true);
        expect(typeof csrf.generateToken()).toBe("string");
    });

    it("validates tokens", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        expect(csrf.validateToken(token)).toBe(true);
        expect(csrf.validateToken("wrong")).toBe(false);
    });

    it("extracts token from request headers", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        const req: any = { headers: { "x-csrf-token": token } };
        const extracted = csrf.getTokenFromRequest(req);
        expect(extracted).toBe(token);
    });

    it("extracts token from request body", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        const req: any = { headers: {}, body: { _csrf: token } };
        const extracted = csrf.getTokenFromRequest(req);
        expect(extracted).toBe(token);
    });

    it("middleware rejects missing token", () => {
        const csrf = createCsrf();
        const middleware = csrf.middleware();
        const res: any = {
            statusCode: 200,
            setHeader: () => {},
            end: (data: string) => {
                res.body = data;
            },
        };
        const req: any = { method: "POST", headers: {}, body: {} };

        middleware(req, res);

        expect(res.statusCode).toBe(403);
        expect(res.body).toContain("CSRF");
    });

    it("middleware allows valid token", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        const middleware = csrf.middleware();
        const res: any = {
            statusCode: 200,
            setHeader: () => {},
            end: () => {},
        };
        const req: any = { method: "POST", headers: { "x-csrf-token": token }, body: {} };

        middleware(req, res);

        expect(res.statusCode).toBe(200);
    });

    it("skips GET requests", () => {
        const csrf = createCsrf();
        const middleware = csrf.middleware();
        const res: any = {
            statusCode: 200,
            setHeader: () => {},
            end: () => {},
        };
        const req: any = { method: "GET", headers: {} };

        middleware(req, res);

        expect(res.statusCode).toBe(200);
    });

    it("generates cryptographically random tokens (not Math.random)", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        // Crypto random tokens are 64 hex chars (32 bytes)
        expect(token).toMatch(/^[0-9a-f]{64}$/);
        // Two tokens should not be equal
        expect(csrf.generateToken()).not.toBe(token);
    });

    it("rejects tokens of different length (timing-safe compare)", () => {
        const csrf = createCsrf();
        const token = csrf.generateToken();
        expect(csrf.validateToken("short")).toBe(false);
        expect(csrf.validateToken(token + "extra")).toBe(false);
    });

    it("middlewareWithToken rejects when cookie token missing", () => {
        const csrf = createCsrf();
        const middleware = csrf.middlewareWithToken();
        const res: any = {
            statusCode: 200,
            setHeader: () => {},
            end: (data: string) => {
                res.body = data;
            },
        };
        const req: any = { method: "POST", headers: { "x-csrf-token": "sometoken" }, cookie: "" };

        middleware(req, res);

        expect(res.statusCode).toBe(403);
    });

    it("middlewareWithToken rejects when cookie and header tokens differ", () => {
        const csrf = createCsrf();
        const middleware = csrf.middlewareWithToken();
        const res: any = {
            statusCode: 200,
            setHeader: () => {},
            end: () => {},
        };
        const tokenA = csrf.generateToken();
        const tokenB = csrf.generateToken();
        const req: any = {
            method: "POST",
            headers: { "x-csrf-token": tokenA, cookie: `_csrf=${tokenB}` },
        };

        middleware(req, res);

        expect(res.statusCode).toBe(403);
    });

    it("middlewareWithToken allows when cookie and header tokens match", () => {
        const csrf = createCsrf();
        const middleware = csrf.middlewareWithToken();
        const res: any = {
            statusCode: 200,
            setHeader: (key: string, value: string) => {
                res[key] = value;
            },
            end: () => {},
        };
        const token = csrf.generateToken();
        const req: any = {
            method: "POST",
            headers: { "x-csrf-token": token, cookie: `_csrf=${token}` },
        };

        middleware(req, res);

        expect(res.statusCode).toBe(200);
        expect(res["Set-Cookie"]).toContain("_csrf=");
        expect(res["Set-Cookie"]).toContain("HttpOnly");
        expect(res["Set-Cookie"]).toContain("SameSite=lax");
    });

    it("middlewareWithToken sets Secure flag in production", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        try {
            const csrf = createCsrf({ cookieOptions: { secure: true } });
            const middleware = csrf.middlewareWithToken();
            const res: any = {
                statusCode: 200,
                setHeader: (key: string, value: string) => {
                    res[key] = value;
                },
                end: () => {},
            };
            const token = csrf.generateToken();
            const req: any = {
                method: "POST",
                headers: { "x-csrf-token": token, cookie: `_csrf=${token}` },
            };

            middleware(req, res);

            expect(res["Set-Cookie"]).toContain("Secure");
        } finally {
            process.env.NODE_ENV = originalEnv;
        }
    });
});
