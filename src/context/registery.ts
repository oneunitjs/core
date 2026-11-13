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
 * // Create a context instance with auto timestamp
 * const ctx = createRequestContext({
 *   autoTimestamp: true,
 *   timestampKey: "requestTime",
 *   timestampFormat: "iso",
 * });
 *
 * // Use within an async request handler
 * await ctx.run({ requestId: "req-123" }, async () => {
 *   const id = ctx.get("requestId");
 *   const ts = ctx.get("timestamp"); // ISO timestamp added automatically
 *   console.log(`Request ID: ${id}, Time: ${ts}`);
 * });
 *
 * // Disable context tracking
 * ctx.disable();
 * // Re-enable
 * ctx.enable();
 * ```
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
 * @param options - Optional configuration
 * @returns A request context instance
 *
 * @example
 * ```ts
 * const ctx = createRequestContext();
 *
 * await ctx.run({ requestId: "abc" }, async () => {
 *   console.log(ctx.get("requestId")); // "abc"
 * });
 * ```
 */
export function createRequestContext(
    options?: RequestContextOptions,
): RequestContext & {
    run: <R = unknown>(fn: () => R | Promise<R>, values?: Record<string, unknown>) => Promise<R>;
    enable(): void;
    disable(): void;
} {
    const store = new AsyncLocalStorage<Map<string, unknown>>();
    let enabled = true;
    const autoTimestamp: boolean = options?.autoTimestamp ?? false;
    const timestampKey: string = options?.timestampKey ?? "timestamp";
    const timestampFormat: string = options?.timestampFormat ?? "iso";

    function getContext(): Map<string, unknown> | undefined {
        if (!enabled) return undefined;
        return store.getStore();
    }

    function addTimestamp(values: Map<string, unknown>): void {
        if (!autoTimestamp) return;
        const key = timestampKey;
        if (values.has(key)) return;

        const now = new Date();
        let timestamp: string | number;
        switch (timestampFormat) {
            case "unix":
                timestamp = Math.floor(now.getTime() / 1000);
                break;
            case "unix-ms":
                timestamp = now.getTime();
                break;
            case "iso":
            default:
                timestamp = now.toISOString();
                break;
        }
        values.set(key, timestamp);
    }

    return {
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
        async run<R = unknown>(
            fn: () => R | Promise<R>,
            values?: Record<string, unknown>,
        ): Promise<R> {
            const ctx = new Map<string, unknown>(Object.entries(values ?? {}));
            addTimestamp(ctx);
            return store.run(ctx, fn);
        },
        enable() {
            enabled = true;
        },
        disable() {
            enabled = false;
        },
    };
}
