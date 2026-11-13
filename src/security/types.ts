import type { HealthServer } from "../health/types.js";

export type SecurityOptions = {
    enabled?: boolean;
};

export type CorsOptions = {
    origin?: string | string[] | boolean;
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
    preflightContinue?: boolean;
    optionsSuccessStatus?: number;
};

export type CsrfOptions = {
    secret?: string;
    cookieName?: string;
    headerName?: string;
    cookieOptions?: {
        path?: string;
        domain?: string;
        secure?: boolean;
        httpOnly?: boolean;
        sameSite?: "strict" | "lax" | "none";
        maxAge?: number;
    };
    ignoreMethods?: string[];
};

export type SanitizeOptions = {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    allowedSchemes?: string[];
    allowedSchemesByTag?: Record<string, string[]>;
    allowSelfClosing?: boolean;
    nonTextTags?: string[];
    disallowedTagsMode?: "discard" | "escape" | "recursiveEscape";
    parseStyleAttributes?: boolean;
};

export type HelmetOptions = {
    contentSecurityPolicy?: boolean | Record<string, string[]>;
    referrerPolicy?: string | "no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url";
    xssProtection?: boolean | "0" | "1" | "1; mode=block";
    frameOptions?: "DENY" | "SAMEORIGIN" | "ALLOW-FROM";
    hidePoweredBy?: boolean;
    hsts?: boolean | {
        maxAge?: number;
        includeSubDomains?: boolean;
        preload?: boolean;
    };
    noSniff?: boolean;
    ieNoOpen?: boolean;
    permittedCrossDomainPolicies?: string;
    dnsPrefetchControl?: boolean;
    expectCt?: boolean | {
        maxAge?: number;
        enforce?: boolean;
        reportUri?: string;
    };
    featurePolicy?: Record<string, string[]>;
    crossOriginPolicy?: string;
    crossOriginEmbedderPolicy?: "none" | "credentialless" | "require-corp" | "unsafe-none";
    crossOriginOpenerPolicy?: "unsafe-none" | "same-origin" | "same-origin-allow-popups" | "same-origin-plus-popups";
    crossOriginResourcePolicy?: "cross-origin" | "same-origin" | "same-site";
    originAgentCluster?: boolean;
    permittedCrossDomainPoliciesHeaderOnly?: boolean;
};

export type CompressionOptions = {
    threshold?: number;
    level?: number;
    memLevel?: number;
    strategy?: number;
    windowBits?: number;
    filter?: (req: unknown, res: unknown) => boolean;
};

export interface SecurityMiddleware {
    name: string;
    enabled: boolean;
    options: Record<string, unknown>;
    enable(): void;
    disable(): void;
    toggle(): void;
}

export interface CorsMiddleware extends SecurityMiddleware {
    middleware(): (req: unknown, res: unknown, next?: () => void) => void;
    headers(): Record<string, string>;
}

export interface CsrfMiddleware extends SecurityMiddleware {
    // Csrf-specific properties
}

export interface HelmetMiddleware extends SecurityMiddleware {
    // Helmet-specific properties
}

export interface CompressionMiddleware extends SecurityMiddleware {
    // Compression-specific properties
}

export interface SecurityContext {
    origin?: string;
    method?: string;
    headers?: Record<string, string>;
    url?: string;
    body?: unknown;
    cookies?: Record<string, string>;
    query?: Record<string, string>;
}

export interface SecurityResult {
    allowed: boolean;
    statusCode?: number;
    headers?: Record<string, string>;
    body?: unknown;
    message?: string;
}

export interface SecurityProvider {
    name: string;
    enabled: boolean;
    middleware: SecurityMiddleware;
    apply(ctx: SecurityContext): SecurityResult;
    enable(): void;
    disable(): void;
    toggle(): void;
}
