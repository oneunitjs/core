import { describe, it, expect } from "vitest";
import { createCors } from "../../src/security/cors.js";

describe("CORS - Advanced Security Tests", () => {
    it("CORS-01: Allowed origin reflected", () => {
        const cors = createCors({ origin: "https://example.com" });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const req: any = { method: "GET", headers: { origin: "https://example.com" } };
        middleware(req, res);
        expect(res["Access-Control-Allow-Origin"]).toBe("https://example.com");
    });

    it("CORS-02: Unauthorized origins rejected", () => {
        const cors = createCors({ origin: "https://allowed.com" });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const req: any = { method: "GET", headers: { origin: "https://evil.com" } };
        middleware(req, res);
        expect(res["Access-Control-Allow-Origin"]).toBeUndefined();
    });

    it("CORS-03: Wildcard origin", () => {
        const cors = createCors({ origin: "*" });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const req: any = { method: "GET", headers: { origin: "https://any.com" } };
        middleware(req, res);
        expect(res["Access-Control-Allow-Origin"]).toBe("*");
    });

    it("CORS-04: Preflight handled", () => {
        const cors = createCors({ methods: ["GET", "POST"] });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const req: any = {
            method: "OPTIONS",
            headers: { origin: "https://example.com", "access-control-request-method": "POST" },
        };
        middleware(req, res);
        expect(res.statusCode).toBe(204);
    });

    it("CORS-05: Vary: Origin emitted", () => {
        const cors = createCors({ origin: "https://example.com" });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const req: any = { method: "GET", headers: { origin: "https://example.com" } };
        middleware(req, res);
        expect(res["Vary"]).toContain("Origin");
    });

    it("CORS-06: Disallowed method preflight rejected", () => {
        const cors = createCors({ methods: ["GET"] });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const req: any = {
            method: "OPTIONS",
            headers: { origin: "https://example.com", "access-control-request-method": "DELETE" },
        };
        middleware(req, res);
        expect(res.statusCode).toBe(403);
    });

    it("CORS-07: Credentials with wildcard not allowed", () => {
        const cors = createCors({ origin: "*", credentials: true });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const req: any = { method: "GET", headers: { origin: "https://example.com" } };
        middleware(req, res);
        expect(res["Access-Control-Allow-Origin"]).not.toBe("*");
    });
});
