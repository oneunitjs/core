import type { MiddlewareRegistration } from "../types.js";
import type { FrameworkAdapter } from "./types.js";

export class KoaMiddlewareAdapter implements FrameworkAdapter {
    readonly framework = "koa" as const;

    adapt(middleware: MiddlewareRegistration): any {
        return async (ctx: any, next: any) => {
            let nextCalled = false;
            const lifecycleNext = () => {
                nextCalled = true;
            };

            // Adapt Koa ctx to provide Express-like res
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

            await middleware.middleware(ctx.req, adaptedRes, lifecycleNext);

            if (!nextCalled) {
                await next();
            }
        };
    }
}
