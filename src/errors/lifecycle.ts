import { OneUnitError } from "./base.js";
import type { OneUnitErrorOptions } from "./types.js";

export class LifecycleError extends OneUnitError {
    constructor(message: string, options?: OneUnitErrorOptions) {
        super(message, { category: "lifecycle", code: "LIFECYCLE_ERROR", ...options });
        this.name = "LifecycleError";
    }
}

export class LifecycleNotInitializedError extends LifecycleError {
    constructor(options?: OneUnitErrorOptions) {
        super("Lifecycle not initialized", {
            code: "LIFECYCLE_NOT_INITIALIZED",
            ...options,
        });
        this.name = "LifecycleNotInitializedError";
    }
}

export class MiddlewareLimitError extends LifecycleError {
    constructor(limit: number, options?: OneUnitErrorOptions) {
        super(`Maximum middleware limit (${limit}) reached`, {
            code: "MIDDLEWARE_LIMIT_EXCEEDED",
            details: { limit },
            ...options,
        });
        this.name = "MiddlewareLimitError";
    }
}

export class MiddlewareTypeNotAllowedError extends LifecycleError {
    constructor(type: string, options?: OneUnitErrorOptions) {
        super(`Middleware type "${type}" is not allowed in current mode`, {
            code: "MIDDLEWARE_TYPE_NOT_ALLOWED",
            details: { type },
            ...options,
        });
        this.name = "MiddlewareTypeNotAllowedError";
    }
}

export class MiddlewareNotFoundError extends LifecycleError {
    constructor(name: string, options?: OneUnitErrorOptions) {
        super(`Middleware "${name}" not found`, {
            code: "MIDDLEWARE_NOT_FOUND",
            details: { name },
            ...options,
        });
        this.name = "MiddlewareNotFoundError";
    }
}

export class MiddlewareTimeoutError extends LifecycleError {
    constructor(name: string, options?: OneUnitErrorOptions) {
        super(`Middleware "${name}" timed out`, {
            code: "MIDDLEWARE_TIMEOUT",
            details: { name },
            ...options,
        });
        this.name = "MiddlewareTimeoutError";
    }
}

export class PluginLimitError extends LifecycleError {
    constructor(limit: number, options?: OneUnitErrorOptions) {
        super(`Maximum plugin limit (${limit}) reached`, {
            code: "PLUGIN_LIMIT_EXCEEDED",
            details: { limit },
            ...options,
        });
        this.name = "PluginLimitError";
    }
}

export class PluginAlreadyExistsError extends LifecycleError {
    constructor(name: string, namespace: string, options?: OneUnitErrorOptions) {
        super(`Plugin "${name}" already exists in namespace "${namespace}"`, {
            code: "PLUGIN_ALREADY_EXISTS",
            details: { name, namespace },
            ...options,
        });
        this.name = "PluginAlreadyExistsError";
    }
}

export class MiddlewareConflictError extends LifecycleError {
    constructor(name: string, conflictWith: string[], options?: OneUnitErrorOptions) {
        super(
            `Middleware type conflict for "${name}": already registered by ${conflictWith.join(", ")}`,
            {
                code: "MIDDLEWARE_CONFLICT",
                details: { name, conflictWith },
                ...options,
            },
        );
        this.name = "MiddlewareConflictError";
    }
}

export class MiddlewareTypeConflictError extends LifecycleError {
    constructor(name: string, existingType: string, options?: OneUnitErrorOptions) {
        super(`Middleware type "${existingType}" already registered by ${name}`, {
            code: "MIDDLEWARE_TYPE_CONFLICT",
            details: { name, existingType },
            ...options,
        });
        this.name = "MiddlewareTypeConflictError";
    }
}

export class HeaderConflictError extends LifecycleError {
    constructor(header: string, setBy: string[], options?: OneUnitErrorOptions) {
        super(`Header conflict for "${header}": set by ${setBy.join(", ")}`, {
            code: "HEADER_CONFLICT",
            details: { header, setBy },
            ...options,
        });
        this.name = "HeaderConflictError";
    }
}
