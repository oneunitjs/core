/**
 * @oneunit/core - CSRF Protection
 *
 * Implements CSRF (Cross-Site Request Forgery) protection using the
 * double-submit cookie pattern with HMAC-signed tokens. A cryptographically
 * random token is stored in a cookie, and the same token must be submitted
 * via a custom header or request body parameter. Since cookies are
 * automatically sent by browsers but custom headers/body cannot be read by
 * cross-origin JavaScript, this prevents CSRF attacks.
 *
 * All issued tokens are HMAC-signed using the configured `secret`, binding
 * the token to the issuing server and preventing cookie-injection attacks
 * (e.g. an attacker setting a cookie via a related subdomain). A signing
 * secret is required; if none is provided, one is generated internally at
 * construction time (tokens will not survive a server restart, which is
 * acceptable for CSRF).
 *
 * Tokens may be bound to an authenticated session via the `sessionId` option.
 * When configured, the session identifier is included in the token signature,
 * so a token issued for one session cannot be replayed against another.
 *
 * Tokens are accepted only from the configured custom header or the request
 * body. Query parameters are never accepted: URLs are recorded in browser
 * history, server logs, and Referer headers.
 *
 * Frontend token delivery: safe methods set the `X-CSRF-Token` response
 * header so a same-origin SPA can read the token despite `HttpOnly` cookies.
 *
 * ```ts
 * import { createCsrf } from "@oneunit/core";
 *
 * const csrf = createCsrf({
 *   cookieName: "_csrf",
 *   headerName: "X-CSRF-Token",
 *   ignoreMethods: ["GET", "HEAD", "OPTIONS"],
 *   secret: process.env.CSRF_SECRET, // required in production
 *   sessionId: (req) => req.session?.id, // bind tokens to the session
 * });
 *
 * // Safe methods bootstrap the cookie + expose token; unsafe methods require
 * // a matching token.
 * app.use(csrf.middlewareWithToken());
 * ```
 */

import { randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import type { CsrfOptions } from "./types.js";
export type { CsrfOptions };

export interface CsrfMiddleware {
    name: string;
    enabled: boolean;
    options: CsrfOptions;
    enable(): void;
    disable(): void;
    toggle(): void;
    generateToken(sessionId?: string): string;
    validateToken(token: string, cookieToken?: string, sessionIdValue?: string): boolean;
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

const MAX_TOKEN_LENGTH = 200;
const TOKEN_FORMAT = /^[0-9a-f]{64}\.[0-9a-f]{64}$/;

function constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function signValue(value: string, secret: string): string {
    return createHmac("sha256", secret).update(value).digest("hex");
}

function verifySignedValue(value: string, signature: string, secret: string): boolean {
    const expected = signValue(value, secret);
    if (expected.length !== signature.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Verify the integrity signature of an issued token. All tokens are signed;
 * tokens without a valid signature are rejected.
 */
function verifyTokenIntegrity(token: string, secret: string, sessionId?: string): boolean {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    if (!payload || !signature) return false;
    if (!verifySignedValue(payload, signature, secret)) return false;
    if (sessionId && payload !== signValue(sessionId, secret)) return false;
    return true;
}

/**
 * Strictly validate a submitted token before any parsing or HMAC work.
 * Returns the normalized string token or undefined when the token is
 * malformed (caller should respond 403).
 */
function normalizeToken(token: unknown): string | undefined {
    if (typeof token !== "string") return undefined;
    if (token.length > MAX_TOKEN_LENGTH) return undefined;
    if (!TOKEN_FORMAT.test(token)) return undefined;
    return token;
}

/**
 * Create a CSRF middleware using the double-submit cookie pattern.
 *
 * @param options - CSRF configuration options
 * @returns A CsrfMiddleware instance
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
        ...(options.secret !== undefined && { secret: options.secret }),
        ...(options.sessionId !== undefined && { sessionId: options.sessionId }),
    };

    // A signing secret is required for CSRF tokens. If none is provided,
    // generate one internally so tokens are always HMAC-signed. Tokens will
    // not survive a server restart when using an internal secret, which is
    // acceptable for CSRF protection. In production, configure an explicit
    // secret via CSRF_SECRET or equivalent.
    const secret = merged.secret ?? randomBytes(32).toString("hex");
    const sessionId: ((req: unknown) => string | undefined) | undefined =
        merged.sessionId;

    let enabled = true;
    const cookieName = merged.cookieName ?? "_csrf";
    const headerName = merged.headerName ?? "X-CSRF-Token";

    function getSessionId(req: unknown): string | undefined {
        if (!sessionId) return undefined;
        return sessionId(req);
    }

    function getTokenFromRequest(req: unknown): string | undefined {
        const headers = (req as any)?.headers;
        if (!headers) return undefined;

        const headerNameLower = headerName.toLowerCase();
        const tokenFromHeader = headers[headerNameLower];
        if (tokenFromHeader) {
            const val = Array.isArray(tokenFromHeader) ? tokenFromHeader[0] : tokenFromHeader;
            return normalizeToken(val) ?? undefined;
        }

        // Tokens are accepted from the request body only. Query parameters
        // are intentionally not accepted: URLs are recorded in browser
        // history, server logs, and Referer headers.
        const body = (req as any)?.body;
        if (body && body[cookieName] !== undefined) {
            return normalizeToken(body[cookieName]) ?? undefined;
        }

        return undefined;
    }

    function getTokenCookie(req: unknown): string | undefined {
        const cookies = (req as any)?.headers?.cookie;
        if (!cookies) return undefined;
        const safeCookieName = cookieName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = cookies.match(new RegExp(`(?:^|; )${safeCookieName}=([^;]+)`));
        return match ? match[1] : undefined;
    }

    function appendHeader(res: any, name: string, value: string): void {
        if (typeof res.getHeader === "function") {
            const existing = res.getHeader(name);
            if (existing !== undefined) {
                const cookies = Array.isArray(existing) ? existing : [existing];
                res.setHeader(name, [...cookies, value]);
                return;
            }
        }
        res.setHeader(name, value);
    }

    function appendCookieHeader(res: any, cookie: string): void {
        appendHeader(res, "Set-Cookie", cookie);
    }

    function setTokenCookie(res: any, token: string): void {
        if (res === null || typeof res.setHeader !== "function") return;
        const cookieOpts = merged.cookieOptions ?? {};
        const parts: string[] = [`${cookieName}=${token}`];
        if (cookieOpts.path) parts.push(`Path=${cookieOpts.path}`);
        if (cookieOpts.domain) parts.push(`Domain=${cookieOpts.domain}`);
        if (cookieOpts.maxAge !== undefined) parts.push(`Max-Age=${cookieOpts.maxAge}`);
        if (cookieOpts.secure !== false) parts.push("Secure");
        if (cookieOpts.httpOnly !== false) parts.push("HttpOnly");
        const ssite = cookieOpts.sameSite ?? "lax";
        if (ssite) parts.push(`SameSite=${typeof ssite === "string" ? ssite : ssite === true ? "Strict" : "Lax"}`);
        appendCookieHeader(res, parts.join("; "));
    }

    function setTokenResponseHeader(res: any, token: string): void {
        if (res === null || typeof res.setHeader !== "function") return;
        // Expose the token to same-origin frontend code despite HttpOnly
        // cookies, so a SPA can copy it into the required request header.
        appendHeader(res, headerName, token);
    }

    function sendCsrfError(res: unknown): void {
        const resAny = res as any;
        if (resAny === null) return;
        if ("statusCode" in resAny) resAny.statusCode = 403;
        if (typeof resAny.end === "function") {
            resAny.end(JSON.stringify({ error: "CSRF token missing or invalid" }));
        }
    }

    function generateToken(sessionIdValue?: string): string {
        const random = randomBytes(32).toString("hex");
        // Bind the token to the session by signing the session id (not the
        // random value) so a token from one session cannot be replayed in
        // another session under the same signing secret.
        const payload = sessionIdValue ? signValue(sessionIdValue, secret) : random;
        return `${payload}.${signValue(payload, secret)}`;
    }

    function validateToken(token: string, cookieToken?: string, sessionIdValue?: string): boolean {
        if (!token || !cookieToken) return false;
        if (!verifyTokenIntegrity(token, secret, sessionIdValue)) return false;
        if (!verifyTokenIntegrity(cookieToken, secret, sessionIdValue)) return false;
        return constantTimeCompare(token, cookieToken);
    }

    function isIgnoredMethod(method: string | undefined): boolean {
        return !!(merged.ignoreMethods && merged.ignoreMethods.includes(method ?? ""));
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
        generateToken,
        validateToken,
        getTokenFromRequest,
        middleware(): (req: unknown, res: any, next?: () => void) => void {
            return (req: any, res: any, next?: () => void) => {
                if (!enabled) {
                    if (next) next();
                    return;
                }

                if (isIgnoredMethod(req?.method)) {
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

                // Safe methods bootstrap the double-submit cookie: issue a
                // token if none exists, then let the request through. The
                // issued token is exposed via a response header so a same
                // origin frontend can copy it into the required request
                // header on subsequent unsafe requests.
                if (isIgnoredMethod(method)) {
                    const cookieToken = getTokenCookie(req);
                    const sid = getSessionId(req);

                    if (!cookieToken) {
                        const newToken = generateToken(sid);
                        setTokenCookie(res, newToken);
                        setTokenResponseHeader(res, newToken);
                    } else {
                        // Refresh invalid cookies on safe requests so a
                        // browser stuck with a bad cookie can recover.
                        if (!verifyTokenIntegrity(cookieToken, secret)) {
                            const newToken = generateToken(sid);
                            setTokenCookie(res, newToken);
                            setTokenResponseHeader(res, newToken);
                        }
                    }
                    if (next) next();
                    return;
                }

                const cookieToken = getTokenCookie(req);
                const token = normalizeToken(getTokenFromRequest(req));
                const sid = getSessionId(req);

                // Never allow an unsafe request through solely because a CSRF
                // cookie is missing. Tokens must be obtained through a safe
                // request first (e.g. a GET that sets the cookie), then echoed
                // on every subsequent state-changing request.
                if (!token || !cookieToken || !validateToken(token, cookieToken, sid)) {
                    sendCsrfError(res);
                    return;
                }

                if (next) next();
            };
        },
    };
}
