/**
 * Abstract base class for all middleware adapters.
 *
 * Adapts lifecycle middleware registrations (which use the Express-style
 * (req, res, next) signature) to framework-specific middleware formats.
 *
 * Subclasses must implement the adapt() method to convert a
 * MiddlewareRegistration into a framework-compatible middleware function.
 */
import { AdapterError, type BaseAdapter, type FrameworkName } from "../types.js";
import type { MiddlewareRegistration } from "../../lifecycle/types.js";

export interface MiddlewareAdapterConfig {
    readonly framework: FrameworkName;
    readonly registration: MiddlewareRegistration;
}

export abstract class BaseMiddlewareAdapter implements BaseAdapter {
    readonly framework: FrameworkName;
    readonly name: string;
    protected readonly registration: MiddlewareRegistration;
    initialized = false;

    constructor(config: MiddlewareAdapterConfig) {
        this.framework = config.framework;
        this.name = `middleware-${config.framework}`;
        this.registration = config.registration;
    }

    initialize(): void {
        this.initialized = true;
    }

    dispose(): void {
        this.initialized = false;
    }

    /**
     * Adapt the lifecycle middleware registration to a framework-specific
     * middleware function. Subclasses must implement this.
     */
    abstract adapt(): any;

    /**
     * Execute the adapted middleware.
     * Throws if the adapter is not initialized.
     */
    execute(req: unknown, res: unknown, next?: () => void): void {
        if (!this.initialized) {
            throw new AdapterError(
                `Middleware adapter "${this.name}" is not initialized`,
                this.name,
                this.framework,
                "ADAPTER_NOT_INITIALIZED",
            );
        }
        const adapted = this.adapt();
        adapted(req, res, next);
    }
}
