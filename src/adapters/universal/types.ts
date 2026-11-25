import type { AppOptions } from "../../core/index.js";

/**
 * Framework kind detected by the universal adapter.
 */
export type UniversalFramework = "express" | "fastify" | "koa" | "http" | "unknown";

/**
 * Options for the universal adapter.
 *
 * Extends the core {@link AppOptions} with universal adapter behaviour.
 * When `framework` is omitted, the framework is auto-detected from the
 * supplied server instance.
 */
export interface UniversalAdapterOptions extends Omit<AppOptions, "framework"> {
    /** Explicit framework to use. When omitted, auto-detected from the server. */
    framework?: UniversalFramework;

    /** Automatically register the health route (default: true). */
    autoRegisterHealthRoute?: boolean;

    /** Custom path for the health route (default: "/health"). */
    healthPath?: string;

    /** Enable try/catch error handling (default: true). */
    tryCatchEnabled?: boolean;
}
