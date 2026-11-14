import { ConfigInterpolationError } from "./errors.js";

const PLACEHOLDER_PATTERN = /\$\{([^}:]+)(?::([^}]*))?\}/g;

export function applyInterpolation(
    value: unknown,
    environment: Record<string, string | undefined>,
): unknown {
    if (typeof value === "string") {
        return interpolateString(value, environment);
    }

    if (Array.isArray(value)) {
        return value.map((item) => applyInterpolation(item, environment));
    }

    if (value !== null && typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = applyInterpolation(val, environment);
        }
        return result;
    }

    return value;
}

function interpolateString(
    value: string,
    environment: Record<string, string | undefined>,
): string {
    return value.replace(PLACEHOLDER_PATTERN, (match, name, fallback) => {
        const envValue = environment[name];

        if (envValue !== undefined) {
            return envValue;
        }

        if (fallback !== undefined) {
            return fallback;
        }

        throw new ConfigInterpolationError(name);
    });
}
