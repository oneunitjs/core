import type { MiddlewareRegistration } from "../types.js";
import type { FrameworkAdapter } from "./types.js";

export class HttpMiddlewareAdapter implements FrameworkAdapter {
    readonly framework = "http" as const;

    adapt(middleware: MiddlewareRegistration): any {
        // node:http uses (req, res, next) - same as Express
        return (req: any, res: any, next: any) => {
            return middleware.middleware(req, res, next);
        };
    }
}
