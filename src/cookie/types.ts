export type CookieSameSite = "strict" | "lax" | "none" | boolean;

export interface CookieOptions {
    path?: string;
    domain?: string;
    expires?: Date;
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: CookieSameSite;
    signed?: boolean;
    secret?: string;
    secrets?: string[];
    encode?: (value: string) => string;
    decode?: (value: string) => string;
    encrypted?: boolean;
}

export interface CookieConfig {
    path?: string;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: CookieSameSite;
    maxAge?: number;
    signed?: boolean;
    encrypted?: boolean;
    secret?: string;
    secrets?: string[];
    encode?: (value: string) => string;
    decode?: (value: string) => string;
}

export interface CookieAdapter {
    get(name: string): string | undefined;
    set(name: string, value: string, options: CookieOptions): void;
    delete(name: string, options: { path?: string; domain?: string }): void;
    getAll(): Record<string, string>;
}

export interface CookieStore {
    get(name: string): string | undefined;
    set(name: string, value: string, options?: CookieOptions): CookieStore;
    delete(name: string, options?: { path?: string; domain?: string }): CookieStore;
    has(name: string): boolean;
    all(): Record<string, string>;
    clear(): CookieStore;
    serialize(name: string, value: string, options?: CookieOptions): string;
    parse(cookieHeader: string): Record<string, string>;
    setSigned(name: string, value: string, options?: CookieOptions): CookieStore;
    setEncrypted(name: string, value: string, options?: CookieOptions): CookieStore;
    getSigned(name: string): string | undefined;
    getEncrypted(name: string): string | null;
}

export type CookieFramework = "express" | "fastify" | "koa" | "http" | "unknown";

export interface DetectedCookieFramework {
    framework: CookieFramework;
    confidence: "high" | "low";
}

export interface ServerOnlyCookieOptions {
    secret: string;
    algorithm?: "sha256" | "sha512";
    ivLength?: number;
}

export interface CookieEntry {
    value: string;
    signed: boolean;
    encrypted: boolean;
    secret?: string;
}
