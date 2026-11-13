import type { ExpressLikeResponse } from "./types.js";
import { createResponseAdapter } from "./adapter-base.js";
import { isBodylessStatus } from "../types.js";

export function createExpressAdapter(res: ExpressLikeResponse) {
    return createResponseAdapter("express", {
        isSent() {
            return Boolean(res.headersSent);
        },
        setHeader(name, value) {
            res.set(name, value);
        },
        setStatus(code) {
            res.status(code);
        },
        sendBodyless(code) {
            if (isBodylessStatus(code)) {
                res.end();
            }
        },
        setContentType() {
            res.type("application/json");
        },
        sendBody(body) {
            res.json(body);
        },
    });
}
