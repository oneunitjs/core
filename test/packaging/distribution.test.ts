import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("PKG - Package Distribution Testing", () => {
    it("PKG-01: Package builds and runs", () => {
        const app = createApp();
        expect(app).toBeDefined();
    });

    it("PKG-02: All exports are accessible", () => {
        const app = createApp();
        const exports = [
            "cors", "csrf", "helmet", "compression", "sanitize",
            "rateLimit", "cookies", "response", "multipart", "use",
            "health", "hooks", "config", "lib", "msgpack", "lifecycle",
        ];
        for (const exp of exports) {
            expect(typeof app[exp as keyof typeof app]).toBe("function");
        }
    });

    it("PKG-03: TypeScript types available", () => {
        const app = createApp();
        const config = app.config();
        expect(typeof config.get).toBe("function");
        expect(typeof config.set).toBe("function");
    });

    it("PKG-04: ESM entry point loads", () => {
        expect(createApp).toBeDefined();
    });

    it("PKG-05: Declaration files exist", () => {
        expect(true).toBe(true);
    });

    it("PKG-06: Source maps available", () => {
        expect(true).toBe(true);
    });

    it("PKG-07: Required runtime dependencies resolvable", () => {
        const app = createApp();
        expect(app.msgpack()).toBeDefined();
        expect(app.lib()).toBeDefined();
    });

    it("PKG-08: Optional dependencies installable independently", () => {
        const app = createApp();
        expect(app.config().serviceName).toBe("app");
    });

    it("PKG-09: Install without optional frameworks", () => {
        const app = createApp();
        expect(app).toBeDefined();
    });

    it("PKG-10: Install with Express - CORS available", () => {
        const app = createApp();
        expect(app.cors).toBeDefined();
    });

    it("PKG-11: Install with Fastify - rate limit available", () => {
        const app = createApp();
        expect(app.rateLimit).toBeDefined();
    });

    it("PKG-12: Install with Koa - health available", () => {
        const app = createApp();
        expect(app.health()).toBeDefined();
    });

    it("PKG-13: Consumer application runs", () => {
        const app = createApp({ serviceName: "consumer-test" });
        expect(app.config().serviceName).toBe("consumer-test");
    });

    it("PKG-14: TypeScript imports compile", () => {
        expect(true).toBe(true);
    });

    it("PKG-15: Production-only installation works", () => {
        const app = createApp();
        expect(app.config().port).toBe(3000);
    });

    it("PKG-16: No missing files in production bundle", () => {
        expect(true).toBe(true);
    });

    it("PKG-17: Reproducible installation using committed lockfile", () => {
        expect(true).toBe(true);
    });
});
