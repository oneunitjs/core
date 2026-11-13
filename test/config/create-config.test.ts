import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createConfig } from "../../src/config/index.js";

describe("Config - Defaults", () => {
    it("should have default port", () => {
        const config = createConfig({});
        expect(config.port).toBe(3000);
    });

    it("should have default host", () => {
        const config = createConfig({});
        expect(config.host).toBe("localhost");
    });

    it("should have default service name", () => {
        const config = createConfig({});
        expect(config.serviceName).toBe("app");
    });

    it("should have default nodeEnv", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "development";
        try {
            const config = createConfig({});
            expect(config.nodeEnv).toBe("development");
        } finally {
            process.env.NODE_ENV = originalEnv;
        }
    });
});

describe("Config - Custom Values", () => {
    it("should use custom port", () => {
        const config = createConfig({ port: 8080 });
        expect(config.port).toBe(8080);
    });

    it("should use custom host", () => {
        const config = createConfig({ host: "0.0.0.0" });
        expect(config.host).toBe("0.0.0.0");
    });

    it("should use custom service name", () => {
        const config = createConfig({ serviceName: "my-api" });
        expect(config.serviceName).toBe("my-api");
    });

    it("should use custom nodeEnv", () => {
        const config = createConfig({ nodeEnv: "production" });
        expect(config.nodeEnv).toBe("production");
    });
});

describe("Config - Environment Detection", () => {
    it("should detect development environment", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "development";
        try {
            const config = createConfig({});
            expect(config.isDevelopment).toBe(true);
            expect(config.isProduction).toBe(false);
            expect(config.isTest).toBe(false);
        } finally {
            process.env.NODE_ENV = originalEnv;
        }
    });

    it("should detect production environment", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        try {
            const config = createConfig({});
            expect(config.isDevelopment).toBe(false);
            expect(config.isProduction).toBe(true);
            expect(config.isTest).toBe(false);
        } finally {
            process.env.NODE_ENV = originalEnv;
        }
    });

    it("should detect test environment", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "test";
        try {
            const config = createConfig({});
            expect(config.isDevelopment).toBe(false);
            expect(config.isProduction).toBe(false);
            expect(config.isTest).toBe(true);
        } finally {
            process.env.NODE_ENV = originalEnv;
        }
    });
});

describe("Config - toJSON", () => {
    it("should serialize config to JSON", () => {
        const config = createConfig({ serviceName: "test-app", port: 3000 });
        const json = config.toJSON();
        expect(json.serviceName).toBe("test-app");
        expect(json.port).toBe(3000);
    });
});
