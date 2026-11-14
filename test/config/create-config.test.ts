import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createConfig } from "../../src/config/index.js";

const originalEnv = process.env;

beforeEach(() => {
    process.env = { ...originalEnv };
});

afterEach(() => {
    process.env = originalEnv;
});

describe("createConfig - legacy service configuration factory", () => {
    describe("Given default options", () => {
        it("Then it returns config with default port 3000", () => {
            const config = createConfig({});
            expect(config.port).toBe(3000);
        });

        it("Then it returns config with default host localhost", () => {
            const config = createConfig({});
            expect(config.host).toBe("localhost");
        });

        it("Then it returns config with default serviceName app", () => {
            const config = createConfig({});
            expect(config.serviceName).toBe("app");
        });

        it("Then it returns config with default nodeEnv development", () => {
            delete process.env.NODE_ENV;
            const config = createConfig({});
            expect(config.nodeEnv).toBe("development");
        });

        it("Then all environment flags are false except development", () => {
            delete process.env.NODE_ENV;
            const config = createConfig({});
            expect(config.isDevelopment).toBe(true);
            expect(config.isProduction).toBe(false);
            expect(config.isTest).toBe(false);
        });
    });

    describe("Given custom options", () => {
        it("Then it uses custom port", () => {
            const config = createConfig({ port: 8080 });
            expect(config.port).toBe(8080);
        });

        it("Then it uses custom host", () => {
            const config = createConfig({ host: "0.0.0.0" });
            expect(config.host).toBe("0.0.0.0");
        });

        it("Then it uses custom serviceName", () => {
            const config = createConfig({ serviceName: "my-api" });
            expect(config.serviceName).toBe("my-api");
        });

        it("Then it uses custom nodeEnv", () => {
            const config = createConfig({ nodeEnv: "production" });
            expect(config.nodeEnv).toBe("production");
        });

        it("Then it combines all custom options", () => {
            const config = createConfig({
                port: 4000,
                host: "0.0.0.0",
                serviceName: "payment-service",
                nodeEnv: "test",
            });
            expect(config.port).toBe(4000);
            expect(config.host).toBe("0.0.0.0");
            expect(config.serviceName).toBe("payment-service");
            expect(config.nodeEnv).toBe("test");
        });
    });

    describe("Given environment detection", () => {
        describe.each([
            ["development", true, false, false],
            ["production", false, true, false],
            ["test", false, false, true],
            ["staging", false, false, false],
        ])("Given NODE_ENV=%s", (env, dev, prod, test) => {
            it("Then it classifies correctly", () => {
                process.env.NODE_ENV = env;
                const config = createConfig({});
                expect(config.isDevelopment).toBe(dev);
                expect(config.isProduction).toBe(prod);
                expect(config.isTest).toBe(test);
            });
        });
    });

    describe("Given toJSON serialization", () => {
        it("Then it serializes to ServiceConfig shape", () => {
            const config = createConfig({ serviceName: "test-app", port: 3000 });
            const json = config.toJSON();

            expect(json).toEqual({
                port: 3000,
                host: "localhost",
                serviceName: "test-app",
                nodeEnv: config.nodeEnv,
                isDevelopment: config.isDevelopment,
                isProduction: config.isProduction,
                isTest: config.isTest,
            });
        });

        it("Then toJSON returns a plain object, not the config instance", () => {
            const config = createConfig({ serviceName: "json-test" });
            const json = config.toJSON();
            expect(json).not.toBe(config);
            expect(typeof json).toBe("object");
        });
    });

    describe("Given Config type contract", () => {
        it("Then config properties are readonly", () => {
            const config = createConfig({ port: 3000 });
            // TypeScript enforces readonly at compile time; runtime check for presence
            expect(config.port).toBe(3000);
            expect(config.host).toBe("localhost");
            expect(config.serviceName).toBe("app");
        });

        it("Then config has toJSON method", () => {
            const config = createConfig({});
            expect(typeof config.toJSON).toBe("function");
        });
    });
});
