/**
 * Express response adapter.
 * Adapts Express res object to the ResponseAdapter interface.
 */
import { BaseResponseAdapter, type ResponseAdapterConfig } from "./base.js";

export class ExpressResponseAdapter extends BaseResponseAdapter {
    readonly framework = "express" as const;

    constructor(config: ResponseAdapterConfig) {
        super(config);
    }

    isResponseSent(): boolean {
        return Boolean((this.response as any).headersSent);
    }

    setResponseHeader(name: string, value: string): void {
        (this.response as { set(name: string, value: string): void }).set(
            name,
            value,
        );
    }

    setResponseStatus(code: number): void {
        (this.response as { status(code: number): unknown }).status(code);
    }

    sendBodyless(code: number): void {
        if (code === 204 || code === 304) {
            (this.response as { end(): void }).end();
        }
    }

    setContentTypeJson(): void {
        (this.response as { type(type: string): unknown }).type(
            "application/json",
        );
    }

    sendResponseBody(body: unknown): void {
        (this.response as { json(body: unknown): void }).json(body);
    }
}

export function createExpressResponseAdapter(
    res: {
        headersSent?: boolean;
        set(name: string, value: string): void;
        status(code: number): unknown;
        end(): void;
        type(type: string): unknown;
        json(body: unknown): void;
    },
): ExpressResponseAdapter {
    const adapter = new ExpressResponseAdapter({
        framework: "express",
        request: undefined,
        response: res,
    });
    adapter.initialize();
    return adapter;
}
