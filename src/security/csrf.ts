/**
 * @oneunit/core - CSRF Protection
 *
 * Implements CSRF (Cross-Site Request Forgery) protection using the
 * double-submit cookie pattern. A cryptographically random token is
 * stored in a cookie, and the same token must be submitted via a custom
 * header or request body parameter. Since cookies are automatically sent by
 * browsers but custom headers/body cannot be read by cross-origin JavaScript,
 * this prevents CSRF attacks.
 *
 * ```ts
 * import { createCsrf } from "@oneunit/core";
 *
 * const csrf = createCsrf({
 *   cookieName: "_csrf",
 *   headerName: "X-CSRF-Token",
 *   ignoreMethods: ["GET", "HEAD", "OPTIONS"],
 * });
 *
 * // Express middleware
 * app.use(csrf.middleware());
 * ```
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import type { CsrfOptions } from "./types.js";
export type { CsrfOptions };

export interface CsrfMiddleware {
    name: string;
    enabled: boolean;
    options: CsrfOptions;
    enable(): void;
    disable(): void;
    toggle(): void;
    generateToken(): string;
    validateToken(token: string, cookieToken?: string): boolean;
    getTokenFromRequest(req: unknown): string | undefined;
    middleware(): (req: unknown, res: unknown, next?: () => void) => void;
    middlewareWithToken(): (req: unknown, res: unknown, next?: () => void) => void;
}

const DEFAULT_CSRF_OPTIONS: CsrfOptions = {
    cookieName: "_csrf",
    headerName: "X-CSRF-Token",
    ignoreMethods: ["GET", "HEAD", "OPTIONS"],
    cookieOptions: {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    },
};

function constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Creates a CSRF middleware using the double-submit cookie pattern.
 *
 * A cryptographically random token is stored in a cookie, and the same
 * token must be submitted via a custom header or request body parameter.
 * Since cookies are automatically sent by browsers but custom headers
 * cannot be read by cross-origin JavaScript, this prevents CSRF attacks.
 *
 * @param options - CSRF configuration options
 * @returns A CsrfMiddleware instance
 *
 * @example
 * ```ts
 * const csrf = createCsrf({
 *   cookieName: "_csrf",
 *   headerName: "X-CSRF-Token",
 *   ignoreMethods: ["GET", "HEAD", "OPTIONS"],
 *   cookieOptions: {
 *     path: "/",
 *     sameSite: "lax",
 *     httpOnly: true,
 *     secure: true,
 *   },
 * });
 *
 * app.use(csrf.middleware());
 * ```
 */
export function createCsrf(options: CsrfOptions = {}): CsrfMiddleware {
    const merged: CsrfOptions = {
        cookieName: options.cookieName ?? DEFAULT_CSRF_OPTIONS.cookieName,
        headerName: options.headerName ?? DEFAULT_CSRF_OPTIONS.headerName,
        ignoreMethods: options.ignoreMethods ?? DEFAULT_CSRF_OPTIONS.ignoreMethods,
        cookieOptions: {
            ...DEFAULT_CSRF_OPTIONS.cookieOptions,
            ...options.cookieOptions,
        },
    };

    let enabled = true;

    function getTokenFromRequest(req: unknown): string | undefined {
        const headers = (req as any)?.headers;
        if (!headers) return undefined;

        const headerNameLower = merged.headerName?.toLowerCase();
        if (headerNameLower) {
            const tokenFromHeader = headers[headerNameLower];
            if (tokenFromHeader) return Array.isArray(tokenFromHeader) ? tokenFromHeader[0] : tokenFromHeader;
        }

        const cookieName = merged.cookieName ?? "_csrf";
        const query = (req as any)?.query;
        if (query && query[cookieName]) {
            return query[cookieName];
        }

        const body = (req as any)?.body;
        if (body && body[cookieName]) {
            return body[cookieName];
        }

        return undefined;
    }

    function getTokenCookie(req: unknown): string | undefined {
        const cookies = (req as any)?.headers?.cookie;
        if (!cookies) return undefined;
        const cookieName = merged.cookieName ?? "_csrf";
        const match = cookies.match(new RegExp(`(?:^|; )${cookieName}=([^;]+)`));
        return match ? match[1] : undefined;
    }

    function setTokenCookie(res: unknown, token: string): void {
        const resAny = res as any;
        if (resAny === null || typeof resAny.setHeader !== "function") return;
        const cookieOpts = merged.cookieOptions ?? {};
        const parts: string[] = [`${merged.cookieName ?? "_csrf"}=${token}`];
        if (cookieOpts.path) parts.push(`Path=${cookieOpts.path}`);
        if (cookieOpts.domain) parts.push(`Domain=${cookieOpts.domain}`);
        if (cookieOpts.maxAge !== undefined) parts.push(`Max-Age=${cookieOpts.maxAge}`);
        if (cookieOpts.secure !== false) parts.push("Secure");
        if (cookieOpts.httpOnly !== false) parts.push("HttpOnly");
        const ssite = cookieOpts.sameSite ?? "lax";
        if (ssite) parts.push(`SameSite=${typeof ssite === "string" ? ssite : ssite === true ? "Strict" : "Lax"}`);
        resAny.setHeader("Set-Cookie", parts.join("; "));
    }

    function sendCsrfError(res: unknown): void {
        const resAny = res as any;
        if (resAny === null) return;
        if ("statusCode" in resAny) resAny.statusCode = 403;
        if (typeof resAny.end === "function") {
            resAny.end(JSON.stringify({ error: "CSRF token missing or invalid" }));
        }
    }

    function validateToken(token: string, cookieToken?: string): boolean {
        if (!token) return false;
        if (!cookieToken) return false;
        return constantTimeCompare(token, cookieToken);
    }

    return {
        name: "csrf",
        get enabled() {
            return enabled;
        },
        get options() {
            return { ...merged };
        },
        enable() {
            enabled = true;
        },
        disable() {
            enabled = false;
        },
        toggle() {
            enabled = !enabled;
        },
        generateToken(): string {
            return randomBytes(32).toString("hex");
        },
        validateToken,
        getTokenFromRequest,
        middleware(): (req: unknown, res: any, next?: () => void) => void {
            return (req: any, res: any, next?: () => void) => {
                if (!enabled) {
                    if (next) next();
                    return;
                }

                const method = req?.method;
                if (merged.ignoreMethods && merged.ignoreMethods.includes(method ?? "")) {
                    if (next) next();
                    return;
                }

                const token = getTokenFromRequest(req);
                const cookieToken = getTokenCookie(req);

                if (!token || !cookieToken || !validateToken(token, cookieToken)) {
                    sendCsrfError(res);
                    return;
                }

                if (next) next();
            };
        },
        middlewareWithToken(): (req: unknown, res: any, next?: () => void) => void {
            return (req: any, res: any, next?: () => void) => {
                if (!enabled) {
                    if (next) next();
                    return;
                }

                const method = req?.method;
                if (merged.ignoreMethods && merged.ignoreMethods.includes(method ?? "")) {
                    if (next) next();
                    return;
                }

                const token = getTokenFromRequest(req);
                const cookieToken = getTokenCookie(req);

                if (!token || !cookieToken || !validateToken(token, cookieToken)) {
                    sendCsrfError(res);
                    return;
                }

                // Only set a new cookie token when no existing valid cookie
                // token was present; do not rotate the token on every request.
                if (!cookieToken) {
                    setTokenCookie(res, cookieToken);
                }
                if (next) next();
            };
        },
    };
}
