import type { Application, Request, Response, NextFunction } from "express";
import { randomBytes } from "node:crypto";

import { createApp, type App } from "../../core.js";
import type { ExpressAdapterOptions } from "./types.js";

import {
    createResponseManager,
    createResponseFrameworkManager,
    createExpressResponseAdapter,
} from "../../response-mangement/index.js";

declare module "express-serve-static-core" {
    interface Request {
        /** The {@link App} instance created by {@link createApp}. */
        core?: App;
    }

    interface Application {
        /** The {@link App} instance created by {@link createApp}. */
        core?: App;
        /** Alias for {@link Application.core}. */
        oneunit?: App;
    }
}

const expressAdapter = (
    app: Application,
    opts?: ExpressAdapterOptions,
): void => {
    const options: ExpressAdapterOptions = opts ?? {};

    const {
        autoRegisterHealthRoute = true,
        tryCatchEnabled = true,
        ...appOptions
    } = options;

    const appCore: App = createApp({
        ...appOptions,
        framework: "express",
    } as Parameters<typeof createApp>[0]);

    // Expose the full core API globally on the Express app so it is
    // accessible from any route handler or middleware during the
    // application lifecycle.
    app.locals.core = appCore;
    app.locals.oneunit = appCore;
    (app as Application & { core?: App }).core = appCore;
    (app as Application & { oneunit?: App }).oneunit = appCore;

    // Register the core health route (GET /health by default).
    if (autoRegisterHealthRoute) {
        const healthPath =
            (appOptions.health as { path?: string } | undefined)?.path ??
            "/health";

        app.get(healthPath, async (_req: Request, res: Response): Promise<void> => {
            const results = await appCore.health().check();
            const hasUnhealthy = Object.values(results).some(
                (result) => result.status === "unhealthy",
            );
            const hasDegraded = Object.values(results).some(
                (result) => result.status === "degraded",
            );
            const overallStatus: "healthy" | "degraded" | "unhealthy" =
                hasUnhealthy ? "unhealthy" : hasDegraded ? "degraded" : "healthy";

            res.status(hasUnhealthy ? 503 : 200).json({
                service: appCore.config().serviceName,
                status: overallStatus,
                timestamp: new Date().toISOString(),
                checks: results,
            });
        });
    }

    // Attach the core app to each request for convenient access in handlers.
    app.use((req: Request, _res: Response, next: NextFunction): void => {
        req.core = appCore;
        next();
    });

    // Standardised error-handling middleware: registered LAST so it is the
    // outermost error boundary for middleware and routes added after the
    // adapter is installed. Express 4-arg error handlers only catch errors
    // from handlers registered downstream, so route handlers should also be
    // wrapped with response.wrapHandler() for full coverage.
    if (tryCatchEnabled) {
        app.use(
            (
                err: any,
                _req: Request,
                res: Response,
                _next: NextFunction,
            ): void => {
                if (res.headersSent) {
                    return;
                }

                const correlationId = randomBytes(8).toString("hex");
                console.error(
                    `[oneunit:express:${correlationId}] Unhandled error:`,
                    err instanceof Error ? err.stack ?? err.message : String(err),
                );

                const manager = createResponseManager({
                    tryCatchEnabled,
                });
                const adapter = createExpressResponseAdapter(
                    res as unknown as {
                        status: (code: number) => unknown;
                        json: (body: unknown) => void;
                        setHeader: (key: string, value: string | string[]) => void;
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
            },
        );
    }
};

export default expressAdapter;
export { expressAdapter };
export type { ExpressAdapterOptions };
export type { App };

/**
 * Integration example:
 *
 * ```ts
 * import express from "express";
 * import expressAdapter from "@oneunit/core/adapters/express";
 *
 * const app = express();
 * app.use(express.json());
 *
 * expressAdapter(app, {
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
 * // Core API is globally available on the Express app.
 * app.core.health().register("db", async () => ({ status: "healthy" }));
 * app.core.lifecycle().registerMiddleware(
 *   "cors",
 *   "cors",
 *   (_req, res, next) => {
 *     res.setHeader("access-control-allow-origin", "*");
 *     next();
 *   },
 * );
 *
 * app.get("/example", (req, res) => {
 *   const cookies = app.core.cookies(req, res);
 *   cookies.set("session", "abc123", { httpOnly: true });
 *
 *   const response = app.core.response(req, res);
 *   response.ok({ data: { ok: true }, message: "OK" });
 * });
 *
 * app.listen(3000);
 * ```
 */
