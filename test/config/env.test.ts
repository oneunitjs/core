import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

describe("envString", () => {
    it("returns the trimmed value when set", () => {
        process.env.MY_VAR = "  hello  ";
        expect(envString("MY_VAR")).toBe("hello");
    });

    it("returns the fallback when unset", () => {
        delete process.env.MY_VAR;
        expect(envString("MY_VAR", "fallback")).toBe("fallback");
    });

    it("returns undefined when unset and no fallback", () => {
        delete process.env.MY_VAR;
        expect(envString("MY_VAR")).toBeUndefined();
    });

    it("returns the fallback for empty or whitespace-only values", () => {
        process.env.MY_VAR = "   ";
        expect(envString("MY_VAR", "fallback")).toBe("fallback");
    });
});

describe("envNumber", () => {
    it("parses a numeric value", () => {
        process.env.MY_NUM = "42";
        expect(envNumber("MY_NUM")).toBe(42);
    });

    it("returns the fallback when unset", () => {
        delete process.env.MY_NUM;
        expect(envNumber("MY_NUM", 7)).toBe(7);
    });

    it("returns the fallback when the value is not a finite number", () => {
        process.env.MY_NUM = "not-a-number";
        expect(envNumber("MY_NUM", 3)).toBe(3);
    });

    it("returns undefined when unset and no fallback", () => {
        delete process.env.MY_NUM;
        expect(envNumber("MY_NUM")).toBeUndefined();
    });
});

describe("envBool", () => {
    it.each([
        ["true", true],
        ["1", true],
        ["yes", true],
        ["on", true],
        ["True", true],
        ["YES", true],
    ])("treats %p as true", (value, expected) => {
        process.env.MY_BOOL = value;
        expect(envBool("MY_BOOL")).toBe(expected);
    });

    it.each([
        ["false", false],
        ["0", false],
        ["no", false],
        ["off", false],
        ["False", false],
        ["NO", false],
    ])("treats %p as false", (value, expected) => {
        process.env.MY_BOOL = value;
        expect(envBool("MY_BOOL")).toBe(expected);
    });

    it("returns the fallback for unrecognized values", () => {
        process.env.MY_BOOL = "maybe";
        expect(envBool("MY_BOOL", false)).toBe(false);
    });

    it("returns undefined when unset and no fallback", () => {
        delete process.env.MY_BOOL;
        expect(envBool("MY_BOOL")).toBeUndefined();
    });
});

describe("envList", () => {
    it("splits, trims, and filters empty items", () => {
        process.env.MY_LIST = "a, b ,, c  ,";
        expect(envList("MY_LIST")).toEqual(["a", "b", "c"]);
    });

    it("returns the fallback when unset", () => {
        delete process.env.MY_LIST;
        expect(envList("MY_LIST", ["x"])).toEqual(["x"]);
    });

    it("returns undefined when unset and no fallback", () => {
        delete process.env.MY_LIST;
        expect(envList("MY_LIST")).toBeUndefined();
    });
});

describe("resolveNodeEnv", () => {
    it("defaults to development", () => {
        delete process.env.NODE_ENV;
        expect(resolveNodeEnv()).toBe("development");
    });

    it("normalizes to lowercase", () => {
        process.env.NODE_ENV = "Production";
        expect(resolveNodeEnv()).toBe("production");
    });

    it("uses the supplied argument", () => {
        process.env.NODE_ENV = "development";
        expect(resolveNodeEnv("test")).toBe("test");
    });
});

describe("isDevelopment / isProduction / isTest", () => {
    it.each([
        ["development", true, false, false],
        ["production", false, true, false],
        ["test", false, false, true],
        ["staging", false, false, false],
    ])("classifies %p correctly", (env, dev, prod, test) => {
        process.env.NODE_ENV = env;
        expect(isDevelopment()).toBe(dev);
        expect(isProduction()).toBe(prod);
        expect(isTest()).toBe(test);
    });
});

describe("envFile", () => {
    it("resolves .env.<env> under baseDir", () => {
        expect(envFile("/app", "production")).toBe("/app/.env.production");
        expect(envFile("/app", "test")).toBe("/app/.env.test");
        expect(envFile("/app", "development")).toBe("/app/.env.development");
    });

    it("defaults to process.env.NODE_ENV", () => {
        process.env.NODE_ENV = "production";
        expect(envFile("/app")).toBe("/app/.env.production");
    });
});
