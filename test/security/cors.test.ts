import { describe, it, expect } from "vitest";
import { createCors } from "../../src/security/cors.js";

describe("createCors", () => {
    it("creates CORS middleware with defaults", () => {
        const cors = createCors();
        expect(cors.enabled).toBe(true);
        expect(cors.options.origin).toBe("*");
    });

    it("enables and disables", () => {
        const cors = createCors();
        cors.disable();
        expect(cors.enabled).toBe(false);
        cors.enable();
        expect(cors.enabled).toBe(true);
        cors.toggle();
        expect(cors.enabled).toBe(false);
    });

    it("middleware sets CORS headers", () => {
        const cors = createCors({ origin: "https://example.com" });
        const middleware = cors.middleware();
        const res: any = {
            setHeader: (key: string, value: string) => {
                res[key] = value;
            },
            end: () => {},
        };
        const req: any = { method: "GET" };

        middleware(req, res);

        expect(res["Access-Control-Allow-Origin"]).toBe("https://example.com");
        expect(res["Access-Control-Allow-Methods"]).toContain("GET");
    });

    it("handles OPTIONS preflight", () => {
        const cors = createCors();
        const middleware = cors.middleware();
        const res: any = {
            statusCode: 200,
            setHeader: (key: string, value: string) => {
                res[key] = value;
            },
            end: () => {},
        };
        const req: any = { method: "OPTIONS" };

        middleware(req, res);

        expect(res.statusCode).toBe(204);
    });

    it("returns headers object", () => {
        const cors = createCors({ origin: "https://example.com" });
        const headers = cors.headers();
        expect(headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
    });

    it("rejects disallowed origin on preflight", () => {
        const cors = createCors({ origin: "https://allowed.com" });
        const middleware = cors.middleware();
        const res: any = {
            statusCode: 200,
            setHeader: (key: string, value: string) => {
                res[key] = value;
            },
            end: (data: string) => {
                res.body = data;
            },
        };
        const req: any = { method: "OPTIONS", headers: { origin: "https://evil.com" } };

        middleware(req, res);

        expect(res.statusCode).toBe(403);
        expect(res.body).toContain("CORS");
    });

    it("allows origin from array allowlist", () => {
        const cors = createCors({ origin: ["https://a.com", "https://b.com"] });
        const middleware = cors.middleware();
        const res: any = {
            statusCode: 200,
            setHeader: (key: string, value: string) => {
                res[key] = value;
            },
            end: () => {},
        };
        const req: any = { method: "GET", headers: { origin: "https://a.com" } };

        middleware(req, res);

        expect(res["Access-Control-Allow-Origin"]).toBe("https://a.com");
    });

    it("reflects request origin when credentials enabled and origin is *", () => {
        const cors = createCors({ origin: "*", credentials: true });
        const middleware = cors.middleware();
        const res: any = {
            statusCode: 200,
            setHeader: (key: string, value: string) => {
                res[key] = value;
            },
            end: () => {},
        };
        const req: any = { method: "GET", headers: { origin: "https://client.com" } };

        middleware(req, res);

        expect(res["Access-Control-Allow-Origin"]).toBe("https://client.com");
        expect(res["Access-Control-Allow-Credentials"]).toBe("true");
    });

    it("denies request with no origin when origin is not *", () => {
        const cors = createCors({ origin: "https://allowed.com" });
        const middleware = cors.middleware();
        const res: any = {
            statusCode: 200,
            setHeader: (key: string, value: string) => {
                res[key] = value;
            },
            end: (data: string) => {
                res.body = data;
            },
        };
        const req: any = { method: "OPTIONS", headers: {} };

        middleware(req, res);

        expect(res.statusCode).toBe(403);
    });
});
