import type { HttpLikeServerResponse, ResponseFrameworkAdapter } from "./types.js";
import { isBodylessStatus } from "../types.js";

export function createHttpAdapter(res: HttpLikeServerResponse): ResponseFrameworkAdapter {
    return {
        name: "http",

        send({ status, body, headers }) {
            if (res.headersSent || res.writableEnded) {
                throw new Error("Response has already been sent");
            }

            const allHeaders: Record<string, string> = {};
            if (headers) {
                for (const [name, value] of Object.entries(headers)) {
                    if (Array.isArray(value)) {
                        allHeaders[name] = value.join(", ");
                    } else {
                        allHeaders[name] = value;
                    }
                }
            }

            if (isBodylessStatus(status)) {
                res.writeHead(status, allHeaders);
                res.end();
                return;
            }

            allHeaders["content-type"] = "application/json";
            res.writeHead(status, allHeaders);
            res.end(JSON.stringify(body));
        },
    };
}
