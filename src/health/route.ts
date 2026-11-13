import type { HealthRegistry, HealthCheckResult, HealthServer, HealthRouteOptions } from "./types.js";
import { createHealthRegistry } from "./registry.js";

export { createHealthRegistry };

export function createHealthRoute(registry: HealthRegistry, options: HealthRouteOptions = {}): any {
    const { path = "/health", serviceName = "app", includeDetails = false } = options;

    return async (server: HealthServer) => {
        server.get(path, async (_request: any, reply: any) => {
            const results = await registry.checkAll();

            const resultsArray = Object.entries(results);
            const hasUnhealthy = resultsArray.some(([, result]) => result.status === "unhealthy");
            const hasDegraded = resultsArray.some(([, result]) => result.status === "degraded");

            let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
            if (hasUnhealthy) {
                overallStatus = "unhealthy";
            } else if (hasDegraded) {
                overallStatus = "degraded";
            }

            reply.status(hasUnhealthy ? 503 : 200);

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
                const results = await registry.checkAll();
                reply.status(200).send(results);
            });
        }
    };
}
