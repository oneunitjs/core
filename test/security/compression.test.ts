import { describe, it, expect } from "vitest";
import { createCompression } from "../../src/security/compression.js";

describe("createCompression", () => {
    it("creates compression middleware", () => {
        const compression = createCompression();
        expect(compression.enabled).toBe(true);
    });

    it("enables and disables", () => {
        const compression = createCompression();
        compression.disable();
        expect(compression.enabled).toBe(false);
        compression.enable();
        expect(compression.enabled).toBe(true);
    });

    it("shouldCompress returns true for gzip accept-encoding", () => {
        const compression = createCompression();
        const req: any = { headers: { "accept-encoding": "gzip" } };
        const res: any = {};
        expect(compression.shouldCompress(req, res)).toBe(true);
    });

    it("shouldCompress returns false for no accept-encoding", () => {
        const compression = createCompression();
        const req: any = { headers: {} };
        const res: any = {};
        expect(compression.shouldCompress(req, res)).toBe(false);
    });

    it("middleware sets Content-Encoding header", () => {
        const compression = createCompression({ threshold: 0 });
        const middleware = compression.middleware();
        const res: any = {
            setHeader: (key: string, value: string) => {
                res[key] = value;
            },
            removeHeader: (key: string) => {
                delete res[key];
            },
            write: (chunk: any) => {
                res.bodyChunks = res.bodyChunks || [];
                res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                return true;
            },
            end: (chunk?: any) => {
                if (chunk) {
                    res.bodyChunks = res.bodyChunks || [];
                    res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                res.finalBody = Buffer.concat(res.bodyChunks || []);
            },
        };
        const req: any = { headers: { "accept-encoding": "gzip" } };

        middleware(req, res);
        res.write("Hello World");
        res.end();

        expect(res["Content-Encoding"]).toBe("gzip");
        expect(res["Vary"]).toBe("Accept-Encoding");
        expect(require("node:zlib").gunzipSync(res.finalBody).toString()).toBe("Hello World");
    });

    it("removes Content-Length header when compressing", () => {
        const compression = createCompression();
        const middleware = compression.middleware();
        const res: any = {
            "Content-Length": "100",
            setHeader: (key: string, value: string) => {
                res[key] = value;
            },
            removeHeader: (key: string) => {
                delete res[key];
            },
            write: (chunk: any) => {
                res.bodyChunks = res.bodyChunks || [];
                res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                return true;
            },
            end: (chunk?: any) => {
                if (chunk) {
                    res.bodyChunks = res.bodyChunks || [];
                    res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                res.finalBody = Buffer.concat(res.bodyChunks || []);
            },
        };
        const req: any = { headers: { "accept-encoding": "gzip" } };

        middleware(req, res);
        res.write("A".repeat(2000));
        res.end();

        expect(res["Content-Length"]).toBeUndefined();
    });

    it("negotiates brotli encoding when supported", () => {
        const compression = createCompression({ threshold: 0 });
        const middleware = compression.middleware();
        const res: any = {
            setHeader: (key: string, value: string) => {
                res[key] = value;
            },
            removeHeader: () => {},
            write: (chunk: any) => {
                res.bodyChunks = res.bodyChunks || [];
                res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                return true;
            },
            end: (chunk?: any) => {
                if (chunk) {
                    res.bodyChunks = res.bodyChunks || [];
                    res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                res.finalBody = Buffer.concat(res.bodyChunks || []);
            },
        };
        const req: any = { headers: { "accept-encoding": "br" } };

        middleware(req, res);
        res.write("Hello World");
        res.end();

        expect(res["Content-Encoding"]).toBe("br");
        expect(require("node:zlib").brotliDecompressSync(res.finalBody).toString()).toBe("Hello World");
    });

    it("does not compress bodies below threshold", () => {
        const compression = createCompression({ threshold: 5000 });
        const middleware = compression.middleware();
        const res: any = {
            setHeader: (key: string, value: string) => {
                res[key] = value;
            },
            removeHeader: () => {},
            write: (chunk: any) => {
                res.bodyChunks = res.bodyChunks || [];
                res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                return true;
            },
            end: (chunk?: any) => {
                if (chunk) {
                    res.bodyChunks = res.bodyChunks || [];
                    res.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                res.finalBody = Buffer.concat(res.bodyChunks || []);
            },
        };
        const req: any = { headers: { "accept-encoding": "gzip" } };

        middleware(req, res);
        res.write("small");
        res.end();

        expect(res["Content-Encoding"]).toBeUndefined();
        expect(res.finalBody.toString()).toBe("small");
    });
});
