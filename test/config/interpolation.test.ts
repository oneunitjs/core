import { describe, expect, it } from "vitest";
import { applyInterpolation } from "../../src/config/interpolation.js";
import { ConfigInterpolationError } from "../../src/config/errors.js";

function env(values: Record<string, string | undefined>) {
    return values;
}

describe("applyInterpolation - environment placeholder resolution", () => {
    describe("Given required placeholder syntax ${NAME}", () => {
        it("Then it resolves the variable when present in environment", () => {
            const result = applyInterpolation(
                { secret: "${COOKIE_SECRET}" },
                env({ COOKIE_SECRET: "s3cr3t-value" }),
            );
            expect(result).toEqual({ secret: "s3cr3t-value" });
        });

        it("Then it throws ConfigInterpolationError when variable is missing", () => {
            expect(() =>
                applyInterpolation({ secret: "${COOKIE_SECRET}" }, env({})),
            ).toThrow(ConfigInterpolationError);
        });

        it("Then error message names the variable but never leaks its value", () => {
            try {
                applyInterpolation({ secret: "${COOKIE_SECRET}" }, env({}));
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                expect(message).toContain("COOKIE_SECRET");
                expect(message).not.toContain("s3cr3t");
            }
        });
    });

    describe("Given fallback placeholder syntax ${NAME:fallback}", () => {
        it("Then it uses the environment value when variable is present", () => {
            const result = applyInterpolation(
                { port: "${PORT:3000}" },
                env({ PORT: "8080" }),
            );
            expect(result).toEqual({ port: "8080" });
        });

        it("Then it uses the fallback when variable is absent", () => {
            const result = applyInterpolation(
                { port: "${PORT:3000}" },
                env({}),
            );
            expect(result).toEqual({ port: "3000" });
        });

        it("Then it uses empty string fallback when specified explicitly", () => {
            const result = applyInterpolation(
                { secret: "${COOKIE_SECRET:}" },
                env({}),
            );
            expect(result).toEqual({ secret: "" });
        });
    });

    describe("Given empty vs absent environment values", () => {
        it("Then present empty variable resolves to empty string", () => {
            const result = applyInterpolation(
                { secret: "${COOKIE_SECRET}" },
                env({ COOKIE_SECRET: "" }),
            );
            expect(result).toEqual({ secret: "" });
        });

        it("Then absent variable with fallback uses fallback, not empty string", () => {
            const result = applyInterpolation(
                { secret: "${COOKIE_SECRET:fallback}" },
                env({}),
            );
            expect(result).toEqual({ secret: "fallback" });
        });
    });

    describe("Given nested data structures", () => {
        it("Then it traverses nested objects recursively", () => {
            const result = applyInterpolation(
                {
                    database: {
                        url: "${DB_URL}",
                        options: {
                            timeout: "${DB_TIMEOUT:30}",
                        },
                    },
                },
                env({ DB_URL: "postgres://localhost:5432/db" }),
            );
            expect(result).toEqual({
                database: {
                    url: "postgres://localhost:5432/db",
                    options: {
                        timeout: "30",
                    },
                },
            });
        });

        it("Then it traverses arrays element by element", () => {
            const result = applyInterpolation(
                {
                    origins: ["${ORIGIN_1}", "${ORIGIN_2}", "${ORIGIN_3:*}"],
                },
                env({ ORIGIN_1: "https://a.com", ORIGIN_2: "https://b.com" }),
            );
            expect(result).toEqual({
                origins: ["https://a.com", "https://b.com", "*"],
            });
        });

        it("Then it supports embedded placeholders within strings", () => {
            const result = applyInterpolation(
                { url: "https://${HOST}:${PORT}/api" },
                env({ HOST: "example.com", PORT: "443" }),
            );
            expect(result).toEqual({ url: "https://example.com:443/api" });
        });
    });

    describe("Given non-string values", () => {
        it("Then numbers, booleans, and null pass through unchanged", () => {
            const result = applyInterpolation(
                { count: 42, enabled: true, nothing: null, items: [1, 2, 3] },
                env({}),
            );
            expect(result).toEqual({ count: 42, enabled: true, nothing: null, items: [1, 2, 3] });
        });
    });

    describe("Given recursive safety", () => {
        it("Then environment variable values are not recursively interpolated", () => {
            const result = applyInterpolation(
                { value: "${VAR}" },
                env({ VAR: "${OTHER}" }),
            );
            expect(result).toEqual({ value: "${OTHER}" });
        });
    });
});
