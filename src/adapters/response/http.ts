/**
 * node:http response adapter.
 * Adapts node:http ServerResponse object to the ResponseAdapter interface.
 */
import { BaseResponseAdapter, type ResponseAdapterConfig } from "./base.js";

export class HttpResponseAdapter extends BaseResponseAdapter {
    readonly framework = "http" as const;

    private _statusCode = 200;
    private _headers: Record<string, string> = {};

    constructor(config: ResponseAdapterConfig) {
        super(config);
    }

    isResponseSent(): boolean {
        const res = this.response as {
            headersSent?: boolean;
            writableEnded?: boolean;
        };
        return Boolean(res.headersSent || res.writableEnded);
    }

    setResponseHeader(name: string, value: string): void {
        this._headers[name] = value;
    }

    setResponseStatus(code: number): void {
        this._statusCode = code;
    }

    sendBodyless(): void {
        const res = this.response as {
            writeHead(code: number, headers?: Record<string, string>): void;
            end(): void;
        };
        if (this._statusCode === 204 || this._statusCode === 304) {
            res.writeHead(this._statusCode, this._headers);
            res.end();
        }
    }

    setContentTypeJson(): void {
        this._headers["content-type"] = "application/json";
    }

    sendResponseBody(body: unknown): void {
        const res = this.response as {
            writeHead(code: number, headers?: Record<string, string>): void;
            end(data?: string): void;
        };
        res.writeHead(this._statusCode, this._headers);
        res.end(JSON.stringify(body));
    }
}

export function createHttpResponseAdapter(
    res: {
        headersSent?: boolean;
        writableEnded?: boolean;
        writeHead(code: number, headers?: Record<string, string>): void;
        end(data?: string): void;
    },
): HttpResponseAdapter {
    const adapter = new HttpResponseAdapter({
        framework: "http",
        request: undefined,
        response: res,
    });
    adapter.initialize();
    return adapter;
}
