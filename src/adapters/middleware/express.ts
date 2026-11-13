/**
 * Express middleware adapter.
 * Adapts Express-style (req, res, next) middleware - pass through.
 */
import { BaseMiddlewareAdapter, type MiddlewareAdapterConfig } from "./base.js";
import type { MiddlewareRegistration } from "../../lifecycle/types.js";

export class ExpressMiddlewareAdapter extends BaseMiddlewareAdapter {
    readonly framework = "express" as const;

    constructor(config: MiddlewareAdapterConfig) {
        super(config);
    }

    adapt(): (req: any, res: any, next: any) => void {
        const middlewareFn = this.registration.middleware;
        return (req: any, res: any, next: any) => {
            middlewareFn(req, res, next);
        };
    }
}

export function createExpressMiddlewareAdapter(
    registration: MiddlewareRegistration,
): ExpressMiddlewareAdapter {
    const adapter = new ExpressMiddlewareAdapter({
        framework: "express",
        registration,
    });
    adapter.initialize();
    return adapter;
}
