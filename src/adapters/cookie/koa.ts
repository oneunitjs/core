/**
 * Koa cookie adapter.
 * Adapts Koa ctx object to the CookieAdapter interface.
 *
 * Uses ctx.cookies.get()/ctx.cookies.set() for reading/writing.
 */
import { BaseCookieAdapter, type CookieAdapterConfig } from "./base.js";
import { AdapterError } from "../types.js";

export class KoaCookieAdapter extends BaseCookieAdapter {
    readonly framework = "koa" as const;

    constructor(config: CookieAdapterConfig) {
        super(config);
    }

    getRawCookieHeader(): string | undefined {
        return undefined; // Koa parses cookies into ctx.cookies object
    }

    get(name: string): string | undefined {
        if (!this.initialized) {
            throw new AdapterError(
                `Cookie adapter "${this.name}" is not initialized`,
                this.name,
                this.framework,
                "ADAPTER_NOT_INITIALIZED",
            );
        }
        const cookies = (this.request as {
            cookies: { get(name: string): string | undefined };
        }).cookies;
        return cookies?.get(name);
    }

    setRawCookieHeader(header: string): void {
        // Parse Set-Cookie header into Koa ctx.cookies.set() call
        const match = header.match(/^([^=]+)=([^;]*)/);
        if (!match) return;
        const name = match[1];
        const value = match[2];

        const koaOptions: Record<string, unknown> = {};
        const headerParts = header.split("; ");
        for (const part of headerParts.slice(1)) {
            const [key, ...valParts] = part.split("=");
            const val = valParts.join("=");
            switch (key?.toLowerCase()) {
                case "path":
                    koaOptions.path = val;
                    break;
                case "domain":
                    koaOptions.domain = val;
                    break;
                case "max-age":
                    koaOptions.maxAge = Number(val);
                    break;
                case "expires":
                    koaOptions.expires = new Date(val);
                    break;
                case "secure":
                    koaOptions.secure = true;
                    break;
                case "httponly":
                    koaOptions.httpOnly = true;
                    break;
                case "samesite":
                    koaOptions.sameSite = val;
                    break;
            }
        }

        (this.response as {
            cookies: {
                set(name: string, value: string, options?: Record<string, unknown>): void;
            };
        }).cookies.set(name, value, koaOptions);
    }

    deleteRawCookieHeader(
        name: string,
        options?: { path?: string; domain?: string },
    ): void {
        const koaOptions: Record<string, unknown> = {};
        if (options?.path) koaOptions.path = options.path;
        if (options?.domain) koaOptions.domain = options.domain;
        (this.response as {
            cookies: {
                set(name: string, value: string, options?: Record<string, unknown>): void;
            };
        }).cookies.set(name, "", { ...koaOptions, maxAge: 0, expires: new Date(0) });
    }

    getAllRawCookies(): Record<string, string> {
        const all: Record<string, string> = {};
        const cookies = (this.request as {
            cookies: { get(name: string): string | undefined };
        }).cookies;
        if (cookies) {
            for (const name of Object.keys(cookies)) {
                const val = cookies.get(name);
                if (val !== undefined) all[name] = val;
            }
        }
        return all;
    }
}

export function createKoaCookieAdapter(
    ctx: {
        cookies: {
            get(name: string): string | undefined;
            set(name: string, value: string, options?: Record<string, unknown>): void;
        };
    },
): KoaCookieAdapter {
    const adapter = new KoaCookieAdapter({
        framework: "koa",
        request: ctx,
        response: ctx,
    });
    adapter.initialize();
    return adapter;
}
