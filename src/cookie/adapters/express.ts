import type { CookieAdapter, CookieOptions } from "./types.js";

export function createExpressCookieAdapter(
    req: { headers?: { cookie?: string } },
    res: { setHeader(name: string, value: string): void; getHeader(name: string): string | undefined }
): CookieAdapter {
    return {
        get: (name) => {
            const cookieHeader = req.headers?.cookie;
            if (!cookieHeader) return undefined;
            const parsed: Record<string, string> = {};
            for (const part of cookieHeader.split(";")) {
                const [key, ...valParts] = part.split("=");
                if (key) {
                    parsed[key.trim()] = valParts.join("=").trim();
                }
            }
            return parsed[name];
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
            const parts: string[] = [`${name}=${value}`];
            if (path) parts.push(`Path=${path}`);
            if (domain) parts.push(`Domain=${domain}`);
            if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
            if (expires) parts.push(`Expires=${expires.toUTCString()}`);
            if (secure) parts.push("Secure");
            if (httpOnly) parts.push("HttpOnly");
            if (sameSite !== undefined) parts.push(`SameSite=${sameSite}`);
            res.setHeader("Set-Cookie", parts.join("; "));
        },
        delete: (name, options: CookieOptions = {}) => {
            const {
                path = "/",
                domain,
            } = options;
            const parts: string[] = [`${name}=;`];
            if (path) parts.push(`Path=${path}`);
            if (domain) parts.push(`Domain=${domain}`);
            parts.push("Max-Age=0");
            res.setHeader("Set-Cookie", parts.join("; "));
        },
        getAll: () => {
            const cookieHeader = req.headers?.cookie;
            if (!cookieHeader) return {};
            const parsed: Record<string, string> = {};
            for (const part of cookieHeader.split(";")) {
                const [key, ...valParts] = part.split("=");
                if (key) {
                    parsed[key.trim()] = valParts.join("=").trim();
                }
            }
            return parsed;
        },
    };
}
