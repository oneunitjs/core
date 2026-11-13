/**
 * Fastify cookie adapter.
 * Adapts Fastify req/reply objects to the CookieAdapter interface.
 *
 * Uses req.cookies for reading and reply.setCookie()/reply.unsetCookie() for writing.
 */
import { BaseCookieAdapter, type CookieAdapterConfig } from "./base.js";
import { AdapterError } from "../types.js";

export class FastifyCookieAdapter extends BaseCookieAdapter {
    readonly framework = "fastify" as const;

    constructor(config: CookieAdapterConfig) {
        super(config);
    }

    getRawCookieHeader(): string | undefined {
        return undefined; // Fastify parses cookies into req.cookies object
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
        return (this.request as { cookies?: Record<string, string> }).cookies?.[name];
    }

    setRawCookieHeader(header: string): void {
        // Parse Set-Cookie header into Fastify setCookie call
        const match = header.match(/^([^=]+)=([^;]*)/);
        if (!match) return;
        const name = match[1];
        const value = match[2];

        const fastifyOptions: Record<string, unknown> = {};
        const headerParts = header.split("; ");
        for (const part of headerParts.slice(1)) {
            const [key, ...valParts] = part.split("=");
            const val = valParts.join("=");
            switch (key?.toLowerCase()) {
                case "path":
                    fastifyOptions.path = val;
                    break;
                case "domain":
                    fastifyOptions.domain = val;
                    break;
                case "max-age":
                    fastifyOptions.maxAge = Number(val);
                    break;
                case "expires":
                    fastifyOptions.expires = new Date(val);
                    break;
                case "secure":
                    fastifyOptions.secure = true;
                    break;
                case "httponly":
                    fastifyOptions.httpOnly = true;
                    break;
                case "samesite":
                    fastifyOptions.sameSite = val;
                    break;
            }
        }

        (this.response as {
            setCookie(
                name: string,
                value: string,
                options?: Record<string, unknown>,
            ): void;
        }).setCookie(name, value, fastifyOptions);
    }

    deleteRawCookieHeader(
        name: string,
        options?: { path?: string; domain?: string },
    ): void {
        const fastifyOptions: Record<string, unknown> = {};
        if (options?.path) fastifyOptions.path = options.path;
        if (options?.domain) fastifyOptions.domain = options.domain;
        (this.response as {
            unsetCookie(name: string, options?: Record<string, unknown>): void;
        }).unsetCookie(name, fastifyOptions);
    }

    getAllRawCookies(): Record<string, string> {
        return (this.request as { cookies?: Record<string, string> }).cookies ??
            {};
    }
}

export function createFastifyCookieAdapter(
    req: { cookies?: Record<string, string> },
    reply: {
        setCookie(
            name: string,
            value: string,
            options?: Record<string, unknown>,
        ): void;
        unsetCookie(name: string, options?: Record<string, unknown>): void;
    },
): FastifyCookieAdapter {
    const adapter = new FastifyCookieAdapter({
        framework: "fastify",
        request: req,
        response: reply,
    });
    adapter.initialize();
    return adapter;
}
