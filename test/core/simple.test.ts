import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("createApp - Simplified DX API", () => {
    describe("Global config sections", () => {
        it("should accept security config defaults", () => {
            const app = createApp({
                serviceName: "my-api",
                secret: "my-secret",
                security: {
                    cors: { origin: "https://example.com" },
                    csrf: { cookieName: "my-csrf" },
                    helmet: { hidePoweredBy: true },
                },
            });

            const cors = app.cors({ origin: "https://override.com" });
            expect(cors.options.origin).toBe("https://override.com");
        });

        it("should apply cookie config defaults", () => {
            const app = createApp({
                cookie: { secure: true, sameSite: "strict", maxAge: 7200 },
            });

            const serialized = app.cookies().serialize("session", "abc", {});
            expect(serialized).toContain("Secure");
            expect(serialized).toContain("HttpOnly");
            expect(serialized).toContain("SameSite=Strict");
            expect(serialized).toContain("Max-Age=7200");
        });

        it("should apply multipart config defaults", () => {
            const app = createApp({
                multipart: { maxFileSize: 5 * 1024 * 1024, maxFiles: 3 },
            });

            const mp = app.multipart();
            expect(mp.options.maxFileSize).toBe(5 * 1024 * 1024);
            expect(mp.options.maxFiles).toBe(3);
        });
    });

    describe("Security middleware shortcuts", () => {
        it("should create CORS middleware directly", () => {
            const app = createApp({ serviceName: "test", secret: "secret" });
            const cors = app.cors({ origin: "https://example.com" });
            expect(cors.name).toBe("cors");
            expect(cors.enabled).toBe(true);
        });

        it("should create CSRF middleware directly", () => {
            const app = createApp({ serviceName: "test", secret: "my-secret" });
            const csrf = app.csrf({ cookieName: "my-csrf" });
            expect(csrf.name).toBe("csrf");
            expect(csrf.options.cookieName).toBe("my-csrf");
        });

        it("should create Helmet middleware directly", () => {
            const app = createApp({ serviceName: "test" });
            const helmet = app.helmet({ hidePoweredBy: true });
            expect(helmet.name).toBe("helmet");
            expect(helmet.enabled).toBe(true);
        });

        it("should create Compression middleware directly", () => {
            const app = createApp({ serviceName: "test" });
            const compression = app.compression({ threshold: 2048 });
            expect(compression.name).toBe("compression");
            expect(compression.options.threshold).toBe(2048);
        });

        it("should create Sanitizer directly", () => {
            const app = createApp({ serviceName: "test" });
            const sanitizer = app.sanitize();
            expect(sanitizer).toBeDefined();
            expect(typeof sanitizer.sanitize).toBe("function");
        });

        it("should create rate limiter directly", () => {
            const app = createApp({ serviceName: "test" });
            const rateLimit = app.rateLimit({ maxRequests: 100, windowMs: 60000 });
            expect(rateLimit.name).toBe("rate-limit");
            expect(rateLimit.enabled).toBe(true);
        });
    });

    describe("Middleware chaining with use()", () => {
        it("should chain multiple middleware registrations", () => {
            const app = createApp({ serviceName: "test", secret: "secret" });

            const result = app
                .use(app.cors({ origin: "*" }))
                .use(app.csrf({ secret: "my-secret" }))
                .use(app.helmet());

            expect(app).toBeDefined();
        });
    });

    describe("Cookie store auto-detection", () => {
        it("should work without req/res (memory store)", () => {
            const app = createApp({ secret: "my-secret" });
            const cookies = app.cookies();

            const serialized = cookies.serialize("session", "abc123", { httpOnly: true });
            expect(serialized).toContain("session=abc123");
            expect(serialized).toContain("HttpOnly");
        });

        it("should set and get cookies", () => {
            const app = createApp({ secret: "my-secret" });
            const cookies = app.cookies();

            cookies.set("user", "john", { httpOnly: true });
            expect(cookies.get("user")).toBe("john");
            expect(cookies.has("user")).toBe(true);
        });

        it("should delete cookies", () => {
            const app = createApp({ secret: "my-secret" });
            const cookies = app.cookies();

            cookies.set("temp", "value");
            expect(cookies.has("temp")).toBe(true);

            cookies.delete("temp");
            expect(cookies.has("temp")).toBe(false);
        });
    });

    describe("Response API auto-detection", () => {
        it("should work without req/res", () => {
            const app = createApp({ serviceName: "test" });
            const response = app.response();

            expect(response).toBeDefined();
            expect(typeof response.ok).toBe("function");
            expect(typeof response.success).toBe("function");
            expect(typeof response.created).toBe("function");
        });
    });

    describe("Multipart middleware", () => {
        it("should create multipart middleware", () => {
            const app = createApp({ serviceName: "test", secret: "secret" });
            const mp = app.multipart({ maxFileSize: 5 * 1024 * 1024 });

            expect(mp.name).toBe("multipart");
            expect(mp.enabled).toBe(true);
        });
    });

    describe("Delegated APIs", () => {
        it("should expose health API", () => {
            const app = createApp({ serviceName: "test" });
            const health = app.health();
            expect(health).toBeDefined();
            expect(typeof health.register).toBe("function");
        });

        it("should expose hooks API", () => {
            const app = createApp({ serviceName: "test" });
            const hooks = app.hooks();
            expect(hooks).toBeDefined();
            expect(typeof hooks.on).toBe("function");
        });

        it("should expose config API", () => {
            const app = createApp({ serviceName: "test-app", port: 3000 });
            const config = app.config();
            expect(config.serviceName).toBe("test-app");
            expect(config.port).toBe(3000);
        });

        it("should expose lib API", () => {
            const app = createApp({ serviceName: "test" });
            const lib = app.lib();
            expect(lib).toBeDefined();
            expect(typeof lib.formatBytes).toBe("function");
        });

        it("should expose msgpack API", () => {
            const app = createApp({ serviceName: "test" });
            const msgpack = app.msgpack();
            expect(msgpack).toBeDefined();
            expect(typeof msgpack.encode).toBe("function");
        });

        it("should expose lifecycle API", () => {
            const app = createApp({ serviceName: "test" });
            const lifecycle = app.lifecycle();
            expect(lifecycle).toBeDefined();
            expect(typeof lifecycle.mode).toBe("function");
        });
    });
});
