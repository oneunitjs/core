import { OneUnitError } from "./base.js";
import type { OneUnitErrorOptions } from "./types.js";

export class LibError extends OneUnitError {
    constructor(message: string, options?: OneUnitErrorOptions) {
        super(message, { category: "lib", code: "LIB_ERROR", ...options });
        this.name = "LibError";
    }
}

export class InvalidBytesError extends LibError {
    constructor(options?: OneUnitErrorOptions) {
        super("Bytes must be a finite number", {
            code: "INVALID_BYTES",
            ...options,
        });
        this.name = "InvalidBytesError";
    }
}

export class NegativeBytesError extends LibError {
    constructor(options?: OneUnitErrorOptions) {
        super("Bytes must be positive", {
            code: "NEGATIVE_BYTES",
            ...options,
        });
        this.name = "NegativeBytesError";
    }
}

export class InvalidTimeError extends LibError {
    constructor(options?: OneUnitErrorOptions) {
        super("Time must be a finite number", {
            code: "INVALID_TIME",
            ...options,
        });
        this.name = "InvalidTimeError";
    }
}

export class NegativeTimeError extends LibError {
    constructor(options?: OneUnitErrorOptions) {
        super("Time must be positive", {
            code: "NEGATIVE_TIME",
            ...options,
        });
        this.name = "NegativeTimeError";
    }
}

export class InvalidDateError extends LibError {
    constructor(options?: OneUnitErrorOptions) {
        super("Data must be a Date object", {
            code: "INVALID_DATE",
            ...options,
        });
        this.name = "InvalidDateError";
    }
}
