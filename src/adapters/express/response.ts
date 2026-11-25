import type { ResponseFrameworkAdapter } from "../../response-mangement/types.js";

export function createExpressResponseAdapter(res: any): ResponseFrameworkAdapter {
    return {
        name: "express",
        send({ status, body, headers }: { status: number; body: unknown; headers?: Record<string, string | string[]> }): void {
            if (typeof res.status === "function") {
                res.status(status);
            }
            if (headers) {
                for (const [key, value] of Object.entries(headers)) {
                    if (typeof res.setHeader === "function") {
                        res.setHeader(key, value);
                    }
                }
            }
            if (typeof res.json === "function") {
                res.json(body);
            } else if (typeof res.send === "function") {
                res.send(body);
            } else if (typeof res.end === "function") {
                res.end(typeof body === "string" ? body : JSON.stringify(body));
            }
        },
    };
}

export type { ExpressLikeResponse } from "../../response-mangement/types.js";
