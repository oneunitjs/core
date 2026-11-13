import type { HealthProvider, HealthRegistry, HealthServer, HealthRouteOptions } from "../types.js";
import { createHealthRegistry } from "../registry.js";
import { createHealthRoute } from "../route.js";

export function createExpressHealthAdapter(
    app: any,
    options: HealthRouteOptions = {},
): { registry: HealthRegistry; register(provider: HealthProvider): void } {
    const registry: HealthRegistry = createHealthRegistry();
    const route = createHealthRoute(registry, options);

    const server: HealthServer = {
        get: (path, handler) => {
            app.get(path, async (_req: any, res: any) => {
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
        decorate: (name, value) => {
            (app as any)[name] = value;
        },
    };

    route(server);

    return {
        registry,
        register(provider: HealthProvider): void {
            registry.register(provider);
        },
    };
}

export function createFastifyHealthAdapter(
    server: any,
    options: HealthRouteOptions = {},
): { registry: HealthRegistry; register(provider: HealthProvider): void } {
    const registry: HealthRegistry = createHealthRegistry();
    const route = createHealthRoute(registry, options);

    const healthServer: HealthServer = {
        get: (path, handler) => {
            server.get(path, async (_req: any, reply: any) => {
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
        decorate: (name, value) => {
            server.decorate(name, value);
        },
    };

    route(healthServer);

    return {
        registry,
        register(provider: HealthProvider): void {
            registry.register(provider);
        },
    };
}

export function createKoaHealthAdapter(
    app: any,
    options: HealthRouteOptions = {},
): { registry: HealthRegistry; register(provider: HealthProvider): void } {
    const registry: HealthRegistry = createHealthRegistry();
    const route = createHealthRoute(registry, options);

    const healthServer: HealthServer = {
        get: (path, handler) => {
            app.use(async (ctx: any, next: any) => {
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
        decorate: (name, value) => {
            (app as any)[name] = value;
        },
    };

    route(healthServer);

    return {
        registry,
        register(provider: HealthProvider): void {
            registry.register(provider);
        },
    };
}
