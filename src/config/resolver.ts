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

        for (const child of Object.values(value)) {
            deepFreeze(child);
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

    if (isPlainObject(value)) {
        const result: Record<string, unknown> = {};

        for (const [key, val] of Object.entries(value)) {
            result[key] = deepClone(val);
        }

        return result;
    }

    return value;
}
