import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("createApp - Multipart API", () => {
    it("exposes multipart() on the App", () => {
        const app = createApp();
        const mp = app.multipart();
        expect(mp).toBeDefined();
        expect(typeof mp.middleware).toBe("function");
    });

    it("creates multipart middleware via core", () => {
        const app = createApp();
        const middleware = app.multipart({ maxFileSize: 1024 * 1024 });
        expect(middleware.name).toBe("multipart");
        expect(middleware.enabled).toBe(true);
        expect(typeof middleware.middleware).toBe("function");
        expect(typeof middleware.parse).toBe("function");
    });

    it("multipart options are applied", () => {
        const app = createApp();
        const middleware = app.multipart({
            maxFileSize: 5 * 1024 * 1024,
            maxFiles: 3,
            allowedMimeTypes: ["image/png", "image/jpeg"],
        });
        expect(middleware.options.maxFileSize).toBe(5 * 1024 * 1024);
        expect(middleware.options.maxFiles).toBe(3);
        expect(middleware.options.allowedMimeTypes).toEqual(["image/png", "image/jpeg"]);
    });
});
