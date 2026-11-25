import { createHealthRegistry } from "../../health/registry.js";
import type { HealthProvider, HealthRegistry } from "../../health/types.js";

export function createExpressHealthAdapter(
    server: any,
    options: { path?: string; serviceName?: string } = {},
): { registry: HealthRegistry; get: any; decorate: (name: string, value: unknown) => void } {
    const registry = createHealthRegistry();
    const { path = "/health", serviceName = "app" } = options;

    server.get(path, async (_req: any, res: any) => {
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
        res.status(hasCriticalUnhealthy ? 503 : 200).json({
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
            server[name] = value;
        },
    };
}

export function registerExpressHealthProvider(
    server: any,
    provider: HealthProvider,
    options: { path?: string; serviceName?: string } = {},
): void {
    const adapter = createExpressHealthAdapter(server, options);
    adapter.registry.register(provider);
}
