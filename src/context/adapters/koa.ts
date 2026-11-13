/**
 * @oneunit/core - Koa Request Context Adapter
 *
 * Adapts the unified request context for Koa.
 * Automatically creates a request context for each incoming request
 * and runs the request handler within it.
 *
 * ```ts
 * import { createRequestContext } from "@oneunit/core";
 * import { createKoaContextAdapter } from "@oneunit/core";
 * import Koa from "koa";
 *
 * const ctx = createRequestContext({
 *   autoTimestamp: true,
 *   timestampKey: "requestTime",
 * });
 *
 * const app = new Koa();
 * app.use(createKoaContextAdapter(ctx).middleware());
 *
 * app.use(async (ctx, next) => {
 *   const requestId = ctx.get("requestId");
 *   ctx.body = { requestId };
 * });
 * ```
 */

import type { FrameworkName } from "./types.js";
import { createRequestContext } from "../registery.js";

export class KoaContextAdapter {
    readonly framework: FrameworkName = "koa";
    readonly name = "koa-context";

    constructor(private ctx: ReturnType<typeof createRequestContext>) {}

    middleware(): (ctx: any, _next: any) => Promise<void> {
        return async (ctx: any, _next: any) => {
            const reqId = ctx.headers["x-request-id"] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const ip = ctx.headers["x-forwarded-for"] || ctx.request.ip || ctx.request.ip || "unknown";
            const userAgent = ctx.headers["user-agent"] || "unknown";

            await this.ctx.run(async () => {
                this.ctx.set("requestId", reqId);
                this.ctx.set("clientIp", ip);
                this.ctx.set("userAgent", userAgent);
                this.ctx.set("method", ctx.method);
                this.ctx.set("path", ctx.path);
                this.ctx.set("url", ctx.url);
            });
        };
    }
}

export function createKoaContextAdapter(
    ctx: ReturnType<typeof createRequestContext>,
): KoaContextAdapter {
    return new KoaContextAdapter(ctx);
}
