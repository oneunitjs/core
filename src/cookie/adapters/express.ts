import type { CookieAdapter } from "./types.js";
import { parseCookieHeader, buildCookieParts, buildDeleteCookieParts } from "../cookie-utils.js";

export function createExpressCookieAdapter(
    req: { headers?: { cookie?: string } },
    res: { setHeader(name: string, value: string): void; getHeader(name: string): string | undefined },
): CookieAdapter {
    return {
        get: (name) => parseCookieHeader(req.headers?.cookie ?? "")[name],
        set: (name, value, options = {}) => {
            res.setHeader("Set-Cookie", buildCookieParts(name, value, options).join("; "));
        },
        delete: (name, options = {}) => {
            res.setHeader("Set-Cookie", buildDeleteCookieParts(name, options).join("; "));
        },
        getAll: () => parseCookieHeader(req.headers?.cookie ?? ""),
    };
}
