import type { HealthRegistry, HealthServer, HealthRouteOptions } from "./types.js";
import { createHealthRegistry } from "./registry.js";

export { createHealthRegistry };

export function createHealthRoute(registry: HealthRegistry, options: HealthRouteOptions = {}): any {
    const { path = "/health", serviceName = "app", includeDetails = false, timeoutMs } = options;

    return async (server: HealthServer) => {
        const checkOptions = timeoutMs !== undefined ? { timeoutMs } : undefined;

        server.get(path, async (_request: any, reply: any) => {
            const results = await registry.checkAll(checkOptions);
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

            reply.status(hasCriticalUnhealthy ? 503 : 200);

            const checks: Record<string, { status: string; latency?: number; message?: string }> = {};
            for (const [name, result] of resultsArray) {
                const entry: { status: string; latency?: number; message?: string } = { status: result.status };
                if (includeDetails) {
                    if (result.latency !== undefined) entry.latency = result.latency;
                    if (result.message !== undefined) entry.message = result.message;
                }
                checks[name] = entry;
            }

            reply.send({
                service: serviceName,
                status: overallStatus,
                timestamp: new Date().toISOString(),
                checks,
            });
        });

        if (includeDetails) {
            server.get(`${path}/details`, async (_request: any, reply: any) => {
                const results = await registry.checkAll(checkOptions);
                reply.status(200).send(results);
            });
        }
    };
}
