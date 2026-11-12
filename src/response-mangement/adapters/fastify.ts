import type { FastifyLikeReply, ResponseFrameworkAdapter } from "./types.js";
import { isBodylessStatus } from "../types.js";

export function createFastifyAdapter(reply: FastifyLikeReply): ResponseFrameworkAdapter {
    return {
        name: "fastify",

        send({ status, body, headers }) {
            if (reply.sent) {
                throw new Error("Response has already been sent");
            }

            if (headers) {
                for (const [name, value] of Object.entries(headers)) {
                    if (Array.isArray(value)) {
                        for (const v of value) {
                            reply.header(name, v);
                        }
                    } else {
                        reply.header(name, value);
                    }
                }
            }

            reply.code(status);

            if (isBodylessStatus(status)) {
                reply.send();
                return;
            }

            reply.type("application/json");
            reply.send(body);
        },
    };
}
