import type { ErrorContext, ErrorInfo, OneUnitErrorOptions } from "./types.js";

/**
 * Base error class for all @oneunit/core errors.
 * All package-specific errors extend this class.
 */
export class OneUnitError extends Error {
    readonly category: ErrorContext["category"];
    readonly code: string;
    readonly details?: Record<string, unknown>;
    readonly timestamp: string;
    readonly severity: "warning" | "error" | "critical";

    constructor(message: string, options: OneUnitErrorOptions = {}) {
        super(message);
        this.name = "OneUnitError";
        this.category = options.category ?? "core";
        this.code = options.code ?? "UNKNOWN_ERROR";
        this.details = options.details;
        this.severity = options.cause ? "critical" : "error";
        this.timestamp = new Date().toISOString();

        // Maintains proper stack trace in V8 environments
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }

        if (options.cause) {
            this.cause = options.cause;
        }
    }

    toJSON(): ErrorInfo & { message: string; stack?: string } {
        return {
            category: this.category,
            code: this.code,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp,
            severity: this.severity,
            stack: this.stack,
        };
    }
}
