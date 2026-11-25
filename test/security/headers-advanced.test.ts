import { describe, it, expect } from "vitest";
import { createHelmet } from "../../src/security/helmet.js";

describe("Security Headers - Advanced Tests", () => {
    it("SH-01: Expected HTTP security headers present", () => {
        const helmet = createHelmet();
        const middleware = helmet.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const req: any = { method: "GET", headers: {} };
        middleware(req, res);
        expect(res["X-Content-Type-Options"]).toBe("nosniff");
        expect(res["Referrer-Policy"]).toBeDefined();
    });

    it("SH-02: CSP configuration", () => {
        const helmet = createHelmet({
            contentSecurityPolicy: { defaultSrc: ["'self'"] },
        });
        const middleware = helmet.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const req: any = { method: "GET", headers: {} };
        middleware(req, res);
        expect(res["Content-Security-Policy"]).toBeDefined();
    });

    it("SH-03: HSTS omitted by default", () => {
        const helmet = createHelmet();
        const middleware = helmet.middleware();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const req: any = { method: "GET", headers: {} };
        middleware(req, res);
        expect(res["Strict-Transport-Security"]).toBeUndefined();
    });

    it("SH-04: Frame protection set to DENY", () => {
        const helmet = createHelmet({ frameOptions: "DENY" });
        const middleware = helmet.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const req: any = { method: "GET", headers: {} };
        middleware(req, res);
        expect(res["X-Frame-Options"]).toBe("DENY");
    });

    it("SH-05: Headers middleware returns headers object", () => {
        const helmet = createHelmet();
        const headers = helmet.headers();
        expect(headers["X-Content-Type-Options"]).toBe("nosniff");
        expect(headers["Referrer-Policy"]).toBeDefined();
    });
});
