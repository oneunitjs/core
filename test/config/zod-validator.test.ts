import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodValidator } from "../../src/config/zod-validator.js";

describe("zodValidator - Zod schema adapter", () => {
    const schema = z.object({
        app: z.object({
            name: z.string().min(1).default("app"),
            port: z.number().int().min(1).max(65535).default(3000),
        }).default({ name: "app", port: 3000 }),
        database: z.object({
            url: z.string().min(1),
            pool: z.number().int().min(1).max(100).default(10),
        }).default({ url: "postgres://localhost:5432/db", pool: 10 }),
    });

    describe("Given valid input", () => {
        it("Then it returns the validated and typed output", () => {
            const validator = zodValidator(schema);
            const result = validator.validate({
                app: { name: "my-api", port: 4000 },
                database: { url: "postgres://localhost:5432/prod", pool: 20 },
            });

            expect(result.app.name).toBe("my-api");
            expect(result.app.port).toBe(4000);
            expect(result.database.url).toBe("postgres://localhost:5432/prod");
            expect(result.database.pool).toBe(20);
        });

        it("Then it applies schema defaults for missing fields", () => {
            const validator = zodValidator(schema);
            const result = validator.validate({});

            expect(result.app.name).toBe("app");
            expect(result.app.port).toBe(3000);
            expect(result.database.url).toBe("postgres://localhost:5432/db");
            expect(result.database.pool).toBe(10);
        });

        it("Then it infers the TypeScript type from the schema", () => {
            const validator = zodValidator(schema);
            const result = validator.validate({
                app: { name: "typed-app", port: 5000 },
                database: { url: "postgres://localhost:5432/typed" },
            });

            // Type check: result.app.name is string, result.app.port is number
            expect(typeof result.app.name).toBe("string");
            expect(typeof result.app.port).toBe("number");
        });
    });

    describe("Given invalid input", () => {
        it("Then it throws ConfigValidationError", () => {
            const validator = zodValidator(schema);

            expect(() =>
                validator.validate({
                    app: { name: "", port: -1 },
                    database: { url: "" },
                }),
            ).toThrow();
        });

        it("Then it throws for wrong types", () => {
            const validator = zodValidator(schema);

            expect(() =>
                validator.validate({
                    app: { name: "app", port: "not-a-number" },
                    database: { url: "postgres://localhost:5432/db" },
                }),
            ).toThrow();
        });

        it("Then it throws for out-of-range values", () => {
            const validator = zodValidator(schema);

            expect(() =>
                validator.validate({
                    app: { name: "app", port: 99999 },
                    database: { url: "postgres://localhost:5432/db" },
                }),
            ).toThrow();
        });
    });

    describe("Given sensitive data", () => {
        it("Then error messages do not leak raw input values", () => {
            const validator = zodValidator(schema);

            try {
                validator.validate({
                    app: { name: "secret-app", port: 3000 },
                    database: { url: "postgres://secret:password@localhost:5432/db" },
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                expect(message).not.toContain("secret-app");
                expect(message).not.toContain("secret:password");
                expect(message).not.toContain("password");
            }
        });

        it("Then error message is generic and does not expose field values", () => {
            const validator = zodValidator(schema);

            try {
                validator.validate({
                    app: { name: "", port: 3000 },
                    database: { url: "postgres://localhost:5432/db" },
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                expect(message).toBe("Configuration validation failed");
            }
        });
    });

    describe("Given async validation support", () => {
        it("Then validateAsync works for async refinements", async () => {
            const asyncSchema = z.object({
                name: z.string().min(1).refine(async (val) => val.length > 0, {
                    message: "name must not be empty",
                }),
            });
            const validator = zodValidator(asyncSchema);

            const result = await validator.validateAsync({ name: "async-test" });
            expect(result.name).toBe("async-test");
        });

        it("Then validateAsync rejects invalid input", async () => {
            const asyncSchema = z.object({
                name: z.string().min(1),
            });
            const validator = zodValidator(asyncSchema);

            await expect(
                validator.validateAsync({ name: "" }),
            ).rejects.toThrow();
        });
    });
});
