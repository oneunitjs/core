import type { KoaLikeContext, ResponseFrameworkAdapter } from "./types.js";
import { isBodylessStatus } from "../types.js";
import { ResponseAlreadySentError } from "../../errors/response.js";

export function createKoaAdapter(ctx: KoaLikeContext): ResponseFrameworkAdapter {
    return {
        name: "koa",

        send({ status, body, headers }) {
            if (ctx.headerSent) {
                throw new ResponseAlreadySentError();
            }

            ctx.status = status;

            if (headers) {
                for (const [name, value] of Object.entries(headers)) {
                    if (Array.isArray(value)) {
                        for (const v of value) {
                            ctx.append(name, v);
                        }
                    } else {
                        ctx.set(name, value);
                    }
                }
            }

            if (isBodylessStatus(status)) {
                ctx.body = null;
                return;
            }

            ctx.type = "application/json";
            ctx.body = body;
        },
    };
}
