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
        const compression = createCompression();
        const middleware = compression.middleware();
        const res: any = {
            setHeader: (key: string, value: string) => {
                res[key] = value;
            },
        };
        const req: any = { headers: { "accept-encoding": "gzip" } };

        middleware(req, res);

        expect(res["Content-Encoding"]).toBe("gzip");
        expect(res["Vary"]).toBe("Accept-Encoding");
    });
});
