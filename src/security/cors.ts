import type { CorsOptions } from "./types.js";
export type { CorsOptions };
import { createSecurityMiddlewareBase } from "./middleware-base.js";

const DEFAULT_CORS_OPTIONS: CorsOptions = {
    origin: "*",
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
    exposedHeaders: [],
    credentials: false,
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
};

type OriginValue = string | string[] | boolean;

function normalizeOriginValue(origin: CorsOptions["origin"]): OriginValue {
    if (origin === undefined) return DEFAULT_CORS_OPTIONS.origin!;
    return origin;
}

function isOriginAllowed(origin: string | undefined, allowed: OriginValue): boolean {
    if (!origin) return false;
    if (allowed === true) return true;
    if (allowed === false) return false;
    if (typeof allowed === "string") return allowed === origin || allowed === "*";
    if (Array.isArray(allowed)) return allowed.includes(origin);
    return false;
}

/**
 * Resolve the Access-Control-Allow-Origin value to echo back.
 *
 * When credentials are enabled, a wildcard origin is never echoed back
 * because the CORS specification forbids `Access-Control-Allow-Origin: *`
 * together with `Access-Control-Allow-Credentials: true`. Callers must
 * supply an explicit origin allowlist (or `true`) when credentials are used.
 */
function resolveOrigin(origin: string | undefined, allowed: OriginValue, credentials: boolean): string | null {
    if (allowed === true) return origin ?? null;
    if (allowed === false) return null;
    if (typeof allowed === "string") {
        if (allowed === "*") {
            if (credentials) return null;
            return "*";
        }
        if (!origin) return allowed;
        return allowed === origin ? allowed : null;
    }
    if (Array.isArray(allowed)) {
        if (!origin) return null;
        return allowed.includes(origin) ? origin : null;
    }
    return null;
}

function headerList(value: string[] | undefined): string | undefined {
    if (!value || value.length === 0) return undefined;
    return value.join(", ");
}

/**
 * Append a value to an existing comma-separated header without clobbering
 * values already set by the application or other middleware.
 */
function appendVary(res: any, value: string): void {
    if (typeof res.getHeader === "function") {
        const existing = res.getHeader("Vary");
        if (existing !== undefined) {
            value = Array.isArray(existing)
                ? existing.concat([value]).join(", ")
                : `${existing}, ${value}`;
        }
    }
    res.setHeader("Vary", value);
}

export interface CorsMiddleware {
    name: string;
    enabled: boolean;
    options: CorsOptions;
    enable(): void;
    disable(): void;
    toggle(): void;
    middleware(): (req: unknown, res: unknown, next?: () => void) => void;
    headers(): { headers: Record<string, string>; varyOrigin: boolean };
}

export function createCors(options: CorsOptions = {}): CorsMiddleware {
    const merged: CorsOptions = {
        origin: normalizeOriginValue(options.origin),
        methods: options.methods ?? DEFAULT_CORS_OPTIONS.methods,
        allowedHeaders: options.allowedHeaders ?? DEFAULT_CORS_OPTIONS.allowedHeaders,
        exposedHeaders: options.exposedHeaders ?? DEFAULT_CORS_OPTIONS.exposedHeaders,
        credentials: options.credentials ?? DEFAULT_CORS_OPTIONS.credentials,
        maxAge: options.maxAge ?? DEFAULT_CORS_OPTIONS.maxAge,
        preflightContinue: options.preflightContinue ?? DEFAULT_CORS_OPTIONS.preflightContinue,
        optionsSuccessStatus: options.optionsSuccessStatus ?? DEFAULT_CORS_OPTIONS.optionsSuccessStatus,
    };

    const credentials = !!merged.credentials;
    const originValue: OriginValue = merged.origin as OriginValue;
    const methodsHeader = headerList(merged.methods);
    const allowedHeadersHeader = headerList(merged.allowedHeaders);
    const exposedHeadersHeader = headerList(merged.exposedHeaders);
    const credentialsHeader = String(credentials);
    const maxAgeHeader = String(merged.maxAge ?? 0);

    function headers(originHeader: string | undefined): { headers: Record<string, string>; varyOrigin: boolean } {
        const h: Record<string, string> = {};
        let varyOrigin = false;

        const resolvedOrigin = resolveOrigin(originHeader, originValue, credentials);
        if (resolvedOrigin !== null) {
            h["Access-Control-Allow-Origin"] = resolvedOrigin;
        }

        if (methodsHeader) h["Access-Control-Allow-Methods"] = methodsHeader;
        if (allowedHeadersHeader) h["Access-Control-Allow-Headers"] = allowedHeadersHeader;
        if (exposedHeadersHeader) h["Access-Control-Expose-Headers"] = exposedHeadersHeader;
        h["Access-Control-Allow-Credentials"] = credentialsHeader;

        // Vary: Origin tells caches the response depends on the request Origin.
        // Only emit it when the server is actually reflecting an origin (or
        // when credentials are in play); a pure wildcard response is cacheable.
        if (resolvedOrigin !== null && resolvedOrigin !== "*") {
            varyOrigin = true;
        } else if (credentials) {
            varyOrigin = true;
        }

        if (merged.maxAge !== undefined && merged.preflightContinue !== true) {
            h["Access-Control-Max-Age"] = maxAgeHeader;
        }

        return { headers: h, varyOrigin };
    }

    function isMethodAllowed(method: string | undefined): boolean {
        if (!method) return false;
        const upper = method.toUpperCase();
        return (merged.methods ?? []).includes(upper);
    }

    function areHeadersAllowed(requested: string | undefined): boolean {
        if (!requested) return true;
        const allowedSet = new Set(
            (merged.allowedHeaders ?? []).map((h) => h.toLowerCase()),
        );
        return requested
            .split(",")
            .map((h) => h.trim().toLowerCase())
            .every((h) => h === "" || allowedSet.has(h));
    }

    const coreMiddleware = (req: any, res: any, next?: () => void) => {
        const originHeader = req?.headers?.origin;
        const { headers: h, varyOrigin } = headers(originHeader);

        for (const [key, value] of Object.entries(h)) {
            if (key === "Vary") continue; // applied via appendVary below
            res.setHeader(key, value);
        }
        if (varyOrigin) {
            appendVary(res, "Origin");
        }

        const method = req?.method;
        const isPreflight = method === "OPTIONS";

        if (isPreflight) {
            const originAllowed = isOriginAllowed(originHeader, originValue);
            if (!originAllowed) {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "CORS origin not allowed" }));
                return;
            }

            const requestedMethod = req?.headers?.["access-control-request-method"];
            if (requestedMethod && !isMethodAllowed(String(requestedMethod))) {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "CORS method not allowed" }));
                return;
            }

            const requestedHeaders = req?.headers?.["access-control-request-headers"];
            if (requestedHeaders && !areHeadersAllowed(String(requestedHeaders))) {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "CORS headers not allowed" }));
                return;
            }

            if (merged.preflightContinue && next) {
                next();
                return;
            }
            if (typeof res.statusCode === "number") {
                res.statusCode = merged.optionsSuccessStatus ?? 204;
            }
            if (typeof res.end === "function") {
                res.end();
            }
            return;
        }

        if (next) next();
    };

    const base = createSecurityMiddlewareBase("cors", merged as Record<string, unknown>, coreMiddleware);

    return {
        name: base.name,
        get enabled() { return base.enabled; },
        get options() { return { ...merged }; },
        enable() { base.enable(); },
        disable() { base.disable(); },
        toggle() { base.toggle(); },
        middleware: () => base.middleware(),
        headers: () => headers(undefined),
    } as CorsMiddleware;
}
