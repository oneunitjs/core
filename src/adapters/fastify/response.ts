import type { ResponseFrameworkAdapter } from "../../response-mangement/types.js";

export function createFastifyResponseAdapter(res: any): ResponseFrameworkAdapter {
    return {
        name: "fastify",
        send({ status, body, headers }: { status: number; body: unknown; headers?: Record<string, string | string[]> }): void {
            if (typeof res.status === "function") {
                res.status(status);
            } else if (typeof res.code === "function") {
                res.code(status);
            }
            if (headers) {
                for (const [key, value] of Object.entries(headers)) {
                    if (typeof res.header === "function") {
                        res.header(key, value);
                    }
                }
            }
            if (typeof res.send === "function") {
                res.send(body);
            }
        },
    };
}

export type { FastifyLikeReply } from "../../response-mangement/types.js";
