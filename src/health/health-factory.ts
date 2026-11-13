import type { HealthProvider, HealthRegistry, HealthCheckResult, HealthServer, HealthRouteOptions } from "./types.js";
import { createHealthRegistry } from "./registry.js";
import { createHealthRoute } from "./route.js";

export function createHealth(options?: { serviceName?: string; path?: string }) {
    const registry: HealthRegistry = createHealthRegistry();

    return {
        registry,
        register(provider: HealthProvider): void {
            registry.register(provider);
        },
        async check(): Promise<Record<string, HealthCheckResult>> {
            return registry.checkAll();
        },
        async route(server: HealthServer): Promise<void> {
            await createHealthRoute(registry, {
                path: options?.path ?? "/health",
                serviceName: options?.serviceName ?? "app",
            } as HealthRouteOptions)(server);
        },
    };
}

export function registerHealth(
    server: HealthServer,
    options?: { serviceName?: string; path?: string },
) {
    const health = createHealth(options);
    health.route(server);
    return health;
}
