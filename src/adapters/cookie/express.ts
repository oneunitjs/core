/**
 * Express cookie adapter.
 * Adapts Express req/res objects to the CookieAdapter interface.
 *
 * Uses req.headers.cookie for reading and res.setHeader("Set-Cookie", ...) for writing.
 */
import { BaseCookieAdapter, type CookieAdapterConfig } from "./base.js";
import { buildDeleteCookieParts } from "../../cookie/cookie-utils.js";

export class ExpressCookieAdapter extends BaseCookieAdapter {
    readonly framework = "express" as const;

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
        this.setRawCookieHeader(buildDeleteCookieParts(name, options ?? {}).join("; "));
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

export function createExpressCookieAdapter(
    req: { headers?: { cookie?: string } },
    res: { setHeader(name: string, value: string): void },
): ExpressCookieAdapter {
    const adapter = new ExpressCookieAdapter({
        framework: "express",
        request: req,
        response: res,
    });
    adapter.initialize();
    return adapter;
}
