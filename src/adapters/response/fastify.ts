/**
 * Fastify response adapter.
 * Adapts Fastify reply object to the ResponseAdapter interface.
 */
import { BaseResponseAdapter, type ResponseAdapterConfig } from "./base.js";

export class FastifyResponseAdapter extends BaseResponseAdapter {
    readonly framework = "fastify" as const;

    constructor(config: ResponseAdapterConfig) {
        super(config);
    }

    isResponseSent(): boolean {
        return Boolean((this.response as any).sent);
    }

    setResponseHeader(name: string, value: string): void {
        (this.response as { header(name: string, value: string): unknown }).header(
            name,
            value,
        );
    }

    setResponseStatus(code: number): void {
        (this.response as { code(code: number): unknown }).code(code);
    }

    sendBodyless(code: number): void {
        if (code === 204 || code === 304) {
            (this.response as { send(): void }).send();
        }
    }

    setContentTypeJson(): void {
        (this.response as { type(type: string): unknown }).type(
            "application/json",
        );
    }

    sendResponseBody(body: unknown): void {
        (this.response as { send(body?: unknown): void }).send(body);
    }
}

export function createFastifyResponseAdapter(
    reply: {
        sent?: boolean;
        header(name: string, value: string): unknown;
        code(code: number): unknown;
        send(): void;
        send(body?: unknown): void;
        type(type: string): unknown;
    },
): FastifyResponseAdapter {
    const adapter = new FastifyResponseAdapter({
        framework: "fastify",
        request: undefined,
        response: reply,
    });
    adapter.initialize();
    return adapter;
}
