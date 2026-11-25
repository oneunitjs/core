import type { Context } from "koa";
import { randomBytes } from "node:crypto";

import { createApp, type App } from "../../core.js";
import type { KoaAdapterOptions } from "./types.js";

import {
    createResponseManager,
    createResponseFrameworkManager,
    createKoaResponseAdapter,
} from "../../response-mangement/index.js";

declare module "koa" {
    interface Context {
        /** The {@link App} instance created by {@link createApp}. */
        core?: App;
        /** Alias for {@link Context.core}. */
        oneunit?: App;
    }
}

const koaAdapter = (
    app: any,
    opts?: KoaAdapterOptions,
): void => {
    const options: KoaAdapterOptions = opts ?? {};

    const {
        autoRegisterHealthRoute = true,
        tryCatchEnabled = true,
        ...appOptions
    } = options;

    const appCore: App = createApp({
        framework: "koa",
        ...appOptions,
    });

    // Expose the full core API globally on the Koa context so it is
    // accessible from any middleware during the application lifecycle.
    app.context.core = appCore;
    app.context.oneunit = appCore;
    app.core = appCore;
    app.oneunit = appCore;

    // Standardised error-handling middleware: registered FIRST so it is the
    // outermost Koa middleware and wraps every downstream handler (including
    // the health route). Koa composes middleware in registration order, so an
    // error handler registered later cannot catch errors from earlier handlers.
    if (tryCatchEnabled) {
        app.use(
            async (ctx: Context, next: () => Promise<void>): Promise<void> => {
                try {
                    await next();
                } catch (err: any) {
                    if (ctx.respondable === false) {
                        throw err;
                    }

                    const correlationId = randomBytes(8).toString("hex");
                    console.error(
                        `[oneunit:koa:${correlationId}] Unhandled error:`,
                        err instanceof Error ? err.stack ?? err.message : String(err),
                    );

                    const manager = createResponseManager({
                        tryCatchEnabled,
                    });
                    const adapter = createKoaResponseAdapter(
                        ctx as unknown as {
                            status: number;
                            body: unknown;
                            set: (key: string, value: string) => void;
                        },
                    );
                    const rfm = createResponseFrameworkManager(manager, adapter, {
                        tryCatchEnabled,
                        defaultErrorStatusCode: 500,
                    });

                    rfm.error({
                        status: 500,
                        message: "Internal Server Error",
                        metadata: { requestId: correlationId },
                    });
                }
            },
        );
    }

    // Register the core health route (GET /health by default).
    if (autoRegisterHealthRoute) {
        const healthPath =
            (appOptions.health as { path?: string } | undefined)?.path ??
            "/health";

        app.use(async (ctx: Context, next: () => Promise<void>): Promise<void> => {
            if (ctx.path !== healthPath) {
                await next();
                return;
            }

            const results = await appCore.health().check();
            const hasUnhealthy = Object.values(results).some(
                (result) => result.status === "unhealthy",
            );
            const hasDegraded = Object.values(results).some(
                (result) => result.status === "degraded",
            );
            const overallStatus: "healthy" | "degraded" | "unhealthy" =
                hasUnhealthy ? "unhealthy" : hasDegraded ? "degraded" : "healthy";

            ctx.status = hasUnhealthy ? 503 : 200;
            ctx.body = {
                service: appCore.config().serviceName,
                status: overallStatus,
                timestamp: new Date().toISOString(),
                checks: results,
            };
        });
    }
};

export default koaAdapter;
export { koaAdapter };
export type { KoaAdapterOptions };
export type { App };

/**
 * Integration example:
 *
 * ```ts
 * import Koa from "koa";
 * import koaAdapter from "@oneunit/core/adapters/koa";
 *
 * const app = new Koa();
 *
 * koaAdapter(app, {
 *   serviceName: "my-api",
 *   port: 3000,
 *   secret: "my-secret",
 *   autoRegisterHealthRoute: true,
 *   healthPath: "/health",
 *   tryCatchEnabled: true,
 *   security: {
 *     cors: { origin: "*" },
 *     helmet: { hidePoweredBy: true },
 *   },
 *   cookie: { secure: true, httpOnly: true, sameSite: "lax" },
 *   multipart: { maxFileSize: 10 * 1024 * 1024 },
 * });
 *
 * // Core API is globally available on the Koa context.
 * app.context.core.health().register("db", async () => ({ status: "healthy" }));
 * app.context.core.lifecycle().registerMiddleware(
 *   "cors",
 *   "cors",
 *   (_req, res, next) => {
 *     res.setHeader("access-control-allow-origin", "*");
 *     next();
 *   },
 * );
 *
 * app.use(async (ctx) => {
 *   const cookies = app.context.core.cookies(ctx.req, ctx.res);
 *   cookies.set("session", "abc123", { httpOnly: true });
 *
 *   const response = app.context.core.response(ctx.req, ctx.res);
 *   response.ok({ data: { ok: true }, message: "OK" });
 *   ctx.body = response; // or set ctx.body directly
 * });
 *
 * app.listen(3000);
 * ```
 */
