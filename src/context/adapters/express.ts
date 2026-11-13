/**
 * @oneunit/core - Express Request Context Adapter
 *
 * Adapts the unified request context for Express.js middleware.
 * Automatically creates a request context for each incoming request
 * and runs the request handler within it.
 *
 * ```ts
 * import { createRequestContext } from "@oneunit/core";
 * import { createExpressContextAdapter } from "@oneunit/core";
 * import express from "express";
 *
 * const ctx = createRequestContext({
 *   autoTimestamp: true,
 *   timestampKey: "requestTime",
 * });
 *
 * const app = express();
 * app.use(createExpressContextAdapter(ctx).middleware());
 *
 * app.get("/api/users", (req, res) => {
 *   const requestId = ctx.get("requestId");
 *   res.json({ requestId });
 * });
 * ```
 */

import type { FrameworkName } from "./types.js";
import { createRequestContext } from "../registery.js";

export class ExpressContextAdapter {
    readonly framework: FrameworkName = "express";
    readonly name = "express-context";

    constructor(private ctx: ReturnType<typeof createRequestContext>) {}

    middleware(): (req: any, res: any, next: any) => void | Promise<void> {
        return async (req: any, res: any, next: any) => {
            const reqId = req.headers["x-request-id"] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
            const userAgent = req.headers["user-agent"] || "unknown";

            await this.ctx.run(async () => {
                this.ctx.set("requestId", reqId);
                this.ctx.set("clientIp", ip);
                this.ctx.set("userAgent", userAgent);
                this.ctx.set("method", req.method);
                this.ctx.set("path", req.path);
                this.ctx.set("url", req.originalUrl || req.url);
                await next();
            });
        };
    }
}

export function createExpressContextAdapter(
    ctx: ReturnType<typeof createRequestContext>,
): ExpressContextAdapter {
    return new ExpressContextAdapter(ctx);
}
