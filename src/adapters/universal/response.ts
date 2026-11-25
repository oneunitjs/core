import type { ResponseFrameworkAdapter } from "../../response-mangement/types.js";

export function createHttpResponseAdapter(res: any): ResponseFrameworkAdapter {
    return {
        name: "http",
        send({ status, body, headers }: { status: number; body: unknown; headers?: Record<string, string | string[]> }): void {
            if (typeof res.writeHead === "function") {
                res.writeHead(status, headers ?? undefined);
            } else {
                res.statusCode = status;
                if (headers) {
                    for (const [key, value] of Object.entries(headers)) {
                        if (typeof res.setHeader === "function") {
                            res.setHeader(key, value);
                        }
                    }
                }
            }
            if (typeof res.end === "function") {
                res.end(typeof body === "string" ? body : JSON.stringify(body));
            }
        },
    };
}

export type { HttpLikeServerResponse } from "../../response-mangement/types.js";
