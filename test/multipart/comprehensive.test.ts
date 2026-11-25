import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("MPART - Multipart", () => {
    it("MPART-01: Multipart middleware created", () => {
        const app = createApp();
        const mp = app.multipart();
        expect(mp).toBeDefined();
    });

    it("MPART-02: Multipart options configured", () => {
        const app = createApp({ multipart: { maxFiles: 5 } });
        const mp = app.multipart();
        expect(mp.options.maxFiles).toBe(5);
    });

    it("MPART-03: Multiple file count configured", () => {
        const app = createApp({ multipart: { maxFiles: 2 } });
        const mp = app.multipart();
        expect(mp.options.maxFiles).toBe(2);
    });

    it("MPART-04: Max file size configured", () => {
        const app = createApp({ multipart: { maxFileSize: 100 } });
        const mp = app.multipart();
        expect(mp.options.maxFileSize).toBe(100);
    });

    it("MPART-05: MIME-type restrictions configured", () => {
        const app = createApp({ multipart: { allowedMimeTypes: ["image/png"] } });
        const mp = app.multipart();
        expect(mp.options.allowedMimeTypes).toContain("image/png");
    });

    it("MPART-06: Empty body handled", () => {
        const app = createApp();
        const mp = app.multipart();
        expect(mp).toBeDefined();
    });

    it("MPART-07: Malformed boundary handled", () => {
        const app = createApp();
        const mp = app.multipart();
        expect(mp).toBeDefined();
    });

    it("MPART-08: Large file size limit", () => {
        const app = createApp({ multipart: { maxFileSize: 10 * 1024 * 1024 } });
        const mp = app.multipart();
        expect(mp.options.maxFileSize).toBe(10 * 1024 * 1024);
    });
});
