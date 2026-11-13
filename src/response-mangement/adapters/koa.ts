import type { KoaLikeContext } from "./types.js";
import { createResponseAdapter } from "./adapter-base.js";
import { isBodylessStatus } from "../types.js";

export function createKoaAdapter(ctx: KoaLikeContext) {
    return createResponseAdapter("koa", {
        isSent() {
            return Boolean(ctx.headerSent);
        },
        setHeader(name, value) {
            ctx.set(name, value);
        },
        setStatus(code) {
            ctx.status = code;
        },
        sendBodyless(code) {
            if (isBodylessStatus(code)) {
                ctx.body = null;
            }
        },
        setContentType() {
            ctx.type = "application/json";
        },
        sendBody(body) {
            ctx.body = body;
        },
    });
}
