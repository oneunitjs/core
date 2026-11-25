const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export interface ResolveConfigOptions {
    defaults: unknown;
    sources: unknown[];
    envOverrides: unknown;
    cliOverrides: unknown;
}

export function resolveConfig(options: ResolveConfigOptions): unknown {
    const { defaults, sources, envOverrides, cliOverrides } = options;

    let result = deepClone(defaults ?? {});

    for (const source of sources) {
        result = deepMerge(result, source ?? {});
    }

    result = deepMerge(result, envOverrides ?? {});
    result = deepMerge(result, cliOverrides ?? {});

    return result;
}

function deepMerge(target: unknown, source: unknown): unknown {
    if (isPlainObject(target) && isPlainObject(source)) {
        const result: Record<string, unknown> = { ...target };

        for (const [key, value] of Object.entries(source)) {
            if (UNSAFE_KEYS.has(key)) {
                continue;
            }

            if (value === undefined) {
                continue;
            }

            if (value === null) {
                result[key] = null;
                continue;
            }

            const existing = result[key];

            if (isPlainObject(existing) && isPlainObject(value)) {
                result[key] = deepMerge(existing, value);
            } else {
                result[key] = deepClone(value);
            }
        }

        return result;
    }

    if (source === undefined) {
        return target;
    }

    return deepClone(source);
}

export function deepFreeze<T>(value: T): T {
    if (
        value !== null &&
        typeof value === "object" &&
        !Object.isFrozen(value)
    ) {
        Object.freeze(value);

        if (value instanceof Map) {
            for (const [key, child] of value) {
                deepFreeze(key);
                deepFreeze(child);
            }
        } else if (value instanceof Set) {
            for (const child of value) {
                deepFreeze(child);
            }
        } else {
            for (const child of Object.values(value)) {
                deepFreeze(child);
            }
        }
    }

    return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(deepClone);
    }

    if (value instanceof Map) {
        return new Map([...value.entries()].map(([k, v]) => [deepClone(k), deepClone(v)]));
    }

    if (value instanceof Set) {
        return new Set([...value.values()].map(deepClone));
    }

    if (value instanceof Date) {
        return new Date(value.getTime());
    }

    if (isPlainObject(value)) {
        const result: Record<string, unknown> = {};

        for (const [key, val] of Object.entries(value)) {
            if (UNSAFE_KEYS.has(key)) {
                continue;
            }
            result[key] = deepClone(val);
        }

        return result;
    }

    return value;
}
