/**
 * Koa middleware adapter.
 * Adapts Express-style (req, res, next) middleware to Koa's
 * (ctx, next) signature.
 */
import { BaseMiddlewareAdapter, type MiddlewareAdapterConfig } from "./base.js";
import type { MiddlewareRegistration } from "../../lifecycle/types.js";

export class KoaMiddlewareAdapter extends BaseMiddlewareAdapter {
    readonly framework = "koa" as const;

    constructor(config: MiddlewareAdapterConfig) {
        super(config);
    }

    adapt(): (ctx: any, next: any) => void {
        const middlewareFn = this.registration.middleware;
        return async (ctx: any, next: any) => {
            let nextCalled = false;
            const lifecycleNext = () => {
                nextCalled = true;
            };

            const adaptedRes: any = {
                setHeader: (key: string, value: string) => {
                    ctx.set(key, value);
                },
                get statusCode() {
                    return ctx.status;
                },
                set statusCode(code: number) {
                    ctx.status = code;
                },
                end: (body: any) => {
                    if (!nextCalled) {
                        ctx.body = body;
                    }
                },
            };

            await middlewareFn(ctx.request, adaptedRes, lifecycleNext);

            if (!nextCalled) {
                await next();
            }
        };
    }
}

export function createKoaMiddlewareAdapter(
    registration: MiddlewareRegistration,
): KoaMiddlewareAdapter {
    const adapter = new KoaMiddlewareAdapter({
        framework: "koa",
        registration,
    });
    adapter.initialize();
    return adapter;
}
