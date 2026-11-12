import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createConfig } from "../../src/config/create-config.js";

const originalEnv = process.env;

beforeEach(() => {
    process.env = { ...originalEnv };
});

afterEach(() => {
    process.env = originalEnv;
});

describe("createConfig", () => {
    it("returns defaults when env vars are unset", () => {
        delete process.env.PORT;
        delete process.env.HOST;
        delete process.env.SERVICE_NAME;
        delete process.env.NODE_ENV;

        const config = createConfig();

        expect(config.port).toBe(3000);
        expect(config.host).toBe("localhost");
        expect(config.serviceName).toBe("app");
        expect(config.nodeEnv).toBe("development");
        expect(config.isDevelopment).toBe(true);
        expect(config.isProduction).toBe(false);
        expect(config.isTest).toBe(false);
    });

    it("overrides defaults with options", () => {
        const config = createConfig({
            port: 8080,
            host: "0.0.0.0",
            serviceName: "my-api",
            nodeEnv: "production",
        });

        expect(config.port).toBe(8080);
        expect(config.host).toBe("0.0.0.0");
        expect(config.serviceName).toBe("my-api");
        expect(config.nodeEnv).toBe("production");
        expect(config.isProduction).toBe(true);
        expect(config.isDevelopment).toBe(false);
        expect(config.isTest).toBe(false);
    });

    it("env vars are used when options are not provided", () => {
        process.env.PORT = "9000";
        process.env.HOST = "127.0.0.1";
        process.env.SERVICE_NAME = "env-svc";
        process.env.NODE_ENV = "test";

        const config = createConfig();

        expect(config.port).toBe(9000);
        expect(config.host).toBe("127.0.0.1");
        expect(config.serviceName).toBe("env-svc");
        expect(config.nodeEnv).toBe("test");
        expect(config.isTest).toBe(true);
    });

    it("toJSON returns a plain ServiceConfig object", () => {
        const config = createConfig({ serviceName: "json-api" });
        const json = config.toJSON();

        expect(json).toEqual({
            port: config.port,
            host: config.host,
            serviceName: "json-api",
            nodeEnv: config.nodeEnv,
            isDevelopment: config.isDevelopment,
            isProduction: config.isProduction,
            isTest: config.isTest,
        });
        expect(typeof json).toBe("object");
    });
});
