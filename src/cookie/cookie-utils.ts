import type { CookieOptions } from "./types.js";
import { SameSiteNoneRequiresSecureError } from "../errors/cookie.js";

/**
 * Parse a cookie header string into a record of name->value pairs.
 */
export function parseCookieHeader(cookieHeader: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const part of cookieHeader.split(";")) {
        const [key, ...valParts] = part.split("=");
        if (key) {
            result[key.trim()] = valParts.join("=").trim();
        }
    }
    return result;
}

/**
 * Convert a SameSite option value to its header string form.
 */
export function sameSiteAttr(value: CookieOptions["sameSite"] | undefined): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value === "string") return value.charAt(0).toUpperCase() + value.slice(1);
    if (value === true) return "Strict";
    return String(value);
}

/**
 * Build Set-Cookie header parts from a cookie name, value, and options.
 */
export function buildCookieParts(
    name: string,
    value: string,
    options: CookieOptions,
): string[] {
    const parts: string[] = [`${name}=${value}`];

    if (options.path) parts.push(`Path=${options.path}`);
    if (options.domain) parts.push(`Domain=${options.domain}`);
    if (options.maxAge !== undefined && options.maxAge !== 0)
        parts.push(`Max-Age=${options.maxAge}`);
    if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
    if (options.secure) parts.push("Secure");
    if (options.httpOnly) parts.push("HttpOnly");

    const ssite = sameSiteAttr(options.sameSite);
    if (ssite) parts.push(`SameSite=${ssite}`);

    return parts;
}

/**
 * Serialize a cookie into a Set-Cookie header string.
 * Validates SameSite=None requires Secure and cookie name safety.
 */
export function serializeCookieString(
    name: string,
    value: string,
    options: CookieOptions,
): string {
    validateCookieName(name);
    if (options.sameSite === "none" && options.secure !== true) {
        throw new SameSiteNoneRequiresSecureError();
    }
    return buildCookieParts(name, value, options).join("; ");
}

/**
 * Build a delete-cookie header string (expires the cookie).
 */
export function buildDeleteCookieParts(
    name: string,
    options: { path?: string; domain?: string } = {},
): string[] {
    const parts: string[] = [`${name}=;`];
    if (options.path) parts.push(`Path=${options.path}`);
    if (options.domain) parts.push(`Domain=${options.domain}`);
    parts.push("Max-Age=0");

    const isSecurePrefixed =
        name.startsWith("__Secure-") || name.startsWith("__Host-");
    if (isSecurePrefixed) parts.push("Secure");

    return parts;
}

/**
 * Validate a cookie name contains no illegal characters.
 */
export function validateCookieName(name: string): void {
    if (!name || /[=;\s]/.test(name)) {
        throw new Error(`Invalid cookie name: ${name}`);
    }
}