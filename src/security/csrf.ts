import type { CsrfOptions } from "./types.js";
export type { CsrfOptions };

const DEFAULT_CSRF_OPTIONS: CsrfOptions = {
    cookieName: "_csrf",
    headerName: "X-CSRF-Token",
    ignoreMethods: ["GET", "HEAD", "OPTIONS"],
};

export interface CsrfMiddleware {
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
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export function createCsrf(options: CsrfOptions = {}): CsrfMiddleware {
    const merged: CsrfOptions = {
        secret: options.secret ?? generateToken(32),
        cookieName: options.cookieName ?? DEFAULT_CSRF_OPTIONS.cookieName,
        headerName: options.headerName ?? DEFAULT_CSRF_OPTIONS.headerName,
        cookieOptions: options.cookieOptions ?? {},
        ignoreMethods: options.ignoreMethods ?? DEFAULT_CSRF_OPTIONS.ignoreMethods,
    };

    let enabled = true;
    let token = generateToken();

    function generateTokenFn(): string {
        token = generateToken();
        return token;
    }

    function validateToken(tokenToValidate: string): boolean {
        if (!tokenToValidate || !token) return false;
        return tokenToValidate === token;
    }

    function getTokenFromRequest(req: unknown): string | undefined {
        const headers = (req as any)?.headers;
        if (!headers) return undefined;

        const headerNameLower = merged.headerName?.toLowerCase();
        if (headerNameLower) {
            const tokenFromHeader = headers[headerNameLower];
            if (tokenFromHeader) return Array.isArray(tokenFromHeader) ? tokenFromHeader[0] : tokenFromHeader;
        }

        const query = (req as any)?.query;
        if (query && query._csrf) return query._csrf;

        const body = (req as any)?.body;
        if (body && body._csrf) return body._csrf;

        return undefined;
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
                if (typeof res === "object" && res !== null && "statusCode" in res) {
                    (res as any).statusCode = 403;
                }
                if (typeof res.end === "function") {
                    res.end(JSON.stringify({ error: "CSRF token missing or invalid" }));
                }
                return;
            }

            if (next) next();
        };
    }

    function middlewareWithToken(): (req: any, res: unknown, next?: () => void) => void {
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
                if (typeof res === "object" && res !== null && "statusCode" in res) {
                    (res as any).statusCode = 403;
                }
                if (typeof res.end === "function") {
                    res.end(JSON.stringify({ error: "CSRF token missing or invalid" }));
                }
                return;
            }

            if (next) next();
        };
    }

    return {
        get enabled() { return enabled; },
        get options() { return { ...merged }; },
        enable() { enabled = true; },
        disable() { enabled = false; },
        toggle() { enabled = !enabled; },
        generateToken: generateTokenFn,
        validateToken: validateToken,
        getTokenFromRequest,
        middleware,
        middlewareWithToken,
    };
}
