/**
 * @oneunit/core - node:http Request Context Adapter
 *
 * Adapts the unified request context for node:http servers.
 * Automatically creates a request context for each incoming request
 * and runs the request handler within it.
 *
 * ```ts
 * import { createRequestContext } from "@oneunit/core";
 * import { createHttpContextAdapter } from "@oneunit/core";
 * import http from "http";
 *
 * const ctx = createRequestContext({
 *   autoTimestamp: true,
 *   timestampKey: "requestTime",
 * });
 *
 * const server = http.createServer(
 *   createHttpContextAdapter(ctx).middleware(async (req, res) => {
 *     res.writeHead(200, { "Content-Type": "application/json" });
 *     res.end(JSON.stringify({ requestId: ctx.get("requestId") }));
 *   })
 * );
 * ```
 */

import type { FrameworkName } from "./types.js";
import { createRequestContext } from "../registery.js";

export class HttpContextAdapter {
    readonly framework: FrameworkName = "http";
    readonly name = "http-context";

    constructor(private ctx: ReturnType<typeof createRequestContext>) {}

    middleware(): (req: any, res: any, next?: () => void) => void | Promise<void> {
        return async (req: any, res: any, next?: () => void) => {
            const reqId = req.headers["x-request-id"] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
            const userAgent = req.headers["user-agent"] || "unknown";

            return this.ctx.run(async () => {
                this.ctx.set("requestId", reqId);
                this.ctx.set("clientIp", ip);
                this.ctx.set("userAgent", userAgent);
                this.ctx.set("method", req.method);
                this.ctx.set("path", req.url);
                this.ctx.set("url", req.url);

                if (next) {
                    await next();
                }
            });
        };
    }
}

export function createHttpContextAdapter(
    ctx: ReturnType<typeof createRequestContext>,
): HttpContextAdapter {
    return new HttpContextAdapter(ctx);
}
