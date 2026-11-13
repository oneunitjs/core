/**
 * node:http middleware adapter.
 * node:http uses the same (req, res, next) signature as Express.
 */
import { BaseMiddlewareAdapter, type MiddlewareAdapterConfig } from "./base.js";
import type { MiddlewareRegistration } from "../../lifecycle/types.js";

export class HttpMiddlewareAdapter extends BaseMiddlewareAdapter {
    readonly framework = "http" as const;

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

export function createHttpMiddlewareAdapter(
    registration: MiddlewareRegistration,
): HttpMiddlewareAdapter {
    const adapter = new HttpMiddlewareAdapter({
        framework: "http",
        registration,
    });
    adapter.initialize();
    return adapter;
}
