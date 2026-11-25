import fastifyPlugin from "fastify-plugin";
import { randomBytes } from "node:crypto";
import type {
    FastifyInstance,
    FastifyReply,
    FastifyRequest,
} from "fastify";

import { createApp, type App } from "../../core.js";
import type { FastifyAdapterOptions } from "./types.js";

import {
    createResponseManager,
    createResponseFrameworkManager,
    createFastifyResponseAdapter,
    type RespondOptions,
} from "../../response-mangement/index.js";

declare module "fastify" {
    interface FastifyInstance {
        /** The {@link App} instance created by {@link createApp}. */
        core: App;
        /** Alias for {@link FastifyInstance.core}. */
        oneunit: App;
    }
}

const fastifyAdapter = fastifyPlugin(
    async (fastify: FastifyInstance, opts: unknown): Promise<void> => {
        const options: FastifyAdapterOptions = (opts as FastifyAdapterOptions) ?? {};

        const {
            autoRegisterHealthRoute = true,
            tryCatchEnabled = true,
            decorateReply = true,
            ...appOptions
        } = options;

        const app: App = createApp({
            framework: "fastify",
            ...appOptions,
        });

        // Expose the full core API globally on the Fastify instance so it is
        // accessible from any route handler, hook, or plugin during the
        // application lifecycle.
        fastify.decorate("core", app);
        fastify.decorate("oneunit", app);

        // Register the core health route (GET /health by default).
        if (autoRegisterHealthRoute) {
            app.health().route({
                get: (routePath: string, handler: unknown) =>
                    fastify.get(routePath, handler as any),
                decorate: (name: string, value: unknown) =>
                    fastify.decorate(name, value),
            });
        }

        // Decorate the reply with a standardised response helper.
        if (decorateReply) {
            fastify.decorateReply(
                "respond",
                function (this: FastifyReply, options: RespondOptions): void {
                    const manager = createResponseManager({
                        tryCatchEnabled,
                    });
                    const adapter = createFastifyResponseAdapter(
                        this as any,
                    );
                    const rfm = createResponseFrameworkManager(manager, adapter, {
                        tryCatchEnabled,
                    });

                    rfm.respond(options);
                },
            );
        }

        // Standardised error handler: when a route handler throws and the reply
        // has not already been sent, respond with a normalised error envelope.
        // setErrorHandler (not onError) is the correct Fastify extension point
        // for sending replacement responses.
        fastify.setErrorHandler(
            (error: Error, _request: FastifyRequest, reply: FastifyReply): void => {
                if (reply.sent) {
                    return;
                }

                const correlationId = randomBytes(8).toString("hex");
                console.error(
                    `[oneunit:fastify:${correlationId}] Unhandled error:`,
                    error.stack ?? error.message,
                );

                const manager = createResponseManager({
                    tryCatchEnabled,
                });
                const adapter = createFastifyResponseAdapter(reply as any);
                const rfm = createResponseFrameworkManager(manager, adapter, {
                    tryCatchEnabled,
                    defaultErrorStatusCode: 500,
                });

                rfm.error({
                    status: 500,
                    message: "Internal Server Error",
                    metadata: { requestId: correlationId },
                });
            },
        );

        // Expose lifecycle and hook entry points on the instance for
        // framework-level integration.
        fastify.decorate("lifecycle", app.lifecycle());
        fastify.decorate("hooks", app.hooks());
    },
);

export default fastifyAdapter;
export { fastifyAdapter };
export type { FastifyAdapterOptions };
export type { App };

/**
 * Integration example:
 *
 * ```ts
 * import Fastify from "fastify";
 * import fastifyAdapter from "@oneunit/core/adapters/fastify";
 *
 * const fastify = Fastify({ logger: true });
 *
 * await fastify.register(fastifyAdapter, {
 *   serviceName: "my-api",
 *   port: 3000,
 *   secret: "my-secret",
 *   autoRegisterHealthRoute: true,
 *   tryCatchEnabled: true,
 *   security: {
 *     cors: { origin: "*" },
 *     helmet: { hidePoweredBy: true },
 *   },
 *   cookie: { secure: true, httpOnly: true, sameSite: "lax" },
 *   multipart: { maxFileSize: 10 * 1024 * 1024 },
 * });
 *
 * await fastify.ready();
 *
 * // Core API is globally available on the Fastify instance.
 * fastify.core.health().register("db", async () => ({ status: "healthy" }));
 * fastify.core.lifecycle().registerMiddleware(
 *   "cors",
 *   "cors",
 *   (_req, reply, next) => {
 *     reply.header("access-control-allow-origin", "*");
 *     next();
 *   },
 * );
 *
 * fastify.get("/example", async (request, reply) => {
 *   const cookies = fastify.core.cookies(request, reply);
 *   cookies.set("session", "abc123", { httpOnly: true });
 *
 *   reply.respond({
 *     status: 200,
 *     response: { data: { ok: true }, message: "OK" },
 *   });
 * });
 *
 * await fastify.listen({ port: 3000 });
 * ```
 */
