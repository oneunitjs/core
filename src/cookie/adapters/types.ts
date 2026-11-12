export interface CookieAdapter {
    get(name: string): string | undefined;
    set(name: string, value: string, options?: CookieOptions): void;
    delete(name: string, options?: { path?: string; domain?: string }): void;
    getAll(): Record<string, string>;
}

export interface CookieOptions {
    path?: string;
    domain?: string;
    expires?: Date;
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "strict" | "lax" | "none" | boolean;
    signed?: boolean;
    encode?: (value: string) => string;
    decode?: (value: string) => string;
}
