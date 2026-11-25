import { createHealthRegistry } from "../../health/registry.js";
import type { HealthProvider, HealthRegistry } from "../../health/types.js";

export function createKoaHealthAdapter(
    server: any,
    options: { path?: string; serviceName?: string } = {},
): { registry: HealthRegistry; get: any; decorate: (name: string, value: unknown) => void } {
    const registry = createHealthRegistry();
    const healthPath = options.path ?? "/health";

    server.use(async (ctx: any) => {
        if (ctx.path !== healthPath) {
            ctx.status = 404;
            ctx.body = "Not Found";
            return;
        }

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
        ctx.status = hasCriticalUnhealthy ? 503 : 200;
        ctx.body = {
            service: options.serviceName ?? "app",
            status: overallStatus,
            timestamp: new Date().toISOString(),
            checks: Object.fromEntries(resultsArray),
        };
    });

    return {
        registry,
        get: (_path: string, _handler: any): void => {
            // Route registration is handled via .use() above.
        },
        decorate: (name: string, value: unknown): void => {
            server[name] = value;
        },
    };
}

export function registerKoaHealthProvider(
    server: any,
    provider: HealthProvider,
    options: { path?: string; serviceName?: string } = {},
): void {
    const adapter = createKoaHealthAdapter(server, options);
    adapter.registry.register(provider);
}
