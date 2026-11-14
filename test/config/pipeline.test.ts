import { describe, expect, it } from "vitest";
import {
    runPipeline,
    runPipelineAsync,
    parseInteger,
    parseBoolean,
    buildEnvironmentOverrides,
} from "../../src/config/pipeline.js";
import { zodValidator } from "../../src/config/zod-validator.js";
import { z } from "zod";

const Schema = z.object({
    app: z.object({
        name: z.string().min(1).default("app"),
        port: z.number().int().min(1).max(65535).default(3000),
    }).default({ name: "app", port: 3000 }),
    database: z.object({
        url: z.string().min(1),
        pool: z.number().int().min(1).max(100).default(10),
    }).default({ url: "postgres://localhost:5432/db", pool: 10 }),
});

describe("runPipeline - synchronous interpolate → map → merge → validate → freeze", () => {
    describe("Given sources with environment placeholders", () => {
        it("Then it interpolates, merges, validates, and freezes", () => {
            const coercibleSchema = z.object({
                app: z.object({
                    name: z.string().min(1).default("app"),
                    port: z.coerce.number().int().min(1).max(65535).default(3000),
                }).default({ name: "app", port: 3000 }),
            });

            const result = runPipeline(
                [{ app: { name: "${APP_NAME:my-app}", port: "${APP_PORT:4000}" } }],
                {
                    schema: zodValidator(coercibleSchema),
                    environment: { APP_NAME: "api", APP_PORT: "5000" },
                },
            );

            expect(result.app.name).toBe("api");
            expect(result.app.port).toBe(5000);
            expect(Object.isFrozen(result)).toBe(true);
        });

        it("Then it applies defaults when sources are empty", () => {
            const result = runPipeline([], {
                schema: zodValidator(Schema),
            });

            expect(result.app.name).toBe("app");
            expect(result.app.port).toBe(3000);
        });

        it("Then envOverrides take precedence over sources", () => {
            const result = runPipeline(
                [{ app: { port: 3000 } }],
                {
                    schema: zodValidator(Schema),
                    envOverrides: { app: { port: 9000 } },
                },
            );

            expect(result.app.port).toBe(9000);
        });

        it("Then cliOverrides take precedence over envOverrides", () => {
            const result = runPipeline(
                [{ app: { port: 3000 } }],
                {
                    schema: zodValidator(Schema),
                    envOverrides: { app: { port: 8000 } },
                    cliOverrides: { app: { port: 7000 } },
                },
            );

            expect(result.app.port).toBe(7000);
        });

        it("Then it throws when validator is async (sync mode)", () => {
            const asyncValidator = {
                validate: (input: unknown) => Promise.resolve(Schema.parse(input)),
                validateAsync: async (input: unknown) => Schema.parseAsync(input),
            };

            expect(() =>
                runPipeline([], { schema: asyncValidator as any }),
            ).toThrow(/asynchronous validators/);
        });
    });

    describe("Given environment mapping", () => {
        it("Then envMapping maps env vars to config paths", () => {
            const result = runPipeline(
                [{ app: { port: 3000 } }],
                {
                    schema: zodValidator(Schema),
                    envMapping: {
                        APP_PORT: { path: ["app", "port"], parse: parseInteger },
                    },
                    environment: { APP_PORT: "8080" },
                },
            );

            expect(result.app.port).toBe(8080);
        });

        it("Then envMapping overrides file values", () => {
            const result = runPipeline(
                [{ app: { port: 3000 } }],
                {
                    schema: zodValidator(Schema),
                    envMapping: {
                        APP_PORT: { path: ["app", "port"], parse: parseInteger },
                    },
                    environment: { APP_PORT: "9999" },
                },
            );

            expect(result.app.port).toBe(9999);
        });

        it("Then envMapping with nested paths creates intermediate objects", () => {
            const result = runPipeline(
                [{ app: { name: "api" } }],
                {
                    schema: zodValidator(Schema),
                    envMapping: {
                        DB_URL: { path: ["database", "url"] },
                    },
                    environment: { DB_URL: "postgres://localhost:5432/db" },
                },
            );

            expect(result.database.url).toBe("postgres://localhost:5432/db");
        });

        it("Then empty mapping path throws", () => {
            expect(() =>
                runPipeline([], {
                    schema: zodValidator(Schema),
                    envMapping: {
                        BAD_VAR: { path: [], parse: parseInteger },
                    },
                    environment: { BAD_VAR: "1" },
                }),
            ).toThrow(/non-empty path/);
        });

        it("Then prototype-sensitive path segments throw", () => {
            expect(() =>
                runPipeline([], {
                    schema: zodValidator(Schema),
                    envMapping: {
                        BAD_VAR: { path: ["__proto__"] },
                    },
                    environment: { BAD_VAR: "1" },
                }),
            ).toThrow(/Unsafe environment mapping path/);
        });
    });
});

describe("runPipelineAsync - async pipeline with validateAsync support", () => {
    it("Then it supports async validators with validateAsync", async () => {
        const asyncValidator = {
            validate: (input: unknown) => Schema.parse(input),
            validateAsync: async (input: unknown) => Schema.parseAsync(input),
        };

        const result = await runPipelineAsync(
            [{ app: { name: "async-app" } }],
            { schema: asyncValidator as any },
        );

        expect(result.app.name).toBe("async-app");
    });

    it("Then it falls back to validate when validateAsync is absent", async () => {
        const syncValidator = {
            validate: (input: unknown) => Schema.parse(input),
        };

        const result = await runPipelineAsync(
            [{ app: { name: "fallback-app" } }],
            { schema: syncValidator as any },
        );

        expect(result.app.name).toBe("fallback-app");
    });

    it("Then result is frozen", async () => {
        const result = await runPipelineAsync(
            [{ app: { name: "frozen-app" } }],
            { schema: zodValidator(Schema) },
        );

        expect(Object.isFrozen(result)).toBe(true);
    });
});

describe("parseInteger - strict integer environment parser", () => {
    it("Then it parses positive integers", () => {
        expect(parseInteger("42")).toBe(42);
    });

    it("Then it parses negative integers", () => {
        expect(parseInteger("-7")).toBe(-7);
    });

    it("Then it trims whitespace", () => {
        expect(parseInteger("  100  ")).toBe(100);
    });

    it("Then it rejects non-numeric strings", () => {
        expect(() => parseInteger("not-a-number")).toThrow(/Expected an integer/);
    });

    it("Then it rejects decimal strings", () => {
        expect(() => parseInteger("3.14")).toThrow(/Expected an integer/);
    });

    it("Then it rejects values outside safe integer range", () => {
        expect(() => parseInteger("999999999999999999999")).toThrow(/safe range/);
    });

    it("Then it rejects empty strings", () => {
        expect(() => parseInteger("")).toThrow(/Expected an integer/);
    });
});

describe("parseBoolean - strict boolean environment parser", () => {
    it.each([
        ["true", true],
        ["1", true],
        ["yes", true],
        ["on", true],
        ["True", true],
        ["YES", true],
        ["On", true],
    ])("Then %p is treated as true", (value, expected) => {
        expect(parseBoolean(value)).toBe(expected);
    });

    it.each([
        ["false", false],
        ["0", false],
        ["no", false],
        ["off", false],
        ["False", false],
        ["NO", false],
        ["Off", false],
    ])("Then %p is treated as false", (value, expected) => {
        expect(parseBoolean(value)).toBe(expected);
    });

    it("Then it trims whitespace", () => {
        expect(parseBoolean("  true  ")).toBe(true);
        expect(parseBoolean("  false  ")).toBe(false);
    });

    it("Then it rejects unrecognized values", () => {
        expect(() => parseBoolean("maybe")).toThrow(/Expected a boolean/);
        expect(() => parseBoolean("2")).toThrow(/Expected a boolean/);
        expect(() => parseBoolean("")).toThrow(/Expected a boolean/);
    });
});

describe("buildEnvironmentOverrides - env var to config path mapping", () => {
    it("Then it returns empty object when no mapping provided", () => {
        const result = buildEnvironmentOverrides(undefined, {});
        expect(result).toEqual({});
    });

    it("Then it maps simple environment variables to config paths", () => {
        const result = buildEnvironmentOverrides(
            {
                APP_PORT: { path: ["app", "port"], parse: parseInteger },
            },
            { APP_PORT: "8080" },
        );
        expect(result).toEqual({ app: { port: 8080 } });
    });

    it("Then it skips undefined environment variables", () => {
        const result = buildEnvironmentOverrides(
            {
                APP_PORT: { path: ["app", "port"], parse: parseInteger },
            },
            {},
        );
        expect(result).toEqual({});
    });

    it("Then it creates nested objects for deep paths", () => {
        const result = buildEnvironmentOverrides(
            {
                DB_URL: { path: ["database", "url"] },
                DB_POOL: { path: ["database", "pool"], parse: parseInteger },
            },
            { DB_URL: "postgres://localhost:5432/db", DB_POOL: "20" },
        );
        expect(result).toEqual({
            database: { url: "postgres://localhost:5432/db", pool: 20 },
        });
    });

    it("Then it uses raw string when no parse function provided", () => {
        const result = buildEnvironmentOverrides(
            {
                APP_NAME: { path: ["app", "name"] },
            },
            { APP_NAME: "my-service" },
        );
        expect(result).toEqual({ app: { name: "my-service" } });
    });
});
