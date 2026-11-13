/**
 * @oneunit/core - Request Context Implementation
 *
 * Implements request-scoped storage using Node.js AsyncLocalStorage.
 * Allows storing and accessing request-specific data (e.g., request ID, user ID,
 * trace ID, client IP) throughout the request lifecycle without passing it
 * through every function call.
 *
 * ```ts
 * import { createRequestContext } from "@oneunit/core";
 *
 * // Create a context instance
 * const requestContext = createRequestContext<{
 *   requestId: string;
 *   userId: string | undefined;
 * }>();
 *
 * // Use within an async request handler
 * await requestContext.run({ requestId: "req-123", userId: "user-456" }, async () => {
 *   const currentId = requestContext.get("requestId");
 *   console.log(`Request ID: ${currentId}`); // "Request ID: req-123"
 * });
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestContext, RequestContextOptions } from "./types.js";

/**
 * Creates a new request context instance.
 *
 * The returned object provides methods to get, set, delete, and check
 * request-scoped values, plus a `run` method to execute code within
 * the context.
 *
 * @param options - Optional configuration (initialValues to pre-populate)
 * @returns A request context instance
 *
 * @example
 * ```ts
 * const ctx = createRequestContext();
 * await ctx.run({ requestId: "abc" }, async () => {
 *   console.log(ctx.get("requestId")); // "abc"
 * });
 * ```
 */
export function createRequestContext(
    _options?: RequestContextOptions,
): RequestContext & {
    run: <R = unknown>(fn: () => R | Promise<R>) => Promise<R>;
    runWithValues: <R = unknown>(
        values: Record<string, unknown>,
        fn: () => R | Promise<R>,
    ) => Promise<R>;
} {
    const store = new AsyncLocalStorage<Map<string, unknown>>();

    function getContext(): Map<string, unknown> | undefined {
        return store.getStore();
    }

    const context: RequestContext & {
        run: <R = unknown>(fn: () => R | Promise<R>) => Promise<R>;
        runWithValues: <R = unknown>(
            values: Record<string, unknown>,
            fn: () => R | Promise<R>,
        ) => Promise<R>;
    } = {
        get<T = unknown>(key: string): T | undefined {
            const ctx = getContext();
            return ctx?.get(key) as T | undefined;
        },
        set(key: string, value: unknown): boolean {
            const ctx = getContext();
            if (!ctx) return false;
            ctx.set(key, value);
            return true;
        },
        delete(key: string): boolean {
            const ctx = getContext();
            if (!ctx) return false;
            return ctx.delete(key);
        },
        has(key: string): boolean {
            const ctx = getContext();
            if (!ctx) return false;
            return ctx.has(key);
        },
        getAll(): Record<string, unknown> {
            const ctx = getContext();
            if (!ctx) return {};
            return Object.fromEntries(ctx);
        },
        clear(): void {
            const ctx = getContext();
            if (ctx) ctx.clear();
        },
        isActive(): boolean {
            return getContext() !== undefined;
        },
        async run<R = unknown>(fn: () => R | Promise<R>): Promise<R> {
            return store.run(new Map<string, unknown>(), fn);
        },
        async runWithValues<R = unknown>(
            values: Record<string, unknown>,
            fn: () => R | Promise<R>,
        ): Promise<R> {
            const ctx = new Map<string, unknown>(Object.entries(values));
            return store.run(ctx, fn);
        },
    };

    return context;
}
