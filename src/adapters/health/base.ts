/**
 * Abstract base class for all health adapters.
 *
 * Health adapters register health check routes on framework servers using
 * the shared health registry and route system. Subclasses provide
 * framework-specific server integration.
 */
import { AdapterError, type BaseAdapter, type FrameworkName } from "../types.js";
import type { HealthProvider, HealthRegistry, HealthRouteOptions } from "../../health/types.js";
import { createHealthRegistry } from "../../health/registry.js";

export interface HealthAdapterConfig {
    readonly framework: FrameworkName;
    readonly server: unknown;
    readonly options?: HealthRouteOptions;
}

export interface HealthAdapterResult {
    readonly registry: HealthRegistry;
    readonly register: (provider: HealthProvider) => void;
}

export abstract class BaseHealthAdapter implements BaseAdapter {
    readonly framework: FrameworkName;
    readonly name: string;
    protected readonly server: unknown;
    protected readonly options: HealthRouteOptions;
    private _initialized = false;
    private _registry: HealthRegistry | null = null;

    constructor(config: HealthAdapterConfig) {
        this.framework = config.framework;
        this.name = `health-${config.framework}`;
        this.server = config.server;
        this.options = config.options ?? {};
    }

    get initialized(): boolean {
        return this._initialized;
    }

    initialize(): void {
        if (this._registry) return;
        this._registry = createHealthRegistry();
        this._initialized = true;
        this.registerRoutes();
    }

    dispose(): void {
        this._initialized = false;
        this._registry = null;
    }

    /**
     * Get the health registry, initializing if necessary.
     */
    getRegistry(): HealthRegistry {
        if (!this._initialized) {
            this.initialize();
        }
        if (!this._registry) {
            throw new AdapterError(
                `Health adapter "${this.name}" failed to initialize registry`,
                this.name,
                this.framework,
                "ADAPTER_INIT_FAILED",
            );
        }
        return this._registry;
    }

    /**
     * Register routes on the framework server.
     * Subclasses must implement framework-specific route registration.
     */
    abstract registerRoutes(): void;

    /**
     * Register a health provider.
     */
    registerProvider(provider: HealthProvider): void {
        this.getRegistry().register(provider);
    }
}
