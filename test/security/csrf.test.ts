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
});
