import type { ExpressLikeResponse, ResponseFrameworkAdapter } from "./types.js";
import { isBodylessStatus } from "../types.js";
import { ResponseAlreadySentError } from "../../errors/response.js";

export function createExpressAdapter(res: ExpressLikeResponse): ResponseFrameworkAdapter {
    return {
        name: "express",

        send({ status, body, headers }) {
            if (res.headersSent) {
                throw new ResponseAlreadySentError();
            }

            if (headers) {
                for (const [name, value] of Object.entries(headers)) {
                    if (Array.isArray(value)) {
                        res.set(name, value.join(", "));
                    } else {
                        res.set(name, value);
                    }
                }
            }

            res.status(status);

            if (isBodylessStatus(status)) {
                res.end();
                return;
            }

            res.type("application/json");
            res.json(body);
        },
    };
}
