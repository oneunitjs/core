import type { ResponseFrameworkAdapter } from "../../response-mangement/types.js";

export function createKoaResponseAdapter(res: any): ResponseFrameworkAdapter {
    return {
        name: "koa",
        send({ status, body, headers }: { status: number; body: unknown; headers?: Record<string, string | string[]> }): void {
            if (typeof res.status === "number" || res.status !== undefined) {
                res.status = status;
            }
            if (headers) {
                for (const [key, value] of Object.entries(headers)) {
                    if (typeof res.set === "function") {
                        res.set(key, String(value));
                    }
                }
            }
            res.body = body;
        },
    };
}

export type { KoaLikeContext } from "../../response-mangement/types.js";
