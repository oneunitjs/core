/**
 * Express health adapter.
 * Registers health routes on an Express application.
 */
import { BaseHealthAdapter, type HealthAdapterConfig, type HealthAdapterResult } from "./base.js";
import type { HealthProvider, HealthRegistry, HealthRouteOptions } from "../../health/types.js";
import { createHealthRoute } from "../../health/route.js";

export class ExpressHealthAdapter extends BaseHealthAdapter {
    readonly framework = "express" as const;

    constructor(config: HealthAdapterConfig) {
        super(config);
    }

    registerRoutes(): void {
        this.initialize();
        const registry = this.getRegistry();

        const route = createHealthRoute(registry, this.options as HealthRouteOptions);

        const server: any = {
            get: (path: string, handler: any) => {
                (this.server as any).get(path, async (_req: any, res: any) => {
                    const reply: any = {
                        status: (code: number) => {
                            res.status(code);
                            return reply;
                        },
                        send: (body: unknown) => {
                            res.json(body);
                        },
                    };
                    await handler(_req, reply);
                });
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
}

export function createExpressHealthAdapter(
    app: any,
    options?: HealthRouteOptions,
): ExpressHealthAdapter {
    const adapter = new ExpressHealthAdapter({
        framework: "express",
        server: app,
        options,
    });
    adapter.initialize();
    return adapter;
}
