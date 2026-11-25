import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("CFG - Configuration Management", () => {
    it("CFG-01: Config has default values", () => {
        const app = createApp();
        expect(typeof app.config().serviceName).toBe("string");
        expect(typeof app.config().port).toBe("number");
    });

    it("CFG-02: Custom service name applied", () => {
        const app = createApp({ serviceName: "yaml-test" });
        expect(app.config().serviceName).toBe("yaml-test");
    });

    it("CFG-03: Unknown config keys rejected", () => {
        const app = createApp();
        expect(() => app.config().get("nonexistent-key-xyz")).toThrow("Unknown config key");
    });

    it("CFG-04: get() and set() round-trip known keys", () => {
        const app = createApp();
        app.config().set("port", 9090);
        expect(app.config().port).toBe(9090);
    });

    it("CFG-05: Unknown config key set throws", () => {
        const app = createApp();
        expect(() => app.config().set("unknown-key-xyz", "value")).toThrow("Unknown config key");
    });

    it("CFG-06: Missing required config uses defaults", () => {
        const app = createApp();
        expect(app.config().serviceName).toBe("app");
        expect(app.config().port).toBe(3000);
    });

    it("CFG-07: Config isolation between instances", () => {
        const a1 = createApp({ serviceName: "instance-a" });
        const a2 = createApp({ serviceName: "instance-b" });
        expect(a1.config().serviceName).toBe("instance-a");
        expect(a2.config().serviceName).toBe("instance-b");
    });

    it("CFG-08: Secret not exposed in error messages", () => {
        const app = createApp({ secret: "super-secret-123" });
        try {
            app.config().get("nonexistent-key");
        } catch (err: any) {
            expect(err.message).not.toContain("super-secret-123");
        }
    });

    it("CFG-09: Config toJSON works", () => {
        const app = createApp({ serviceName: "test" });
        const json = app.config().toJSON();
        expect(json.serviceName).toBe("test");
    });

    it("CFG-10: Config boolean flags", () => {
        const app = createApp({ nodeEnv: "production" });
        expect(app.config().isProduction).toBe(true);
        expect(app.config().isDevelopment).toBe(false);
    });
});
