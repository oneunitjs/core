import type { AppOptions } from "../../core/index.js";

/**
 * Options for the Fastify adapter plugin.
 *
 * Extends the core {@link AppOptions} with Fastify-specific registration
 * behaviour (health route auto-registration, reply decoration, etc.).
 */
export interface FastifyAdapterOptions
    extends Omit<AppOptions, "framework"> {
    /** Always "fastify" for this adapter. */
    framework?: "fastify";

    /** Automatically register the health route on the Fastify instance (default: true). */
    autoRegisterHealthRoute?: boolean;

    /** Custom path for the health route (default: "/health"). */
    healthPath?: string;

    /** Enable try/catch wrapping around route handlers (default: true). */
    tryCatchEnabled?: boolean;

    /** Decorate the Fastify reply with response helpers (default: true). */
    decorateReply?: boolean;
}
