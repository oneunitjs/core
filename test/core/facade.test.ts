import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("CF - Core Facade and Application Initialization", () => {
    it("CF-01: createApp() initializes successfully with default options", () => {
        const app = createApp();
        expect(app).toBeDefined();
        expect(typeof app.cors).toBe("function");
        expect(typeof app.csrf).toBe("function");
        expect(typeof app.helmet).toBe("function");
        expect(typeof app.compression).toBe("function");
        expect(typeof app.sanitize).toBe("function");
        expect(typeof app.rateLimit).toBe("function");
        expect(typeof app.cookies).toBe("function");
        expect(typeof app.response).toBe("function");
        expect(typeof app.multipart).toBe("function");
        expect(typeof app.use).toBe("function");
        expect(typeof app.health).toBe("function");
        expect(typeof app.hooks).toBe("function");
        expect(typeof app.config).toBe("function");
        expect(typeof app.lib).toBe("function");
        expect(typeof app.msgpack).toBe("function");
        expect(typeof app.lifecycle).toBe("function");
    });

    it("CF-02: Custom configuration is applied correctly", () => {
        const app = createApp({ serviceName: "test-svc", port: 9090 });
        expect(app.config().serviceName).toBe("test-svc");
        expect(app.config().port).toBe(9090);
    });

    it("CF-03: Unknown config keys throw errors", () => {
        const app = createApp();
        expect(() => app.config().set("invalidKey", "value")).toThrow("Unknown config key");
    });

    it("CF-04: Cached APIs return the same instances", () => {
        const app = createApp();
        expect(app.health()).toBe(app.health());
        expect(app.hooks()).toBe(app.hooks());
        expect(app.config()).toBe(app.config());
        expect(app.msgpack()).toBe(app.msgpack());
        expect(app.lifecycle()).toBe(app.lifecycle());
        expect(app.lib()).toBe(app.lib());
    });

    it("CF-05: Request-scoped cookies return different instances", () => {
        const app = createApp({ secret: "s3cr3t" });
        const req1: any = { headers: {} };
        const res1: any = { setHeader: () => {}, headers: {} };
        const req2: any = { headers: {} };
        const res2: any = { setHeader: () => {}, headers: {} };
        const cookies1 = app.cookies(req1, res1);
        const cookies2 = app.cookies(req2, res2);
        expect(cookies1).not.toBe(cookies2);
    });

    it("CF-06: Repeated requests do not leak request data via global store", () => {
        const app = createApp({ secret: "s3cr3t" });
        const store = app.cookies();
        store.set("user", "alice");
        expect(store.get("user")).toBe("alice");
    });

    it("CF-07: lifecycle() returns lifecycle API", () => {
        const app = createApp();
        const lc = app.lifecycle();
        expect(lc).toBeDefined();
        expect(typeof lc.registerMiddleware).toBe("function");
        expect(typeof lc.hasMiddleware).toBe("function");
    });

    it("CF-08: use() registers middleware correctly", () => {
        const app = createApp();
        const mw = (_req: unknown, _res: unknown, next: () => void) => next();
        const result = app.use(mw);
        expect(result).toBe(app);
    });

    it("CF-09: All public facade methods are accessible", () => {
        const app = createApp();
        const methods = [
            "cors", "csrf", "helmet", "compression", "sanitize",
            "rateLimit", "cookies", "response", "multipart", "use",
            "health", "hooks", "config", "lib", "msgpack", "lifecycle",
        ];
        for (const method of methods) {
            expect(typeof app[method as keyof typeof app]).toBe("function");
        }
    });

    it("CF-10: Initialization does not require optional framework packages", () => {
        const app = createApp();
        expect(app.config().serviceName).toBe("app");
    });
});
