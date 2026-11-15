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
 * const ctx = createRequestContext({
 *   autoTimestamp: true,
 *   timestampKey: "requestTime",
 *   timestampFormat: "iso",
 * });
 *
 * await ctx.run(async () => {
 *   ctx.set("requestId", "req-123");
 *   console.log(ctx.get("requestId")); // "req-123"
 * });
 * ```
 */

import type { RequestContext, RequestContextOptions } from "./types.js";
import {
    createStorage,
    createStore,
    getCurrentStore,
} from "./internal/storage.js";

/**
 * Creates a new request context instance.
 *
 * Each instance owns one AsyncLocalStorage. Every call to `run()` creates an
 * isolated `Map` store, so concurrent requests never share state and nested
 * executions receive a fresh, non-inherited context.
 *
 * @param options - Optional configuration
 * @returns A request context instance
 *
 * @example
 * ```ts
 * const ctx = createRequestContext();
 *
 * await ctx.run(async () => {
 *   ctx.set("requestId", "abc");
 *   console.log(ctx.get("requestId")); // "abc"
 * });
 * ```
 */
export function createRequestContext<
    T extends object = Record<string, unknown>
>(
    options: RequestContextOptions<T> = {}
): RequestContext<T> {

    const storage = createStorage();

    const {
        initialValues = {} as Partial<T>,
        autoTimestamp = false,
        timestampKey = "timestamp",
        timestampFormat = "iso"
    } = options;

    const storeOptions = {
        initialValues: initialValues as Record<string, unknown>,
        autoTimestamp,
        timestampKey,
        timestampFormat
    };

    return {

        get<K extends keyof T>(key: K): T[K] | undefined {
            return getCurrentStore(storage)?.get(String(key)) as
                T[K] | undefined;
        },

        set<K extends keyof T>(key: K, value: T[K]): boolean {
            const store = getCurrentStore(storage);

            if (!store) return false;

            store.set(String(key), value);

            return true;
        },

        delete(key: keyof T): boolean {
            return getCurrentStore(storage)?.delete(String(key)) ?? false;
        },

        has(key: keyof T): boolean {
            return getCurrentStore(storage)?.has(String(key)) ?? false;
        },

        getAll(): Partial<T> {
            const store = getCurrentStore(storage);

            if (!store) return {};

            return Object.fromEntries(store) as Partial<T>;
        },

        clear(): void {
            getCurrentStore(storage)?.clear();
        },

        isActive(): boolean {
            return getCurrentStore(storage) !== undefined;
        },

        async run<R>(
            fn: () => R | Promise<R>,
            values: Partial<T> = {}
        ): Promise<R> {

            const store = createStore(
                storeOptions,
                values as Record<string, unknown>
            );

            return storage.run(store, fn);
        }
    };
}
