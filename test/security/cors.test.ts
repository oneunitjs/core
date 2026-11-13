import { describe, it, expect } from "vitest";
import { createCors } from "../../src/security/cors.js";
import { createHelmet } from "../../src/security/helmet.js";
import { createCompression } from "../../src/security/compression.js";
import { createSanitizer } from "../../src/security/sanitize.js";

describe("CORS - Origin Validation", () => {
    it("should allow requests from allowed origin", () => {
        const cors = createCors({ origin: "https://allowed.com" });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const req: any = { method: "GET", headers: { origin: "https://allowed.com" } };
        middleware(req, res);
        expect(res["Access-Control-Allow-Origin"]).toBe("https://allowed.com");
    });

    it("should allow all origins when origin is *", () => {
        const cors = createCors({ origin: "*" });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const req: any = { method: "GET", headers: { origin: "https://any-site.com" } };
        middleware(req, res);
        expect(res["Access-Control-Allow-Origin"]).toBe("*");
    });

    it("should reject disallowed origin on preflight", () => {
        const cors = createCors({ origin: "https://allowed.com" });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: (d: string) => { res.body = d; } };
        const req: any = { method: "OPTIONS", headers: { origin: "https://evil.com" } };
        middleware(req, res);
        expect(res.statusCode).toBe(403);
        expect(res.body).toContain("CORS");
    });

    it("should allow origin from array allowlist", () => {
        const cors = createCors({ origin: ["https://a.com", "https://b.com"] });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const req: any = { method: "GET", headers: { origin: "https://a.com" } };
        middleware(req, res);
        expect(res["Access-Control-Allow-Origin"]).toBe("https://a.com");
    });

    it("should reflect request origin when credentials enabled and origin is *", () => {
        const cors = createCors({ origin: "*", credentials: true });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const req: any = { method: "GET", headers: { origin: "https://client.com" } };
        middleware(req, res);
        expect(res["Access-Control-Allow-Origin"]).toBe("https://client.com");
        expect(res["Access-Control-Allow-Credentials"]).toBe("true");
    });

    it("should deny request with no origin when origin is not *", () => {
        const cors = createCors({ origin: "https://allowed.com" });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: (d: string) => { res.body = d; } };
        const req: any = { method: "OPTIONS", headers: {} };
        middleware(req, res);
        expect(res.statusCode).toBe(403);
        expect(res.body).toContain("CORS");
    });

    it("should set all CORS headers correctly", () => {
        const cors = createCors({
            origin: "https://example.com",
            methods: ["GET", "POST"],
            allowedHeaders: ["Content-Type", "Authorization"],
            exposedHeaders: ["X-Custom-Header"],
            credentials: true,
            maxAge: 3600,
        });
        const middleware = cors.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        const req: any = { method: "GET", headers: { origin: "https://example.com" } };
        middleware(req, res);
        expect(res["Access-Control-Allow-Origin"]).toBe("https://example.com");
        expect(res["Access-Control-Allow-Methods"]).toContain("GET");
        expect(res["Access-Control-Allow-Methods"]).toContain("POST");
        expect(res["Access-Control-Allow-Headers"]).toContain("Content-Type");
        expect(res["Access-Control-Allow-Headers"]).toContain("Authorization");
        expect(res["Access-Control-Expose-Headers"]).toContain("X-Custom-Header");
        expect(res["Access-Control-Allow-Credentials"]).toBe("true");
        expect(res["Access-Control-Max-Age"]).toBe("3600");
    });
});

describe("Helmet - Security Headers", () => {
    it("should set all default security headers", () => {
        const helmet = createHelmet();
        const middleware = helmet.middleware();
        const res: any = { setHeader: (k: string, v: string) => { res[k] = v; } };
        const req: any = {};
        middleware(req, res);
        expect(res["X-Content-Type-Options"]).toBe("nosniff");
        expect(res["X-Frame-Options"]).toBe("SAMEORIGIN");
        expect(res["X-XSS-Protection"]).toBe("1; mode=block");
        expect(res["Referrer-Policy"]).toBe("no-referrer");
        expect(res["X-Download-Options"]).toBe("noopen");
        expect(res["X-DNS-Prefetch-Control"]).toBe("off");
    });

    it("should set Content-Security-Policy header", () => {
        const helmet = createHelmet({
            contentSecurityPolicy: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "https://trusted.com"] },
        });
        const middleware = helmet.middleware();
        const res: any = { setHeader: (k: string, v: string) => { res[k] = v; } };
        const req: any = {};
        middleware(req, res);
        expect(res["Content-Security-Policy"]).toContain("defaultSrc 'self'");
        expect(res["Content-Security-Policy"]).toContain("scriptSrc 'self' https://trusted.com");
    });

    it("should set Strict-Transport-Security header", () => {
        const helmet = createHelmet({ hsts: { maxAge: 31536000, includeSubDomains: true, preload: true } });
        const middleware = helmet.middleware();
        const res: any = { setHeader: (k: string, v: string) => { res[k] = v; } };
        const req: any = {};
        middleware(req, res);
        expect(res["Strict-Transport-Security"]).toContain("max-age=31536000");
        expect(res["Strict-Transport-Security"]).toContain("includeSubDomains");
        expect(res["Strict-Transport-Security"]).toContain("preload");
    });

    it("should disable headers when disabled", () => {
        const helmet = createHelmet();
        helmet.disable();
        const middleware = helmet.middleware();
        const res: any = { setHeader: (k: string, v: string) => { res[k] = v; } };
        const req: any = {};
        middleware(req, res);
        expect(res["X-Content-Type-Options"]).toBeUndefined();
        expect(res["X-Frame-Options"]).toBeUndefined();
    });
});

describe("Compression - Body Compression", () => {
    it("should compress body with gzip", () => {
        const compression = createCompression({ threshold: 0 });
        const middleware = compression.middleware();
        const res: any = {
            setHeader: (k: string, v: string) => { res[k] = v; },
            removeHeader: () => {},
            write: (chunk: any) => { res.bodyChunks = res.bodyChunks || []; res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return true; },
            end: (chunk?: any) => { if (chunk) { res.bodyChunks = res.bodyChunks || []; res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); } res.finalBody = Buffer.concat(res.bodyChunks || []); },
        };
        const req: any = { headers: { "accept-encoding": "gzip" } };
        middleware(req, res);
        res.write("Hello World");
        res.end();
        expect(res["Content-Encoding"]).toBe("gzip");
        expect(require("node:zlib").gunzipSync(res.finalBody).toString()).toBe("Hello World");
    });

    it("should compress body with brotli", () => {
        const compression = createCompression({ threshold: 0 });
        const middleware = compression.middleware();
        const res: any = {
            setHeader: (k: string, v: string) => { res[k] = v; },
            removeHeader: () => {},
            write: (chunk: any) => { res.bodyChunks = res.bodyChunks || []; res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return true; },
            end: (chunk?: any) => { if (chunk) { res.bodyChunks = res.bodyChunks || []; res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); } res.finalBody = Buffer.concat(res.bodyChunks || []); },
        };
        const req: any = { headers: { "accept-encoding": "br" } };
        middleware(req, res);
        res.write("Hello World");
        res.end();
        expect(res["Content-Encoding"]).toBe("br");
        expect(require("node:zlib").brotliDecompressSync(res.finalBody).toString()).toBe("Hello World");
    });

    it("should not compress bodies below threshold", () => {
        const compression = createCompression({ threshold: 5000 });
        const middleware = compression.middleware();
        const res: any = {
            setHeader: (k: string, v: string) => { res[k] = v; },
            removeHeader: () => {},
            write: (chunk: any) => { res.bodyChunks = res.bodyChunks || []; res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return true; },
            end: (chunk?: any) => { if (chunk) { res.bodyChunks = res.bodyChunks || []; res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); } res.finalBody = Buffer.concat(res.bodyChunks || []); },
        };
        const req: any = { headers: { "accept-encoding": "gzip" } };
        middleware(req, res);
        res.write("small");
        res.end();
        expect(res["Content-Encoding"]).toBeUndefined();
        expect(res.finalBody.toString()).toBe("small");
    });

    it("should remove Content-Length header when compressing", () => {
        const compression = createCompression({ threshold: 0 });
        const middleware = compression.middleware();
        const res: any = {
            "Content-Length": "100",
            setHeader: (k: string, v: string) => { res[k] = v; },
            removeHeader: (k: string) => { delete res[k]; },
            write: (chunk: any) => { res.bodyChunks = res.bodyChunks || []; res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return true; },
            end: (chunk?: any) => { if (chunk) { res.bodyChunks = res.bodyChunks || []; res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); } res.finalBody = Buffer.concat(res.bodyChunks || []); },
        };
        const req: any = { headers: { "accept-encoding": "gzip" } };
        middleware(req, res);
        res.write("A".repeat(2000));
        res.end();
        expect(res["Content-Length"]).toBeUndefined();
    });

    it("should not compress when no accept-encoding header", () => {
        const compression = createCompression({ threshold: 0 });
        const middleware = compression.middleware();
        const res: any = {
            setHeader: (k: string, v: string) => { res[k] = v; },
            removeHeader: () => {},
            write: (chunk: any) => { res.bodyChunks = res.bodyChunks || []; res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return true; },
            end: (chunk?: any) => { if (chunk) { res.bodyChunks = res.bodyChunks || []; res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); } res.finalBody = Buffer.concat(res.bodyChunks || []); },
        };
        const req: any = { headers: {} };
        middleware(req, res);
        res.write("Hello World");
        res.end();
        expect(res["Content-Encoding"]).toBeUndefined();
    });
});

describe("Sanitize - HTML Sanitization", () => {
    it("should sanitize basic HTML", () => {
        const sanitizer = createSanitizer();
        expect(sanitizer.sanitize("<p>Hello World</p>")).toBe("<p>Hello World</p>");
    });

    it("should remove script tags", () => {
        const sanitizer = createSanitizer();
        const sanitized = sanitizer.sanitize("<script>alert('xss')</script><p>Safe content</p>");
        expect(sanitized).not.toContain("<script>");
        expect(sanitized).toContain("Safe content");
    });

    it("should remove event handlers", () => {
        const sanitizer = createSanitizer();
        const sanitized = sanitizer.sanitize('<div onclick="evil()">Click me</div>');
        expect(sanitized).not.toContain("onclick");
    });

    it("should sanitize object values", () => {
        const sanitizer = createSanitizer();
        const obj = { name: "<script>alert('xss')</script>John", bio: "<p>Safe bio</p>" };
        const sanitized = sanitizer.sanitizeObject(obj);
        expect(sanitized.name).not.toContain("<script>");
        expect(sanitized.name).toContain("John");
        expect(sanitized.bio).toBe("<p>Safe bio</p>");
    });

    it("should handle empty string", () => {
        const sanitizer = createSanitizer();
        expect(sanitizer.sanitize("")).toBe("");
    });

    it("should handle null input gracefully", () => {
        const sanitizer = createSanitizer();
        expect(sanitizer.sanitize(null as unknown as string)).toBeDefined();
    });
});
