import type { CookieAdapter, CookieOptions } from "../../cookie/types.js";

export function createKoaCookieAdapter(ctx: any): CookieAdapter {
    return {
        get(name: string): string | undefined {
            return ctx?.cookies?.get(name);
        },
        set(name: string, value: string, options: CookieOptions): void {
            const opts: Record<string, unknown> = {};
            if (options.path) opts.path = options.path;
            if (options.domain) opts.domain = options.domain;
            if (options.maxAge !== undefined) opts.maxAge = options.maxAge;
            if (options.expires) opts.expires = options.expires;
            if (options.secure !== false) opts.secure = true;
            if (options.httpOnly !== false) opts.httpOnly = true;
            if (options.sameSite) opts.sameSite = options.sameSite === true ? "strict" : String(options.sameSite);
            ctx.cookies.set(name, value, opts);
        },
        delete(name: string, options: { path?: string; domain?: string }): void {
            ctx.cookies.set(name, undefined, {
                path: options.path ?? "/",
                ...(options.domain ? { domain: options.domain } : {}),
            });
        },
        getAll(): Record<string, string> {
            return ctx?.cookies ?? {};
        },
    };
}
