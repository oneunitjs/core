import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
    envString,
    envNumber,
    envBool,
    envList,
    resolveNodeEnv,
    isDevelopment,
    isProduction,
    isTest,
    envFile,
} from "../../src/config/env.js";

const originalEnv = process.env;

beforeEach(() => {
    process.env = { ...originalEnv };
});

afterEach(() => {
    process.env = originalEnv;
});

describe("envString - string environment variable parsing", () => {
    describe("Given the variable is set", () => {
        it("Then it returns the trimmed value", () => {
            process.env.MY_VAR = "  hello world  ";
            expect(envString("MY_VAR")).toBe("hello world");
        });

        it("Then it preserves internal whitespace", () => {
            process.env.MY_VAR = "hello   world";
            expect(envString("MY_VAR")).toBe("hello   world");
        });
    });

    describe("Given the variable is unset", () => {
        it("Then it returns the fallback when provided", () => {
            delete process.env.MY_VAR;
            expect(envString("MY_VAR", "fallback")).toBe("fallback");
        });

        it("Then it returns undefined when no fallback", () => {
            delete process.env.MY_VAR;
            expect(envString("MY_VAR")).toBeUndefined();
        });
    });

    describe("Given the variable is empty or whitespace-only", () => {
        it("Then it returns the fallback for empty string", () => {
            process.env.MY_VAR = "";
            expect(envString("MY_VAR", "fallback")).toBe("fallback");
        });

        it("Then it returns the fallback for whitespace-only", () => {
            process.env.MY_VAR = "   \t\n  ";
            expect(envString("MY_VAR", "fallback")).toBe("fallback");
        });
    });
});

describe("envNumber - numeric environment variable parsing", () => {
    describe("Given a valid numeric value", () => {
        it("Then it returns the parsed number", () => {
            process.env.MY_NUM = "42";
            expect(envNumber("MY_NUM")).toBe(42);
        });

        it("Then it parses negative numbers", () => {
            process.env.MY_NUM = "-10";
            expect(envNumber("MY_NUM")).toBe(-10);
        });

        it("Then it parses decimal numbers", () => {
            process.env.MY_NUM = "3.14";
            expect(envNumber("MY_NUM")).toBe(3.14);
        });
    });

    describe("Given the variable is unset", () => {
        it("Then it returns the fallback when provided", () => {
            delete process.env.MY_NUM;
            expect(envNumber("MY_NUM", 7)).toBe(7);
        });

        it("Then it returns undefined when no fallback", () => {
            delete process.env.MY_NUM;
            expect(envNumber("MY_NUM")).toBeUndefined();
        });
    });

    describe("Given an invalid numeric value", () => {
        it("Then it returns the fallback for non-numeric strings", () => {
            process.env.MY_NUM = "not-a-number";
            expect(envNumber("MY_NUM", 3)).toBe(3);
        });

        it("Then it returns the fallback for empty strings", () => {
            process.env.MY_NUM = "";
            expect(envNumber("MY_NUM", 0)).toBe(0);
        });
    });
});

describe("envBool - boolean environment variable parsing", () => {
    describe.each([
        ["true", true],
        ["1", true],
        ["yes", true],
        ["on", true],
        ["True", true],
        ["TRUE", true],
        ["Yes", true],
        ["On", true],
    ])("Given value %p", (value, expected) => {
        it("Then it returns true", () => {
            process.env.MY_BOOL = value;
            expect(envBool("MY_BOOL")).toBe(expected);
        });
    });

    describe.each([
        ["false", false],
        ["0", false],
        ["no", false],
        ["off", false],
        ["False", false],
        ["FALSE", false],
        ["No", false],
        ["Off", false],
    ])("Given value %p", (value, expected) => {
        it("Then it returns false", () => {
            process.env.MY_BOOL = value;
            expect(envBool("MY_BOOL")).toBe(expected);
        });
    });

    describe("Given unrecognized values", () => {
        it("Then it returns the fallback when provided", () => {
            process.env.MY_BOOL = "maybe";
            expect(envBool("MY_BOOL", false)).toBe(false);
            expect(envBool("MY_BOOL", true)).toBe(true);
        });

        it("Then it returns undefined when no fallback", () => {
            process.env.MY_BOOL = "maybe";
            expect(envBool("MY_BOOL")).toBeUndefined();
        });

        it("Then JavaScript truthiness is never used (\"false\" is not true)", () => {
            process.env.MY_BOOL = "false";
            expect(envBool("MY_BOOL")).toBe(false);
            expect(Boolean("false")).toBe(true); // confirms the bug we avoid
        });
    });

    describe("Given the variable is unset", () => {
        it("Then it returns the fallback when provided", () => {
            delete process.env.MY_BOOL;
            expect(envBool("MY_BOOL", false)).toBe(false);
        });

        it("Then it returns undefined when no fallback", () => {
            delete process.env.MY_BOOL;
            expect(envBool("MY_BOOL")).toBeUndefined();
        });
    });
});

describe("envList - comma-separated list parsing", () => {
    describe("Given a comma-separated value", () => {
        it("Then it splits, trims, and filters empty items", () => {
            process.env.MY_LIST = "a, b ,, c  ,";
            expect(envList("MY_LIST")).toEqual(["a", "b", "c"]);
        });

        it("Then it handles single item without commas", () => {
            process.env.MY_LIST = "single";
            expect(envList("MY_LIST")).toEqual(["single"]);
        });

        it("Then empty string is treated as unset and returns undefined", () => {
            process.env.MY_LIST = "";
            expect(envList("MY_LIST")).toBeUndefined();
        });
    });

    describe("Given the variable is unset", () => {
        it("Then it returns the fallback when provided", () => {
            delete process.env.MY_LIST;
            expect(envList("MY_LIST", ["x"])).toEqual(["x"]);
        });

        it("Then it returns undefined when no fallback", () => {
            delete process.env.MY_LIST;
            expect(envList("MY_LIST")).toBeUndefined();
        });
    });
});

describe("resolveNodeEnv - Node.js environment resolution", () => {
    describe("Given NODE_ENV is unset", () => {
        it("Then it defaults to development", () => {
            delete process.env.NODE_ENV;
            expect(resolveNodeEnv()).toBe("development");
        });

        it("Then it returns development for empty string", () => {
            process.env.NODE_ENV = "";
            expect(resolveNodeEnv()).toBe("development");
        });
    });

    describe("Given NODE_ENV is set", () => {
        it("Then it normalizes to lowercase", () => {
            process.env.NODE_ENV = "Production";
            expect(resolveNodeEnv()).toBe("production");
        });

        it("Then it normalizes mixed case", () => {
            process.env.NODE_ENV = "DeVelOpMeNt";
            expect(resolveNodeEnv()).toBe("development");
        });

        it("Then it uses the supplied argument over process.env", () => {
            process.env.NODE_ENV = "development";
            expect(resolveNodeEnv("test")).toBe("test");
            expect(resolveNodeEnv("production")).toBe("production");
        });
    });
});

describe("isDevelopment / isProduction /isTest - environment classification", () => {
    describe.each([
        ["development", true, false, false],
        ["production", false, true, false],
        ["test", false, false, true],
        ["staging", false, false, false],
    ])("Given NODE_ENV=%p", (env, dev, prod, test) => {
        it("Then isDevelopment=%s, isProduction=%s, isTest=%s", () => {
            process.env.NODE_ENV = env;
            expect(isDevelopment()).toBe(dev);
            expect(isProduction()).toBe(prod);
            expect(isTest()).toBe(test);
        });
    });

    describe("Given explicit argument override", () => {
        it("Then isDevelopment uses the argument", () => {
            process.env.NODE_ENV = "production";
            expect(isDevelopment("development")).toBe(true);
        });

        it("Then isProduction uses the argument", () => {
            process.env.NODE_ENV = "development";
            expect(isProduction("production")).toBe(true);
        });

        it("Then isTest uses the argument", () => {
            process.env.NODE_ENV = "development";
            expect(isTest("test")).toBe(true);
        });
    });
});

describe("envFile - environment file path resolution", () => {
    describe("Given a base directory and environment", () => {
        it("Then it resolves .env.<env> under baseDir", () => {
            expect(envFile("/app", "production")).toBe("/app/.env.production");
            expect(envFile("/app", "test")).toBe("/app/.env.test");
            expect(envFile("/app", "development")).toBe("/app/.env.development");
            expect(envFile("/app", "staging")).toBe("/app/.env.staging");
        });
    });

    describe("Given no explicit environment", () => {
        it("Then it defaults to process.env.NODE_ENV", () => {
            process.env.NODE_ENV = "production";
            expect(envFile("/app")).toBe("/app/.env.production");

            process.env.NODE_ENV = "test";
            expect(envFile("/app")).toBe("/app/.env.test");
        });
    });
});
