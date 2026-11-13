/**
 * Fastify health adapter.
 * Registers health routes on a Fastify server instance.
 */
import { BaseHealthAdapter, type HealthAdapterConfig, type HealthAdapterResult } from "./base.js";
import type { HealthProvider, HealthRegistry, HealthRouteOptions } from "../../health/types.js";
import { createHealthRoute } from "../../health/route.js";

export class FastifyHealthAdapter extends BaseHealthAdapter {
    readonly framework = "fastify" as const;

    constructor(config: HealthAdapterConfig) {
        super(config);
    }

    registerRoutes(): void {
        this.initialize();
        const registry = this.getRegistry();

        const route = createHealthRoute(registry, this.options as HealthRouteOptions);

        const server: any = {
            get: (path: string, handler: any) => {
                (this.server as any).get(path, async (_req: any, reply: any) => {
                    const healthReply: any = {
                        status: (code: number) => {
                            reply.code(code);
                            return healthReply;
                        },
                        send: (body: unknown) => {
                            reply.send(body);
                        },
                    };
                    await handler(_req, healthReply);
                });
            },
            decorate: (name: string, value: unknown) => {
                (this.server as any).decorate(name, value);
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

export function createFastifyHealthAdapter(
    server: any,
    options?: HealthRouteOptions,
): FastifyHealthAdapter {
    const adapter = new FastifyHealthAdapter({
        framework: "fastify",
        server,
        options,
    });
    adapter.initialize();
    return adapter;
}
