import type { CookieAdapter, CookieOptions } from "./types.js";

export function createFastifyCookieAdapter(
    req: { cookies?: Record<string, string> },
    reply: { setCookie(name: string, value: string, options?: Record<string, unknown>): void; unsetCookie(name: string, options?: Record<string, unknown>): void },
): CookieAdapter {
    return {
        get: (name) => req.cookies?.[name],
        set: (name, value, options: CookieOptions = {}) => {
            const fastifyOptions: Record<string, unknown> = {};
            if (options.path) fastifyOptions.path = options.path;
            if (options.domain) fastifyOptions.domain = options.domain;
            if (options.maxAge !== undefined) fastifyOptions.maxAge = options.maxAge;
            if (options.expires) fastifyOptions.expires = options.expires;
            if (options.secure) fastifyOptions.secure = true;
            if (options.httpOnly) fastifyOptions.httpOnly = true;
            if (options.sameSite !== undefined) fastifyOptions.sameSite = options.sameSite;
            reply.setCookie(name, value, fastifyOptions);
        },
        delete: (name, options: CookieOptions = {}) => {
            const fastifyOptions: Record<string, unknown> = {};
            if (options?.path) fastifyOptions.path = options.path;
            if (options?.domain) fastifyOptions.domain = options.domain;
            reply.unsetCookie(name, fastifyOptions);
        },
        getAll: () => req.cookies ?? {},
    };
}
