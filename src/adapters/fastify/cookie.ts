import type { CookieAdapter, CookieOptions } from "../../cookie/types.js";

export function createFastifyCookieAdapter(req: any, res: any): CookieAdapter {
    return {
        get(name: string): string | undefined {
            return req?.cookies?.[name];
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
            res.setCookie(name, value, opts);
        },
        delete(name: string, options: { path?: string; domain?: string }): void {
            const opts: Record<string, unknown> = { path: options.path ?? "/" };
            if (options.domain) opts.domain = options.domain;
            res.clearCookie(name, opts);
        },
        getAll(): Record<string, string> {
            return req?.cookies ?? {};
        },
    };
}
