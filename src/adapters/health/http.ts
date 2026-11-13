/**
 * node:http health adapter.
 * Registers health routes on a node:http server.
 */
import { BaseHealthAdapter, type HealthAdapterConfig, type HealthAdapterResult } from "./base.js";
import type { HealthProvider, HealthRegistry, HealthRouteOptions } from "../../health/types.js";
import { createHealthRoute } from "../../health/route.js";

export class HttpHealthAdapter extends BaseHealthAdapter {
    readonly framework = "http" as const;

    constructor(config: HealthAdapterConfig) {
        super(config);
    }

    registerRoutes(): void {
        this.initialize();
        const registry = this.getRegistry();

        const route = createHealthRoute(registry, this.options as HealthRouteOptions);

        const server: any = {
            get: (path: string, handler: any) => {
                // node:http doesn't have route-based registration,
                // so we store the handler for later dispatch
                (this.server as any)._healthHandlers =
                    (this.server as any)._healthHandlers || {};
                (this.server as any)._healthHandlers[path] = handler;
            },
            decorate: (name: string, value: unknown) => {
                (this.server as any)[name] = value;
            },
        };

        route(server);
    }

    get registry(): HealthRegistry {
        return this.getRegistry();
    }

    get register(): (provider: HealthProvider) => void {
        return (provider: HealthProvider) => {
            this.registerProvider(provider);
        };
    }

    getResult(): HealthAdapterResult {
        return {
            registry: this.getRegistry(),
            register: (provider: HealthProvider) => {
                this.registerProvider(provider);
            },
        };
    }

    /**
     * Get the health handler for a specific path, for use in the http server's
     * request listener.
     */
    getHandlerForPath(path: string): any {
        return (this.server as any)._healthHandlers?.[path];
    }
}

export function createHttpHealthAdapter(
    server: any,
    options?: HealthRouteOptions,
): HttpHealthAdapter {
    const adapter = new HttpHealthAdapter({
        framework: "http",
        server,
        options,
    });
    adapter.initialize();
    return adapter;
}
