/**
 * @oneunit/core - Request Context Types
 *
 * Type definitions for the request context module which uses Node.js
 * AsyncLocalStorage to provide request-scoped storage.
 */

export interface RequestContextOptions {
    /** Initial values to set in the context when created */
    initialValues?: Record<string, unknown>;
}

export interface RequestContext {
    /**
     * Get a value from the current request context.
     * Returns undefined if no context is active or the key doesn't exist.
     */
    get<T = unknown>(key: string): T | undefined;

    /**
     * Set a value in the current request context.
     * Returns true if the value was set successfully (i.e., we're inside a context).
     */
    set(key: string, value: unknown): boolean;

    /**
     * Delete a value from the current request context.
     * Returns true if the key existed and was removed.
     */
    delete(key: string): boolean;

    /**
     * Check if a key exists in the current context.
     */
    has(key: string): boolean;

    /**
     * Get all current context values as a plain object.
     * Returns an empty object if no context is active.
     */
    getAll(): Record<string, unknown>;

    /**
     * Clear all values from the current context.
     */
    clear(): void;

    /**
     * Check if we're currently inside a request context.
     */
    isActive(): boolean;

    /**
     * Run a function within this context with initial values.
     * Values are available via `get()` during execution.
     */
    run<R = unknown>(fn: () => R | Promise<R>, values?: Record<string, unknown>): Promise<R>;
}
