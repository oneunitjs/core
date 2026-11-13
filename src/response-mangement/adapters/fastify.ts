import type { FastifyLikeReply } from "./types.js";
import { createResponseAdapter } from "./adapter-base.js";
import { isBodylessStatus } from "../types.js";

export function createFastifyAdapter(reply: FastifyLikeReply) {
    return createResponseAdapter("fastify", {
        isSent() {
            return Boolean(reply.sent);
        },
        setHeader(name, value) {
            reply.header(name, value);
        },
        setStatus(code) {
            reply.code(code);
        },
        sendBodyless(code) {
            if (isBodylessStatus(code)) {
                reply.send();
            }
        },
        setContentType() {
            reply.type("application/json");
        },
        sendBody(body) {
            reply.send(body);
        },
    });
}
