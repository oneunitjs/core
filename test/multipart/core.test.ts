import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("createApp - Multipart API", () => {
    it("exposes multipart() on the App", () => {
        const core = createApp();
        const mp = core.multipart();
        expect(mp).toBeDefined();
        expect(typeof mp.multipart).toBe("function");
    });

    it("creates multipart middleware via core", () => {
        const core = createApp();
        const mp = core.multipart();
        const middleware = mp.multipart({ maxFileSize: 1024 * 1024 });
        expect(middleware.name).toBe("multipart");
        expect(middleware.enabled).toBe(true);
        expect(typeof middleware.middleware).toBe("function");
        expect(typeof middleware.parse).toBe("function");
    });

    it("multipart options are applied", () => {
        const core = createApp();
        const mp = core.multipart();
        const middleware = mp.multipart({
            maxFileSize: 5 * 1024 * 1024,
            maxFiles: 3,
            allowedMimeTypes: ["image/png", "image/jpeg"],
        });
        expect(middleware.options.maxFileSize).toBe(5 * 1024 * 1024);
        expect(middleware.options.maxFiles).toBe(3);
        expect(middleware.options.allowedMimeTypes).toEqual(["image/png", "image/jpeg"]);
    });
});
