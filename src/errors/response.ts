import { OneUnitError } from "./base.js";
import type { OneUnitErrorOptions } from "./types.js";

export class ResponseManagementError extends OneUnitError {
    constructor(message: string, options?: OneUnitErrorOptions) {
        super(message, { category: "response", code: "RESPONSE_ERROR", ...options });
        this.name = "ResponseManagementError";
    }
}

export class ResponseValidationError extends ResponseManagementError {
    constructor(message: string, options?: OneUnitErrorOptions) {
        super(message, { code: "RESPONSE_VALIDATION_ERROR", ...options });
        this.name = "ResponseValidationError";
    }
}

export class InvalidStatusCodeError extends ResponseManagementError {
    constructor(status: number, options?: OneUnitErrorOptions) {
        super(`Invalid HTTP status code: ${status}`, {
            code: "INVALID_STATUS_CODE",
            details: { status },
            ...options,
        });
        this.name = "InvalidStatusCodeError";
    }
}

export class ResponseAlreadySentError extends ResponseManagementError {
    constructor(options?: OneUnitErrorOptions) {
        super("Response has already been sent", {
            code: "RESPONSE_ALREADY_SENT",
            ...options,
        });
        this.name = "ResponseAlreadySentError";
    }
}

export class BodylessStatusError extends ResponseManagementError {
    constructor(status: number, options?: OneUnitErrorOptions) {
        super(`${status} responses cannot include a body`, {
            code: "BODYLESS_STATUS",
            details: { status },
            ...options,
        });
        this.name = "BodylessStatusError";
    }
}
