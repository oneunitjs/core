import type { CookieAdapter, CookieOptions } from "../../cookie/types.js";

function serializeCookieValue(name: string, value: string, options: CookieOptions): string {
    const parts: string[] = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
    if (options.path) parts.push(`Path=${options.path}`);
    if (options.domain) parts.push(`Domain=${options.domain}`);
    if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
    if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
    if (options.secure !== false) parts.push("Secure");
    if (options.httpOnly !== false) parts.push("HttpOnly");
    if (options.sameSite) {
        const ssite = options.sameSite === true ? "Strict" : String(options.sameSite);
        parts.push(`SameSite=${ssite}`);
    }
    return parts.join("; ");
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
    const result: Record<string, string> = {};
    if (!cookieHeader) return result;
    for (const pair of cookieHeader.split(";")) {
        const eqIndex = pair.indexOf("=");
        if (eqIndex === -1) continue;
        const key = pair.slice(0, eqIndex).trim();
        const value = pair.slice(eqIndex + 1).trim();
        if (key) result[key] = value;
    }
    return result;
}

export function createHttpCookieAdapter(req: any, res: any): CookieAdapter {
    return {
        get(name: string): string | undefined {
            return parseCookieHeader(req?.headers?.cookie)[name];
        },
        set(name: string, value: string, options: CookieOptions): void {
            res.setHeader("Set-Cookie", serializeCookieValue(name, value, options));
        },
        delete(name: string, options: { path?: string; domain?: string }): void {
            res.setHeader(
                "Set-Cookie",
                `${encodeURIComponent(name)}=; Path=${options.path ?? "/"}; Expires=Thu, 01 Jan 1970 00:00:00 GMT${
                    options.domain ? `; Domain=${options.domain}` : ""
                }`,
            );
        },
        getAll(): Record<string, string> {
            return parseCookieHeader(req?.headers?.cookie);
        },
    };
}
