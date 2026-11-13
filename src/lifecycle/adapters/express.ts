import type { MiddlewareRegistration } from "../types.js";
import type { FrameworkAdapter } from "./types.js";

export class ExpressMiddlewareAdapter implements FrameworkAdapter {
    readonly framework = "express" as const;

    adapt(middleware: MiddlewareRegistration): any {
        // Express middleware is already (req, res, next) - pass through
        return (req: any, res: any, next: any) => {
            return middleware.middleware(req, res, next);
        };
    }
}
