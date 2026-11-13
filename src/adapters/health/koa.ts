/**
 * Koa health adapter.
 * Registers health routes on a Koa application.
 */
import { BaseHealthAdapter, type HealthAdapterConfig, type HealthAdapterResult } from "./base.js";
import type { HealthProvider, HealthRegistry, HealthRouteOptions } from "../../health/types.js";
import { createHealthRoute } from "../../health/route.js";

export class KoaHealthAdapter extends BaseHealthAdapter {
    readonly framework = "koa" as const;

    constructor(config: HealthAdapterConfig) {
        super(config);
    }

    registerRoutes(): void {
        this.initialize();
        const registry = this.getRegistry();

        const route = createHealthRoute(registry, this.options as HealthRouteOptions);

        const server: any = {
            get: (path: string, handler: any) => {
                (this.server as any).use(async (ctx: any, next: any) => {
                    if (ctx.method !== "GET" || ctx.path !== path) {
                        await next();
                        return;
                    }

                    const reply: any = {
                        status: (code: number) => {
                            ctx.status = code;
                            return reply;
                        },
                        send: (body: unknown) => {
                            ctx.body = body;
                        },
                    };

                    await handler(ctx.request, reply);
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

export function createKoaHealthAdapter(
    app: any,
    options?: HealthRouteOptions,
): KoaHealthAdapter {
    const adapter = new KoaHealthAdapter({
        framework: "koa",
        server: app,
        options,
    });
    adapter.initialize();
    return adapter;
}
