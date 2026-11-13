import { randomBytes, timingSafeEqual } from "node:crypto";
import type { CsrfOptions } from "./types.js";
export type { CsrfOptions };

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

export interface CsrfMiddleware {
    name: string;
    enabled: boolean;
    options: CsrfOptions;
    enable(): void;
    disable(): void;
    toggle(): void;
    generateToken(): string;
    validateToken(token: string): boolean;
    getTokenFromRequest(req: unknown): string | undefined;
    middleware(): (req: unknown, res: unknown, next?: () => void) => void;
    middlewareWithToken(): (req: unknown, res: unknown, next?: () => void) => void;
}

function generateToken(length: number = 32): string {
    return randomBytes(length).toString("hex");
}

export function createCsrf(options: CsrfOptions = {}): CsrfMiddleware {
    const merged: CsrfOptions = {
        secret: options.secret ?? generateToken(32),
        cookieName: options.cookieName ?? DEFAULT_CSRF_OPTIONS.cookieName,
        headerName: options.headerName ?? DEFAULT_CSRF_OPTIONS.headerName,
        cookieOptions: {
            ...DEFAULT_CSRF_OPTIONS.cookieOptions,
            ...options.cookieOptions,
        },
        ignoreMethods: options.ignoreMethods ?? DEFAULT_CSRF_OPTIONS.ignoreMethods,
    };

    let enabled = true;
    const tokens = new Map<string, { value: string; createdAt: number }>();
    const TOKEN_TTL_MS = 10 * 60 * 1000;

    function generateTokenFn(): string {
        const token = generateToken();
        tokens.set(token, { value: token, createdAt: Date.now() });
        cleanupTokens();
        return token;
    }

    function cleanupTokens(): void {
        const now = Date.now();
        for (const [key, entry] of tokens) {
            if (now - entry.createdAt > TOKEN_TTL_MS) {
                tokens.delete(key);
            }
        }
    }

    function constantTimeCompare(a: string, b: string): boolean {
        if (a.length !== b.length) return false;
        return timingSafeEqual(Buffer.from(a), Buffer.from(b));
    }

    function validateToken(tokenToValidate: string): boolean {
        if (!tokenToValidate) return false;
        const entry = tokens.get(tokenToValidate);
        if (!entry) return false;
        if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
            tokens.delete(tokenToValidate);
            return false;
        }
        return constantTimeCompare(tokenToValidate, entry.value);
    }

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

    function middleware(): (req: any, res: any, next?: () => void) => void {
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
            if (!token || !validateToken(token)) {
                sendCsrfError(res);
                return;
            }

            if (next) next();
        };
    }

    function middlewareWithToken(): (req: any, res: any, next?: () => void) => void {
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

            if (!token || !cookieToken || !validateToken(token) || !constantTimeCompare(token, cookieToken)) {
                sendCsrfError(res);
                return;
            }

            setTokenCookie(res, cookieToken);
            if (next) next();
        };
    }

    return {
        name: "csrf",
        get enabled() { return enabled; },
        get options() { return { ...merged }; },
        enable() { enabled = true; },
        disable() { enabled = false; },
        toggle() { enabled = !enabled; },
        generateToken: generateTokenFn,
        validateToken,
        getTokenFromRequest,
        middleware,
        middlewareWithToken,
    };
}
