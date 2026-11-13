export type ErrorCategory =
    | "response"
    | "cookie"
    | "lifecycle"
    | "multipart"
    | "hooks"
    | "lib"
    | "core"
    | "security"
    | "health"
    | "config"
    | "msgpack";

export interface ErrorContext {
    category: ErrorCategory;
    code: string;
    details?: Record<string, unknown>;
}

export interface OneUnitErrorOptions {
    category?: ErrorCategory;
    code?: string;
    details?: Record<string, unknown>;
    cause?: Error;
}

export type ErrorSeverity = "warning" | "error" | "critical";

export interface ErrorInfo {
    category: ErrorCategory;
    code: string;
    message: string;
    severity: ErrorSeverity;
    details?: Record<string, unknown>;
    timestamp: string;
}

export function createErrorInfo(
    category: ErrorCategory,
    code: string,
    message: string,
    severity: ErrorSeverity = "error",
    details?: Record<string, unknown>,
): ErrorInfo {
    return {
        category,
        code,
        message,
        severity,
        details,
        timestamp: new Date().toISOString(),
    };
}
