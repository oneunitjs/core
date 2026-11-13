/**
 * node:http cookie adapter.
 * Adapts node:http req/res objects to the CookieAdapter interface.
 *
 * Uses req.headers.cookie for reading and res.setHeader("Set-Cookie", ...) for writing.
 */
import { BaseCookieAdapter, type CookieAdapterConfig } from "./base.js";

export class HttpCookieAdapter extends BaseCookieAdapter {
    readonly framework = "http" as const;

    constructor(config: CookieAdapterConfig) {
        super(config);
    }

    getRawCookieHeader(): string | undefined {
        return (this.request as { headers?: { cookie?: string } }).headers
            ?.cookie;
    }

    setRawCookieHeader(header: string): void {
        (this.response as {
            setHeader(name: string, value: string): void;
        }).setHeader("Set-Cookie", header);
    }

    deleteRawCookieHeader(
        name: string,
        options?: { path?: string; domain?: string },
    ): void {
        const parts: string[] = [`${name}=;`];
        if (options?.path) parts.push(`Path=${options.path}`);
        if (options?.domain) parts.push(`Domain=${options.domain}`);
        parts.push("Max-Age=0");
        this.setRawCookieHeader(parts.join("; "));
    }

    getAllRawCookies(): Record<string, string> {
        const header = this.getRawCookieHeader();
        if (!header) return {};

        const result: Record<string, string> = {};
        for (const part of header.split(";")) {
            const [key, ...valParts] = part.split("=");
            if (key) {
                result[key.trim()] = valParts.join("=").trim();
            }
        }
        return result;
    }
}

export function createHttpCookieAdapter(
    req: { headers?: { cookie?: string } },
    res: { setHeader(name: string, value: string): void },
): HttpCookieAdapter {
    const adapter = new HttpCookieAdapter({
        framework: "http",
        request: req,
        response: res,
    });
    adapter.initialize();
    return adapter;
}
