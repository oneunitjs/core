import { OneUnitError } from "./base.js";
import type { OneUnitErrorOptions } from "./types.js";

export class CookieError extends OneUnitError {
    constructor(message: string, options?: OneUnitErrorOptions) {
        super(message, { category: "cookie", code: "COOKIE_ERROR", ...options });
        this.name = "CookieError";
    }
}

export class CookieSecretRequiredError extends CookieError {
    constructor(name: string, kind: string, options?: OneUnitErrorOptions) {
        super(`Secret required for ${kind} cookie "${name}"`, {
            code: "COOKIE_SECRET_REQUIRED",
            details: { name, kind },
            ...options,
        });
        this.name = "CookieSecretRequiredError";
    }
}

export class InvalidCookieNameError extends CookieError {
    constructor(name: string, options?: OneUnitErrorOptions) {
        super(`Invalid cookie name: ${name}`, {
            code: "INVALID_COOKIE_NAME",
            details: { name },
            ...options,
        });
        this.name = "InvalidCookieNameError";
    }
}

export class CookieSecurePrefixError extends CookieError {
    constructor(name: string, requirement: string, options?: OneUnitErrorOptions) {
        super(`Cookie "${name}" ${requirement}`, {
            code: "COOKIE_SECURE_PREFIX_ERROR",
            details: { name, requirement },
            ...options,
        });
        this.name = "CookieSecurePrefixError";
    }
}

export class SameSiteNoneRequiresSecureError extends CookieError {
    constructor(options?: OneUnitErrorOptions) {
        super("SameSite=None requires Secure", {
            code: "SAMESITE_NONE_REQUIRES_SECURE",
            ...options,
        });
        this.name = "SameSiteNoneRequiresSecureError";
    }
}

export class CookieDecryptionError extends CookieError {
    constructor(name: string, options?: OneUnitErrorOptions) {
        super(`Failed to decrypt cookie "${name}"`, {
            code: "COOKIE_DECRYPTION_ERROR",
            details: { name },
            ...options,
        });
        this.name = "CookieDecryptionError";
    }
}

export class CookieSignatureError extends CookieError {
    constructor(name: string, options?: OneUnitErrorOptions) {
        super(`Invalid signature for cookie "${name}"`, {
            code: "COOKIE_SIGNATURE_ERROR",
            details: { name },
            ...options,
        });
        this.name = "CookieSignatureError";
    }
}
