import { describe, it, expect } from "vitest";
import { createHelmet } from "../../src/security/helmet.js";

describe("createHelmet", () => {
    it("creates helmet middleware with defaults", () => {
        const helmet = createHelmet();
        expect(helmet.enabled).toBe(true);
    });

    it("enables and disables", () => {
        const helmet = createHelmet();
        helmet.disable();
        expect(helmet.enabled).toBe(false);
        helmet.enable();
        expect(helmet.enabled).toBe(true);
        helmet.toggle();
        expect(helmet.enabled).toBe(false);
    });

    it("sets security headers", () => {
        const helmet = createHelmet();
        const headers = helmet.headers();
        expect(headers["X-Content-Type-Options"]).toBe("nosniff");
        expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
        expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
        expect(headers["Referrer-Policy"]).toBe("no-referrer");
    });

    it("middleware sets headers on response", () => {
        const helmet = createHelmet();
        const middleware = helmet.middleware();
        const res: any = {
            setHeader: (key: string, value: string) => {
                res[key] = value;
            },
        };
        const req: any = {};

        middleware(req, res);

        expect(res["X-Content-Type-Options"]).toBe("nosniff");
        expect(res["X-Frame-Options"]).toBe("SAMEORIGIN");
    });

    it("custom CSP policy", () => {
        const helmet = createHelmet({
            contentSecurityPolicy: {
                "default-src": ["'self'"],
                "script-src": ["'self'", "https://trusted.com"],
            },
        });
        const headers = helmet.headers();
        expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
        expect(headers["Content-Security-Policy"]).toContain("script-src 'self' https://trusted.com");
    });

    it("custom HSTS", () => {
        const helmet = createHelmet({
            hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
        });
        const headers = helmet.headers();
        expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000");
        expect(headers["Strict-Transport-Security"]).toContain("includeSubDomains");
        expect(headers["Strict-Transport-Security"]).toContain("preload");
    });
});
