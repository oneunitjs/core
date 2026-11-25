import { createHealthRegistry } from "../../health/registry.js";
import type { HealthProvider, HealthRegistry } from "../../health/types.js";

export function createFastifyHealthAdapter(
    server: any,
    options: { path?: string; serviceName?: string } = {},
): { registry: HealthRegistry; get: any; decorate: (name: string, value: unknown) => void } {
    const registry = createHealthRegistry();
    const { path = "/health", serviceName = "app" } = options;

    server.get(path, async (_req: any, reply: any) => {
        const results = await registry.checkAll();
        const providers = registry.getAll ? registry.getAll() : [];
        const criticalByName = new Map(providers.map((p: any) => [p.name, p.critical !== false]));
        const resultsArray = Object.entries(results);
        const hasCriticalUnhealthy = resultsArray.some(([name, result]) =>
            result.status === "unhealthy" && criticalByName.get(name) !== false,
        );
        const hasUnhealthy = resultsArray.some(([, result]) => result.status === "unhealthy");
        const hasDegraded = resultsArray.some(([, result]) => result.status === "degraded");
        let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
        if (hasCriticalUnhealthy) {
            overallStatus = "unhealthy";
        } else if (hasUnhealthy || hasDegraded) {
            overallStatus = "degraded";
        }
        reply.status(hasCriticalUnhealthy ? 503 : 200).send({
            service: serviceName,
            status: overallStatus,
            timestamp: new Date().toISOString(),
            checks: Object.fromEntries(resultsArray),
        });
    });

    return {
        registry,
        get: server.get.bind(server),
        decorate: (name: string, value: unknown): void => {
            if (typeof server.decorate === "function") {
                server.decorate(name, value);
            } else {
                server[name] = value;
            }
        },
    };
}

export function registerFastifyHealthProvider(
    server: any,
    provider: HealthProvider,
    options: { path?: string; serviceName?: string } = {},
): void {
    const adapter = createFastifyHealthAdapter(server, options);
    adapter.registry.register(provider);
}
