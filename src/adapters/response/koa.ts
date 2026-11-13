/**
 * Koa response adapter.
 * Adapts Koa context object to the ResponseAdapter interface.
 */
import { BaseResponseAdapter, type ResponseAdapterConfig } from "./base.js";

export class KoaResponseAdapter extends BaseResponseAdapter {
    readonly framework = "koa" as const;

    constructor(config: ResponseAdapterConfig) {
        super(config);
    }

    isResponseSent(): boolean {
        return Boolean((this.response as any).headerSent);
    }

    setResponseHeader(name: string, value: string): void {
        (this.response as { set(name: string, value: string): void }).set(
            name,
            value,
        );
    }

    setResponseStatus(code: number): void {
        (this.response as { status: number }).status = code;
    }

    sendBodyless(code: number): void {
        if (code === 204 || code === 304) {
            (this.response as { body: unknown }).body = null;
        }
    }

    setContentTypeJson(): void {
        (this.response as { type?: string }).type = "application/json";
    }

    sendResponseBody(body: unknown): void {
        (this.response as { body: unknown }).body = body;
    }
}

export function createKoaResponseAdapter(
    ctx: {
        headerSent?: boolean;
        set(name: string, value: string): void;
        status: number;
        body: unknown;
        type?: string;
    },
): KoaResponseAdapter {
    const adapter = new KoaResponseAdapter({
        framework: "koa",
        request: undefined,
        response: ctx,
    });
    adapter.initialize();
    return adapter;
}
