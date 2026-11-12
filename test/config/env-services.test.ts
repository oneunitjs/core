import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { serviceConfig, nodeEnv } from "../../src/config/env-services.js";

const originalEnv = process.env;

beforeEach(() => {
    process.env = { ...originalEnv };
});

afterEach(() => {
    process.env = originalEnv;
});

describe("serviceConfig", () => {
    it("returns defaults when env vars are unset", () => {
        delete process.env.PORT;
        delete process.env.HOST;
        delete process.env.SERVICE_NAME;
        delete process.env.NODE_ENV;

        const config = serviceConfig(3000, "localhost", "my-app");

        expect(config).toEqual({
            port: 3000,
            host: "localhost",
            serviceName: "my-app",
            nodeEnv: "development",
            isDevelopment: true,
            isProduction: false,
            isTest: false,
        });
    });

    it("overrides defaults with env vars", () => {
        process.env.PORT = "8080";
        process.env.HOST = "0.0.0.0";
        process.env.SERVICE_NAME = "override";
        process.env.NODE_ENV = "production";

        const config = serviceConfig(3000, "localhost", "my-app");

        expect(config.port).toBe(8080);
        expect(config.host).toBe("0.0.0.0");
        expect(config.serviceName).toBe("override");
        expect(config.nodeEnv).toBe("production");
        expect(config.isProduction).toBe(true);
        expect(config.isDevelopment).toBe(false);
        expect(config.isTest).toBe(false);
    });
});

describe("nodeEnv", () => {
    it("returns the resolved environment", () => {
        process.env.NODE_ENV = "test";
        expect(nodeEnv()).toBe("test");
    });
});
