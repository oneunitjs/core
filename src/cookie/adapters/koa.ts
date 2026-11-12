import type { CookieAdapter, CookieOptions } from "./types.js";

export function createKoaCookieAdapter(
    ctx: { cookies: { get(name: string): string | undefined; set(name: string, value: string, options?: Record<string, unknown>): void } }
): CookieAdapter {
    return {
        get: (name) => {
            return ctx.cookies.get(name);
        },
        set: (name, value, options: CookieOptions = {}) => {
            const {
                path = "/",
                domain,
                expires,
                maxAge,
                secure = false,
                httpOnly = true,
                sameSite = "lax",
            } = options;
            const koaOptions: Record<string, unknown> = {};
            if (path) koaOptions.path = path;
            if (domain) koaOptions.domain = domain;
            if (maxAge !== undefined) koaOptions.maxAge = maxAge;
            if (expires) koaOptions.expires = expires;
            if (secure) koaOptions.secure = true;
            if (httpOnly) koaOptions.httpOnly = true;
            if (sameSite !== undefined) koaOptions.sameSite = sameSite;
            if (options.signed) koaOptions.signed = true;
            ctx.cookies.set(name, value, koaOptions);
        },
        delete: (name, options: CookieOptions = {}) => {
            const koaOptions: Record<string, unknown> = {};
            if (options?.path) koaOptions.path = options.path;
            if (options?.domain) koaOptions.domain = options.domain;
            ctx.cookies.set(name as string, "", { ...koaOptions, maxAge: 0, expires: new Date(0) });
        },
        getAll: () => {
            const all: Record<string, string> = {};
            for (const name of Object.keys(ctx.cookies)) {
                const val = ctx.cookies.get(name);
                if (val !== undefined) all[name] = val;
            }
            return all;
        },
    };
}
