import type { HttpLikeServerResponse } from "./types.js";
import { createResponseAdapter } from "./adapter-base.js";
import { isBodylessStatus } from "../types.js";

export function createHttpAdapter(res: HttpLikeServerResponse) {
    let statusCode = 200;
    const allHeaders: Record<string, string> = {};
    return createResponseAdapter("http", {
        isSent() {
            return Boolean(res.headersSent || res.writableEnded);
        },
        setHeader(name, value) {
            allHeaders[name] = value;
        },
        setStatus(code) {
            statusCode = code;
        },
        sendBodyless() {
            if (isBodylessStatus(statusCode)) {
                res.writeHead(statusCode, allHeaders);
                res.end();
            }
        },
        setContentType() {
            allHeaders["content-type"] = "application/json";
        },
        sendBody(body) {
            res.writeHead(statusCode, allHeaders);
            res.end(JSON.stringify(body));
        },
    });
}
