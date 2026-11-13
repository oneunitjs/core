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

function isOriginAllowed(origin: string | undefined, allowed: OriginValue): boolean {
    if (!origin) return false;
    if (allowed === true) return true;
    if (allowed === false) return false;
    if (typeof allowed === "string") return allowed === origin || allowed === "*";
    if (Array.isArray(allowed)) return allowed.includes(origin);
    return false;
}

function resolveOrigin(origin: string | undefined, allowed: OriginValue): string | null {
    if (allowed === true) return origin ?? null;
    if (allowed === false) return null;
    if (typeof allowed === "string") {
        if (allowed === "*") return "*";
        if (!origin) return allowed;
        return allowed === origin ? allowed : null;
    }
    if (Array.isArray(allowed)) {
        if (!origin) return null;
        return allowed.includes(origin) ? origin : null;
    }
    return null;
}

export interface CorsMiddleware {
    name: string;
    enabled: boolean;
    options: CorsOptions;
    enable(): void;
    disable(): void;
    toggle(): void;
    middleware(): (req: unknown, res: unknown, next?: () => void) => void;
    headers(): Record<string, string>;
}

export function createCors(options: CorsOptions = {}): CorsMiddleware {
    const merged: CorsOptions = {
        origin: options.origin ?? DEFAULT_CORS_OPTIONS.origin,
        methods: options.methods ?? DEFAULT_CORS_OPTIONS.methods,
        allowedHeaders: options.allowedHeaders ?? DEFAULT_CORS_OPTIONS.allowedHeaders,
        exposedHeaders: options.exposedHeaders ?? DEFAULT_CORS_OPTIONS.exposedHeaders,
        credentials: options.credentials ?? DEFAULT_CORS_OPTIONS.credentials,
        maxAge: options.maxAge ?? DEFAULT_CORS_OPTIONS.maxAge,
        preflightContinue: options.preflightContinue ?? DEFAULT_CORS_OPTIONS.preflightContinue,
        optionsSuccessStatus: options.optionsSuccessStatus ?? DEFAULT_CORS_OPTIONS.optionsSuccessStatus,
    };

    function headers(originHeader: string | undefined): Record<string, string> {
        const h: Record<string, string> = {};

        const resolvedOrigin = resolveOrigin(originHeader, merged.origin as OriginValue);
        if (resolvedOrigin !== null) {
            h["Access-Control-Allow-Origin"] = resolvedOrigin === "*" ? "*" : resolvedOrigin;
        }

        if (merged.credentials && merged.origin === "*" && originHeader) {
            h["Access-Control-Allow-Origin"] = originHeader;
        }

        if (merged.methods) {
            h["Access-Control-Allow-Methods"] = merged.methods.join(", ");
        }
        if (merged.allowedHeaders) {
            h["Access-Control-Allow-Headers"] = merged.allowedHeaders.join(", ");
        }
        if (merged.exposedHeaders && merged.exposedHeaders.length > 0) {
            h["Access-Control-Expose-Headers"] = merged.exposedHeaders.join(", ");
        }
        if (merged.credentials !== undefined) {
            h["Access-Control-Allow-Credentials"] = String(merged.credentials);
        }
        if (merged.maxAge !== undefined && merged.preflightContinue !== true) {
            h["Access-Control-Max-Age"] = String(merged.maxAge);
        }

        return h;
    }

    const coreMiddleware = (req: any, res: any, next?: () => void) => {
        const originHeader = req?.headers?.origin;
        const h = headers(originHeader);

        for (const [key, value] of Object.entries(h)) {
            res.setHeader(key, value);
        }

        const method = req?.method;
        const isPreflight = method === "OPTIONS";

        if (isPreflight) {
            const originAllowed = isOriginAllowed(originHeader, merged.origin as OriginValue);
            if (!originAllowed && merged.origin !== "*") {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "CORS origin not allowed" }));
                return;
            }
            if (merged.preflightContinue && next) {
                next();
                return;
            }
            if (res && typeof res.statusCode === "number") {
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
        get options() { return base.options; },
        enable() { base.enable(); },
        disable() { base.disable(); },
        toggle() { base.toggle(); },
        middleware: () => base.middleware(),
        headers: () => headers(undefined),
    } as CorsMiddleware;
}
