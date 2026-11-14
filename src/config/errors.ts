import { OneUnitError } from "../errors/base.js";
import type { OneUnitErrorOptions } from "../errors/types.js";

export class ConfigSourceError extends OneUnitError {
    constructor(message: string, options?: OneUnitErrorOptions) {
        super(message, {
            category: "config",
            code: "CONFIG_SOURCE_ERROR",
            ...options,
        });
        this.name = "ConfigSourceError";
    }
}

export class ConfigInterpolationError extends OneUnitError {
    constructor(public readonly referenceName: string, options?: OneUnitErrorOptions) {
        super(
            `Required configuration reference is unavailable: ${referenceName}`,
            {
                category: "config",
                code: "CONFIG_INTERPOLATION_ERROR",
                details: { reference: referenceName },
                ...options,
            },
        );
        this.name = "ConfigInterpolationError";
    }
}

export class ConfigValidationError extends OneUnitError {
    constructor(
        message: string,
        public readonly issues?: readonly unknown[],
        options?: OneUnitErrorOptions,
    ) {
        super(message, {
            category: "config",
            code: "CONFIG_VALIDATION_ERROR",
            details: { issues },
            ...options,
        });
        this.name = "ConfigValidationError";
    }
}

export const ConfigErrorCode = {
    CONFIG_SOURCE_ERROR: "CONFIG_SOURCE_ERROR",
    CONFIG_INTERPOLATION_ERROR: "CONFIG_INTERPOLATION_ERROR",
    CONFIG_VALIDATION_ERROR: "CONFIG_VALIDATION_ERROR",
} as const;
