import { resolveConfig, deepFreeze } from "./resolver.js";
import { applyInterpolation } from "./interpolation.js";
import type { EnvironmentMapping, PipelineInput } from "./types.js";

export function buildEnvironmentOverrides(
    mapping: EnvironmentMapping | undefined,
    environment: Record<string, string | undefined>,
): unknown {
    const root: Record<string, unknown> = {};
    if (!mapping) return root;
    for (const [envName, entry] of Object.entries(mapping)) {
        const raw = environment[envName];
        if (raw === undefined) continue;
        if (!entry.path.length) {
            throw new TypeError(`Environment mapping ${envName} must have a non-empty path`);
        }
        let cursor = root;
        for (const segment of entry.path.slice(0, -1)) {
            assertPathSegment(segment, envName);
            const existing = cursor[segment];
            if (existing !== undefined && (existing === null || typeof existing !== "object" || Array.isArray(existing))) {
                throw new TypeError(`Conflicting environment mapping path for ${envName}`);
            }
            if (!existing) {
                Object.defineProperty(cursor, segment, {
                    value: {},
                    enumerable: true,
                    configurable: true,
                    writable: true,
                });
            }
            cursor = cursor[segment] as Record<string, unknown>;
        }
        const finalSegment = entry.path[entry.path.length - 1];
        assertPathSegment(finalSegment, envName);
        Object.defineProperty(cursor, finalSegment, {
            value: entry.parse ? entry.parse(raw) : raw,
            enumerable: true,
            configurable: true,
            writable: true,
        });
    }
    return root;
}

function assertPathSegment(segment: string, envName: string): void {
    if (!segment || segment === "__proto__" || segment === "prototype" || segment === "constructor") {
        throw new TypeError(`Unsafe environment mapping path for ${envName}`);
    }
}

export function parseInteger(value: string): number {
    if (!/^-?\d+$/.test(value.trim())) {
        throw new TypeError("Expected an integer environment value");
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
        throw new TypeError("Environment integer is outside the safe range");
    }
    return parsed;
}

export function parseBoolean(value: string): boolean {
    switch (value.trim().toLowerCase()) {
        case "true":
        case "1":
        case "yes":
        case "on":
            return true;
        case "false":
        case "0":
        case "no":
        case "off":
            return false;
        default:
            throw new TypeError("Expected a boolean environment value (true/false, 1/0, yes/no, on/off)");
    }
}

export function buildResolvedConfig(
    sources: unknown[],
    input: Omit<PipelineInput<unknown>, "schema">,
): unknown {
    const environment = input.environment ?? process.env;
    const interpolatedSources = sources.map((source) =>
        applyInterpolation(source, environment),
    );
    const mappedEnvironment = buildEnvironmentOverrides(input.envMapping, environment);
    const envOverrides = resolveConfig({
        defaults: {},
        sources: [mappedEnvironment, input.envOverrides ?? {}],
        envOverrides: {},
        cliOverrides: {},
    });
    return resolveConfig({
        defaults: input.defaults ?? {},
        sources: interpolatedSources,
        envOverrides,
        cliOverrides: input.cliOverrides ?? {},
    });
}

export function runPipeline<T>(
    sources: unknown[],
    input: PipelineInput<T>,
): T {
    const resolved = buildResolvedConfig(sources, input);
    const validated = input.schema.validate(resolved);
    if (isPromiseLike(validated)) {
        throw new TypeError("Synchronous configuration loading does not support asynchronous validators");
    }
    return deepFreeze(validated);
}

export async function runPipelineAsync<T>(
    sources: unknown[],
    input: PipelineInput<T>,
): Promise<T> {
    const resolved = buildResolvedConfig(sources, input);
    const validated = input.schema.validateAsync
        ? await input.schema.validateAsync(resolved)
        : await input.schema.validate(resolved);
    return deepFreeze(validated);
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
    return value !== null && (typeof value === "object" || typeof value === "function") &&
        typeof (value as { then?: unknown }).then === "function";
}
