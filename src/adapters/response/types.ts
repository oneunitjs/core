/**
 * Shared response adapter types for the @oneunit/core adapter subsystem.
 *
 * Defines the standardized interfaces that all response adapters must implement,
 * ensuring consistency across Express, Fastify, Koa, and node:http frameworks.
 */

export type ResponseHeaders = Record<string, string | string[]>;

/**
 * Interface that all response adapters must implement.
 */
export interface ResponseFrameworkAdapter {
    readonly name: string;

    send(response: {
        status: number;
        body?: unknown;
        headers?: ResponseHeaders;
    }): void;

    getRequestId?(request: unknown): string | undefined;
}

/**
 * Express-like response interface.
 */
export interface ExpressLikeResponse {
    status(code: number): ExpressLikeResponse;
    json(body: unknown): void;
    send(body?: unknown): void;
    end(): void;
    set(name: string, value: string): void;
    append(name: string, value: string): void;
    type(type: string): ExpressLikeResponse;
    get(name: string): string | undefined;
    removeHeader(name: string): void;
    headersSent?: boolean;
}

/**
 * Fastify-like reply interface.
 */
export interface FastifyLikeReply {
    code(status: number): FastifyLikeReply;
    send(body?: unknown): void;
    header(name: string, value: string): FastifyLikeReply;
    type(type: string): FastifyLikeReply;
    getHeader(name: string): string | undefined;
    removeHeader(name: string): void;
    sent?: boolean;
}

/**
 * Koa-like context interface.
 */
export interface KoaLikeContext {
    status: number;
    body: unknown;
    set(name: string, value: string): void;
    append(name: string, value: string): void;
    get(name: string): string | undefined;
    remove(name: string): void;
    headerSent?: boolean;
    type?: string;
    request: { id?: string };
}

/**
 * node:http-like server response interface.
 */
export interface HttpLikeServerResponse {
    writeHead(code: number, headers?: Record<string, string>): void;
    end(data?: string): void;
    getHeader(name: string): string | undefined;
    setHeader(name: string, value: string | string[]): void;
    appendHeader(name: string, value: string): void;
    removeHeader(name: string): void;
    headersSent?: boolean;
    writableEnded?: boolean;
    statusCode?: number;
    request: { id?: string };
}
