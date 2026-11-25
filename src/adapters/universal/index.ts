import { createApp, type App } from "../../core.js";
import type { UniversalAdapterOptions, UniversalFramework } from "./types.js";

import {
    createResponseManager,
    createResponseFrameworkManager,
    createExpressResponseAdapter,
    createFastifyResponseAdapter,
    createKoaResponseAdapter,
    createHttpResponseAdapter,
} from "../../response-mangement/index.js";

/**
 * Detects the framework of a server instance by inspecting its shape.
 *
 * @param server - The server instance to inspect
 * @returns The detected framework
 */
function detectFramework(server: unknown): UniversalFramework {
    const s = server as Record<string, unknown>;

    // Fastify: exposes register, decorateReply, addHook
    if (
        typeof s.register === "function" &&
        typeof s.decorateReply === "function" &&
        typeof s.addHook === "function"
    ) {
        return "fastify";
    }

    // Koa: exposes context (object) and use and callback
    if (
        s.context !== undefined &&
        typeof s.use === "function" &&
        typeof s.callback === "function"
    ) {
        return "koa";
    }

    // Express: exposes use, get, locals and listen (but not decorateReply)
    if (
        typeof s.use === "function" &&
        typeof s.get === "function" &&
        s.locals !== undefined &&
        typeof s.listen === "function"
    ) {
        return "express";
    }

    // Node.js http Server: exposes on
    if (typeof s.on === "function") {
        return "http";
    }

    return "unknown";
}

/**
 * Creates a framework response adapter for the given server/request/response
 * triplet, auto-detecting the framework.
 *
 * @param server - The server instance (used for framework hints)
 * @param req - The request object
 * @param res - The response/reply object
 * @param ctx - The Koa context (optional)
 * @returns A ResponseFrameworkAdapter bound to the response
 */
function createUniversalResponseAdapter(
    server: unknown,
    req: unknown,
    res: unknown,
    ctx?: unknown,
): {
    adapter: ReturnType<
        | typeof createExpressResponseAdapter
        | typeof createFastifyResponseAdapter
        | typeof createKoaResponseAdapter
        | typeof createHttpResponseAdapter
    >;
    framework: UniversalFramework;
} {
    const framework = detectFramework(server);

    switch (framework) {
        case "fastify":
            return {
                adapter: createFastifyResponseAdapter(
                    res as unknown as {
                        status: (code: number) => unknown;
                        send: (body: unknown) => void;
                        header: (key: string, value: string | string[]) => unknown;
                    },
                ),
                framework,
            };
        case "express":
            return {
                adapter: createExpressResponseAdapter(
                    res as unknown as {
                        status: (code: number) => unknown;
                        json: (body: unknown) => void;
                        setHeader: (key: string, value: string | string[]) => void;
                    },
                ),
                framework,
            };
        case "koa":
            return {
                adapter: createKoaResponseAdapter(
                    (ctx ?? res) as unknown as {
                        status: number;
                        body: unknown;
                        set: (key: string, value: string) => void;
                    },
                ),
                framework,
            };
        case "http":
        default:
            return {
                adapter: createHttpResponseAdapter(
                    res as unknown as {
                        statusCode: number;
                        writeHead: (
                            code: number,
                            headers?: Record<string, string | string[]>,
                        ) => void;
                        end: (body?: unknown) => void;
                        setHeader: (key: string, value: string | string[]) => void;
                    },
                ),
                framework,
            };
    }
}

/**
 * Universal adapter that integrates the core package into any supported
 * framework server instance (Express, Fastify, Koa, or Node.js http).
 *
 * The framework is auto-detected from the server instance shape unless
 * explicitly provided via `options.framework`.
 *
 * @param server - The server instance to adapt
 * @param opts - Universal adapter options
 * @returns The created {@link App} instance
 */
export function universalAdapter(
    server: unknown,
    opts?: UniversalAdapterOptions,
): App {
    const options: UniversalAdapterOptions = opts ?? {};

    const detected =
        options.framework !== undefined
            ? options.framework
            : detectFramework(server);

    const {
        autoRegisterHealthRoute = true,
        tryCatchEnabled = true,
        ...appOptions
    } = options;

    const app: App = createApp({
        framework: detected as any,
        ...appOptions,
    });

    // Expose the full core API globally on the server instance.
    if (detected === "fastify") {
        const f = server as {
            decorate: (name: string, value: unknown) => void;
        };
        f.decorate("core", app);
        f.decorate("oneunit", app);
    } else if (detected === "koa") {
        const k = server as {
            context: Record<string, unknown>;
            [key: string]: unknown;
        };
        k.context.core = app;
        k.context.oneunit = app;
        k.core = app;
        k.oneunit = app;
    } else if (detected === "express") {
        const e = server as {
            locals: Record<string, unknown>;
            [key: string]: unknown;
        };
        e.locals.core = app;
        e.locals.oneunit = app;
        e.core = app;
        e.oneunit = app;
    } else {
        (server as Record<string, unknown>).core = app;
        (server as Record<string, unknown>).oneunit = app;
    }

    // Register the core health route.
    if (autoRegisterHealthRoute) {
        const healthPath =
            (appOptions.health as { path?: string } | undefined)?.path ??
            "/health";

        const respondHealth = async (
            req: unknown,
            res: unknown,
            ctx?: unknown,
        ): Promise<void> => {
            const results = await app.health().check();
            const hasUnhealthy = Object.values(results).some(
                (r) => r.status === "unhealthy",
            );
            const hasDegraded = Object.values(results).some(
                (r) => r.status === "degraded",
            );
            const overallStatus: "healthy" | "degraded" | "unhealthy" =
                hasUnhealthy ? "unhealthy" : hasDegraded ? "degraded" : "healthy";

            const { adapter } = createUniversalResponseAdapter(
                server,
                req,
                res,
                ctx,
            );
            const manager = createResponseManager({ tryCatchEnabled });
            const rfm = createResponseFrameworkManager(manager, adapter, {
                tryCatchEnabled,
            });

            rfm.respond({
                status: hasUnhealthy ? 503 : 200,
                response: {
                    data: {
                        service: app.config().serviceName,
                        status: overallStatus,
                        timestamp: new Date().toISOString(),
                        checks: results,
                    },
                    message: overallStatus,
                },
            });
        };

        if (detected === "express") {
            const e = server as {
                get: (
                    path: string,
                    handler: (req: unknown, res: unknown) => void,
                ) => void;
            };
            e.get(healthPath, async (_req: unknown, res: unknown) => {
                await respondHealth(_req, res);
            });
        } else if (detected === "koa") {
            const k = server as {
                use: (
                    middleware: (
                        ctx: unknown,
                        next: () => Promise<void>,
                    ) => Promise<void>,
                ) => void;
            };
            k.use(async (ctx: unknown, next: () => Promise<void>) => {
                const koaCtx = ctx as { path: string };
                if (koaCtx.path !== healthPath) {
                    await next();
                    return;
                }
                await respondHealth(ctx, undefined, ctx);
            });
        } else if (detected === "fastify") {
            const f = server as {
                get: (
                    path: string,
                    handler: (req: unknown, reply: unknown) => void | Promise<void>,
                ) => void;
            };
            f.get(healthPath, async (_req: unknown, reply: unknown) => {
                await respondHealth(_req, reply);
            });
        } else {
            // Node.js http: attach a request listener
            const httpServer = server as {
                on: (
                    event: string,
                    listener: (req: unknown, res: unknown) => void,
                ) => void;
            };
            httpServer.on("request", (req: unknown, res: unknown) => {
                const reqAny = req as { url?: string };
                if (reqAny.url !== healthPath) {
                    return;
                }
                respondHealth(req, res);
            });
        }
    }

    // Attach the core app to each request for convenient access in handlers.
    if (detected === "express") {
        const e = server as {
            use: (
                middleware: (
                    req: unknown,
                    res: unknown,
                    next: () => void,
                ) => void,
            ) => void;
        };
        e.use((req: unknown, _res: unknown, next: () => void): void => {
            (req as Record<string, unknown>).core = app;
            next();
        });
    } else if (detected === "fastify") {
        const f = server as {
            addHook: (
                name: string,
                handler: (req: unknown, reply: unknown) => void | Promise<void>,
            ) => void;
        };
        f.addHook("onRequest", async (req: unknown, reply: unknown) => {
            (req as Record<string, unknown>).core = app;
            (reply as Record<string, unknown>).core = app;
        });
    } else if (detected === "koa") {
        const k = server as {
            use: (
                middleware: (
                    ctx: unknown,
                    next: () => Promise<void>,
                ) => Promise<void>,
            ) => void;
        };
        k.use(async (ctx: unknown, next: () => Promise<void>) => {
            (ctx as Record<string, unknown>).core = app;
            await next();
        });
    }

    return app;
}

export type { UniversalAdapterOptions, UniversalFramework };
export type { App };

/**
 * Integration example:
 *
 * ```ts
 * import { createServer } from "node:http";
 * import express from "express";
 * import Fastify from "fastify";
 * import Koa from "koa";
 * import { universalAdapter } from "@oneunit/core/adapters/universal";
 *
 * // Express
 * const expressApp = express();
 * expressApp.use(express.json());
 * const expressCore = universalAdapter(expressApp, {
 *   serviceName: "my-api",
 *   secret: "my-secret",
 *   autoRegisterHealthRoute: true,
 *   tryCatchEnabled: true,
 * });
 *
 * expressApp.get("/example", (req, res) => {
 *   expressCore.response(req, res).ok({ data: { ok: true } });
 * });
 * expressApp.listen(3000);
 *
 * // Fastify
 * const fastify = Fastify();
 * const fastifyCore = universalAdapter(fastify, {
 *   serviceName: "my-api",
 *   secret: "my-secret",
 *   autoRegisterHealthRoute: true,
 *   tryCatchEnabled: true,
 * });
 * fastify.get("/example", async (request, reply) => {
 *   fastifyCore.response(request, reply).ok({ data: { ok: true } });
 * });
 * await fastify.listen({ port: 3001 });
 *
 * // Koa
 * const koaApp = new Koa();
 * const koaCore = universalAdapter(koaApp, {
 *   serviceName: "my-api",
 *   secret: "my-secret",
 *   autoRegisterHealthRoute: true,
 *   tryCatchEnabled: true,
 * });
 * koaApp.use(async (ctx) => {
 *   koaCore.response(ctx.req, ctx.res).ok({ data: { ok: true } });
 *   ctx.body = { ok: true };
 * });
 * koaApp.listen(3002);
 *
 * // Node.js http
 * const httpServer = createServer((req, res) => {
 *   const core = universalAdapter(httpServer, {
 *     serviceName: "my-api",
 *     secret: "my-secret",
 *   });
 *   core.response(req, res).ok({ data: { ok: true } });
 * });
 * httpServer.listen(3003);
 * ```
 */
