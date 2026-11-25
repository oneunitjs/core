import type { AppOptions } from "../../core/index.js";

/**
 * Options for the Koa adapter.
 *
 * Extends the core {@link AppOptions} with Koa-specific registration
 * behaviour (health route auto-registration, error handling, etc.).
 */
export interface KoaAdapterOptions extends Omit<AppOptions, "framework"> {
    /** Always "koa" for this adapter. */
    framework?: "koa";

    /** Automatically register the health route on the Koa app (default: true). */
    autoRegisterHealthRoute?: boolean;

    /** Custom path for the health route (default: "/health"). */
    healthPath?: string;

    /** Enable try/catch error handling middleware (default: true). */
    tryCatchEnabled?: boolean;
}
