/**
 * @oneunit/core - Request Context Adapter Types
 *
 * Defines the shared types for framework-specific multipart context adapters.
 */

export type FrameworkName = "express" | "fastify" | "koa" | "http";

export interface ContextAdapterOptions {
    /** Optional function to generate a unique request ID */
    requestIdGenerator?: () => string;
    /** Whether to automatically add request metadata (IP, user agent, etc.) */
    captureRequestInfo?: boolean;
    /** Whether to auto timestamp requests */
    autoTimestamp?: boolean;
}

/**
 * Interface that all context adapters must implement.
 */
export interface ContextAdapter {
    readonly framework: FrameworkName;
    readonly name: string;
    middleware: any;
}