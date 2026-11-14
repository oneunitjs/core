import { describe, expect, it } from "vitest";
import { resolveConfig, deepFreeze } from "../../src/config/resolver.js";

describe("resolveConfig - deterministic precedence and deep merge", () => {
    describe("Given scalar precedence", () => {
        it("Then later scalar replaces earlier scalar", () => {
            const result = resolveConfig({
                defaults: { a: 1 },
                sources: [{ a: 2 }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({ a: 2 });
        });

        it("Then envOverrides win over sources", () => {
            const result = resolveConfig({
                defaults: { port: 3000 },
                sources: [{ port: 4000 }],
                envOverrides: { port: 5000 },
                cliOverrides: {},
            });
            expect(result).toEqual({ port: 5000 });
        });

        it("Then cliOverrides win over envOverrides", () => {
            const result = resolveConfig({
                defaults: { port: 1000 },
                sources: [{ port: 2000 }],
                envOverrides: { port: 3000 },
                cliOverrides: { port: 4000 },
            });
            expect(result).toEqual({ port: 4000 });
        });

        it("Then cliOverrides win without any sources", () => {
            const result = resolveConfig({
                defaults: { port: 1000 },
                sources: [],
                envOverrides: { port: 2000 },
                cliOverrides: { port: 3000 },
            });
            expect(result).toEqual({ port: 3000 });
        });

        it("Then multiple sources respect order - rightmost wins", () => {
            const result = resolveConfig({
                defaults: { port: 1000 },
                sources: [{ port: 2000 }, { port: 3000 }, { port: 4000 }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({ port: 4000 });
        });
    });

    describe("Given nested object merge", () => {
        it("Then nested plain objects merge recursively", () => {
            const result = resolveConfig({
                defaults: { service: { name: "app", port: 3000 } },
                sources: [{ service: { host: "localhost" } }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({
                service: { name: "app", port: 3000, host: "localhost" },
            });
        });

        it("Then deep nesting merges at all levels", () => {
            const result = resolveConfig({
                defaults: { a: { b: { c: 1, d: 2 } } },
                sources: [{ a: { b: { d: 3, e: 4 } } }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({
                a: { b: { c: 1, d: 3, e: 4 } },
            });
        });

        it("Then a scalar replaces an object at the same key", () => {
            const result = resolveConfig({
                defaults: { service: { name: "app" } },
                sources: [{ service: "replaced" }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({ service: "replaced" });
        });

        it("Then an object replaces a scalar at the same key", () => {
            const result = resolveConfig({
                defaults: { service: "simple" },
                sources: [{ service: { name: "complex" } }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({ service: { name: "complex" } });
        });
    });

    describe("Given array semantics", () => {
        it("Then arrays replace as a whole, not concatenate", () => {
            const result = resolveConfig({
                defaults: { origins: ["a.com"] },
                sources: [{ origins: ["b.com"] }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({ origins: ["b.com"] });
        });

        it("Then later array completely replaces earlier array", () => {
            const result = resolveConfig({
                defaults: { features: ["auth"] },
                sources: [{ features: ["auth", "payments"] }, { features: ["billing"] }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({ features: ["billing"] });
        });
    });

    describe("Given null and undefined semantics", () => {
        it("Then null is an explicit value that replaces earlier values", () => {
            const result = resolveConfig({
                defaults: { port: 3000 },
                sources: [{ port: null }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({ port: null });
        });

        it("Then undefined does not override earlier values", () => {
            const result = resolveConfig({
                defaults: { port: 3000 },
                sources: [{ port: undefined as unknown }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({ port: 3000 });
        });

        it("Then null in overrides replaces file values", () => {
            const result = resolveConfig({
                defaults: { port: 3000 },
                sources: [{ port: 4000 }],
                envOverrides: { port: null },
                cliOverrides: {},
            });
            expect(result).toEqual({ port: null });
        });
    });

    describe("Given unsafe key protection", () => {
        it("Then __proto__ keys are rejected", () => {
            const result = resolveConfig({
                defaults: {},
                sources: [{ __proto__: { polluted: true } }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({});
            expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        });

        it("Then prototype keys are rejected", () => {
            const result = resolveConfig({
                defaults: {},
                sources: [{ prototype: 1 }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({});
        });

        it("Then constructor keys are rejected", () => {
            const result = resolveConfig({
                defaults: {},
                sources: [{ constructor: 2 }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({});
        });

        it("Then multiple unsafe keys are all rejected", () => {
            const result = resolveConfig({
                defaults: {},
                sources: [{ __proto__: { x: 1 }, prototype: 2, constructor: 3 }],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({});
        });
    });

    describe("Given input immutability", () => {
        it("Then defaults object is not mutated", () => {
            const defaults = { a: { b: 1 } };
            const before = JSON.parse(JSON.stringify(defaults));

            resolveConfig({
                defaults,
                sources: [{ a: { c: 2 } }],
                envOverrides: {},
                cliOverrides: {},
            });

            expect(defaults).toEqual(before);
        });

        it("Then sources array is not mutated", () => {
            const sources = [{ a: { c: 2 } }];
            const before = JSON.parse(JSON.stringify(sources));

            resolveConfig({
                defaults: { a: { b: 1 } },
                sources,
                envOverrides: {},
                cliOverrides: {},
            });

            expect(sources).toEqual(before);
        });

        it("Then envOverrides and cliOverrides are not mutated", () => {
            const envOverrides = { port: 4000 };
            const cliOverrides = { port: 5000 };
            const beforeEnv = JSON.parse(JSON.stringify(envOverrides));
            const beforeCli = JSON.parse(JSON.stringify(cliOverrides));

            resolveConfig({
                defaults: { port: 3000 },
                sources: [],
                envOverrides,
                cliOverrides,
            });

            expect(envOverrides).toEqual(beforeEnv);
            expect(cliOverrides).toEqual(beforeCli);
        });
    });

    describe("Given edge cases", () => {
        it("Then empty defaults and sources produce empty result", () => {
            const result = resolveConfig({
                defaults: {},
                sources: [],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({});
        });

        it("Then null defaults are treated as empty", () => {
            const result = resolveConfig({
                defaults: null as unknown,
                sources: [],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({});
        });

        it("Then undefined sources are skipped", () => {
            const result = resolveConfig({
                defaults: { a: 1 },
                sources: [undefined as unknown],
                envOverrides: {},
                cliOverrides: {},
            });
            expect(result).toEqual({ a: 1 });
        });
    });
});

describe("deepFreeze - immutability", () => {
    it("Then it freezes plain objects recursively", () => {
        const value = { a: { b: { c: 1 } }, arr: [1, 2, { x: 2 }] };
        const result = deepFreeze(value);

        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.isFrozen(result.a)).toBe(true);
        expect(Object.isFrozen(result.a.b)).toBe(true);
        expect(Object.isFrozen(result.arr)).toBe(true);
        expect(Object.isFrozen(result.arr[2])).toBe(true);
    });

    it("Then it returns primitives unchanged", () => {
        expect(deepFreeze(42)).toBe(42);
        expect(deepFreeze("hello")).toBe("hello");
        expect(deepFreeze(true)).toBe(true);
        expect(deepFreeze(null)).toBeNull();
    });

    it("Then already-frozen objects are returned as-is", () => {
        const frozen = Object.freeze({ a: 1 });
        expect(deepFreeze(frozen)).toBe(frozen);
    });
});
