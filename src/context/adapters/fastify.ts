/**
 * @oneunit/core - Fastify Request Context Adapter
 *
 * Adapts the unified request context for Fastify.
 * Automatically creates a request context for each incoming request
 * and runs the request handler within it.
 *
 * ```ts
 * import { createRequestContext } from "@oneunit/core";
 * import { createFastifyContextAdapter } from "@oneunit/core";
 * import fastify from "fastify";
 *
 * const ctx = createRequestContext({
 *   autoTimestamp: true,
 *   timestampKey: "requestTime",
 * });
 *
 * const app = fastify();
 * app.addHook("onRequest", createFastifyContextAdapter(ctx).middleware());
 *
 * app.get("/api/users", async (req, reply) => {
 *   const requestId = ctx.get("requestId");
 *   reply.send({ requestId });
 * });
 * ```
 */

import type { FrameworkName } from "./types.js";
import { createRequestContext } from "../registery.js";

export class FastifyContextAdapter {
    readonly framework: FrameworkName = "fastify";
    readonly name = "fastify-context";

    constructor(private ctx: ReturnType<typeof createRequestContext>) {}

    middleware(): (req: any, reply: any) => void | Promise<void> {
        return async (req: any, _reply: any) => {
            const reqId = req.headers["x-request-id"] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
            const userAgent = req.headers["user-agent"] || "unknown";

            await this.ctx.run(async () => {
                this.ctx.set("requestId", reqId);
                this.ctx.set("clientIp", ip);
                this.ctx.set("userAgent", userAgent);
                this.ctx.set("method", req.method);
                this.ctx.set("path", req.url);
                this.ctx.set("url", req.url);
            });
        };
    }
}

export function createFastifyContextAdapter(
    ctx: ReturnType<typeof createRequestContext>,
): FastifyContextAdapter {
    return new FastifyContextAdapter(ctx);
}
