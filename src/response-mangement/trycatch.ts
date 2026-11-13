/**
 * Try/catch wrapper utilities for API route handlers.
 *
 * Provides automatic error handling for route handlers. When enabled,
 * any thrown error in a route handler is caught and converted to a
 * standardized error response using the ResponseManager.
 */

import type { ResponseFrameworkAdapter } from "../adapters/response/types.js";
import { ResponseManager } from "./registry.js";

/**
 * Options for try/catch wrapping.
 */
export interface TryCatchOptions {
    /** Status code to use for caught errors (default: 500) */
    statusCode?: number;
    /** Custom error message (default: error message or "Internal Server Error") */
    message?: string;
    /** Whether to include the error stack in the response (default: false) */
    includeStack?: boolean;
}

/**
 * Wraps an async route handler with try/catch. If the handler throws,
 * the error is caught and sent as a standardized error response.
 *
 * @param handler - The async route handler to wrap
 * @param manager - ResponseManager instance for sending responses
 * @param adapter - Framework response adapter
 * @param options - Try/catch options
 * @returns A wrapped handler function with the same signature
 *
 * @example
 * ```ts
 * const safeHandler = withTryCatch(
 *   async (req, res) => {
 *     const data = await riskyOperation();
 *     res.json(data);
 *   },
 *   manager,
 *   adapter,
 *   { statusCode: 500, includeStack: false }
 * );
 * app.get("/api/data", safeHandler);
 * ```
 */
export function withTryCatch(
    handler: (req: unknown, res: unknown, next?: () => void) => void | Promise<void>,
    manager: ResponseManager,
    adapter: ResponseFrameworkAdapter,
    options: TryCatchOptions = {},
): (req: unknown, res: unknown, next?: () => void) => void | Promise<void> {
    const statusCode = options.statusCode ?? 500;
    const includeStack = options.includeStack ?? false;

    return async (req: unknown, res: unknown, next?: () => void) => {
        try {
            await handler(req, res, next);
        } catch (err: any) {
            const message = options.message ?? err?.message ?? "Internal Server Error";

            const response = manager.error({
                status: statusCode,
                message,
                ...(includeStack && err?.stack ? { metadata: { stack: err.stack } } : {}),
            });

            adapter.send({
                status: statusCode,
                body: response,
                headers: { "content-type": "application/json" },
            });

            // Call next if available (for Express-style error middleware)
            if (next) {
                next();
            }
        }
    };
}

/**
 * Creates a try/catch middleware wrapper that can be applied globally.
 * Returns middleware that wraps subsequent handlers with try/catch.
 *
 * @param manager - ResponseManager instance
 * @param adapter - Framework response adapter
 * @param options - Try/catch options
 * @returns Middleware function
 *
 * @example
 * ```ts
 * app.use(createTryCatchMiddleware(manager, adapter, { enabled: true }));
 * app.get("/api/data", async (req, res) => {
 *   // Automatically wrapped with try/catch
 *   const data = await riskyOperation();
 *   res.json(data);
 * });
 * ```
 */
export function createTryCatchMiddleware(
    manager: ResponseManager,
    adapter: ResponseFrameworkAdapter,
    options: TryCatchOptions = {},
): (req: unknown, res: unknown, next: () => void) => void {
    return (req: unknown, res: unknown, next: () => void) => {
        const originalNext = next;
        let called = false;

        const safeNext = () => {
            if (!called) {
                called = true;
                originalNext();
            }
        };

        const wrappedHandler = withTryCatch(
            async (_req: unknown, _res: unknown) => {
                safeNext();
            },
            manager,
            adapter,
            options,
        );

        wrappedHandler(req, res, safeNext);
    };
}

/**
 * Wraps a route handler with try/catch conditionally based on enabled flag.
 * If enabled is false, the original handler is returned unchanged.
 *
 * @param handler - The route handler to potentially wrap
 * @param manager - ResponseManager instance
 * @param adapter - Framework response adapter
 * @param enabled - Whether try/catch is enabled
 * @param options - Try/catch options
 * @returns The wrapped or original handler
 */
export function withTryCatchConditional(
    handler: (req: unknown, res: unknown, next?: () => void) => void | Promise<void>,
    manager: ResponseManager,
    adapter: ResponseFrameworkAdapter,
    enabled: boolean,
    options: TryCatchOptions = {},
): (req: unknown, res: unknown, next?: () => void) => void | Promise<void> {
    if (!enabled) {
        return handler;
    }
    return withTryCatch(handler, manager, adapter, options);
}
