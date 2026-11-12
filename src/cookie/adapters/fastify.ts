import type { CookieAdapter, CookieOptions } from "./types.js";

export function createFastifyCookieAdapter(
    req: { cookies?: Record<string, string> },
    reply: { setCookie(name: string, value: string, options?: Record<string, unknown>): void; unsetCookie(name: string, options?: Record<string, unknown>): void }
): CookieAdapter {
    return {
        get: (name) => {
            return req.cookies?.[name];
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
            const fastifyOptions: Record<string, unknown> = {};
            if (path) fastifyOptions.path = path;
            if (domain) fastifyOptions.domain = domain;
            if (maxAge !== undefined) fastifyOptions.maxAge = maxAge;
            if (expires) fastifyOptions.expires = expires;
            if (secure) fastifyOptions.secure = true;
            if (httpOnly) fastifyOptions.httpOnly = true;
            if (sameSite !== undefined) fastifyOptions.sameSite = sameSite;
            reply.setCookie(name, value, fastifyOptions);
        },
        delete: (name, options: CookieOptions = {}) => {
            const fastifyOptions: Record<string, unknown> = {};
            if (options?.path) fastifyOptions.path = options.path;
            if (options?.domain) fastifyOptions.domain = options.domain;
            reply.unsetCookie(name, fastifyOptions);
        },
        getAll: () => {
            return req.cookies ?? {};
        },
    };
}
