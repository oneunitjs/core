/**
 * @oneunit/core - Request Context Types
 *
 * Type definitions for the request context module which uses Node.js
 * AsyncLocalStorage to provide request-scoped storage.
 */

export type TimestampFormat = "iso" | "unix" | "unix-ms";

export interface RequestContextOptions<T extends object = Record<string, unknown>> {

    /** Initial values to set in the context when created */
    initialValues?: Partial<T>;

    /** Automatically add a timestamp to each run() call (default: false) */
    autoTimestamp?: boolean;

    /** Key name for the timestamp value (default: "timestamp") */
    timestampKey?: string;

    /** Format for the timestamp value (default: "iso") */
    timestampFormat?: TimestampFormat;
}

export interface RequestContext<T extends object = Record<string, unknown>> {

    /**
     * Get a value from the current request context.
     * Returns undefined if no context is active or the key doesn't exist.
     */
    get<K extends keyof T>(key: K): T[K] | undefined;

    /**
     * Set a value in the current request context.
     * Returns true if the value was stored, false when no context is active.
     */
    set<K extends keyof T>(key: K, value: T[K]): boolean;

    /**
     * Remove one key from the current context.
     * Returns false when no context is active.
     */
    delete(key: keyof T): boolean;

    /**
     * Check whether a key exists in the current context.
     * Returns false when no context is active.
     */
    has(key: keyof T): boolean;

    /**
     * Get all current context values as a plain object snapshot.
     * Returns an empty object if no context is active.
     */
    getAll(): Partial<T>;

    /**
     * Clear every key from the current context.
     * No operation when no context is active.
     */
    clear(): void;

    /**
     * Determine whether a context store is available in the current
     * execution chain.
     */
    isActive(): boolean;

    /**
     * Run a function within an isolated context boundary.
     * Returns a Promise containing the function's result.
     */
    run<R>(
        fn: () => R | Promise<R>,
        values?: Partial<T>
    ): Promise<R>;
}
