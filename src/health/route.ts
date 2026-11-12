import type { HealthRegistry, HealthCheckResult, HealthServer, HealthCheckResult as HealthCheckResultType } from "./types.js";

export function createHealthRegistry(): HealthRegistry {
    const providers = new Map<string, HealthProvider>();

    return {
        register(provider: HealthProvider): void {
            providers.set(provider.name, provider);
        },

        unregister(name: string): void {
            providers.delete(name);
        },

        getAll(): HealthProvider[] {
            return Array.from(providers.values());
        },

        async checkAll(): Promise<Record<string, HealthCheckResult>> {
            const entries = Array.from(providers.values());
            const results: Record<string, HealthCheckResult> = {};

            for (const provider of entries) {
                const result = await provider.check();
                results[provider.name] = result;
            }

            return results;
        },
    };
}

export function createHealthRoute(registry: HealthRegistry, options: HealthRouteOptions = {}): any {
    const { path = "/health", serviceName = "app" } = options;

    return async (server: HealthServer) => {
        server.get(path, async (_request: any, reply: any) => {
            const results = await registry.checkAll();

            const resultsArray = Object.entries(results);
            const hasUnhealthy = resultsArray.some(([, result]) => result.status === "unhealthy");
            const overallStatus = hasUnhealthy ? "unhealthy" : "healthy";

            reply.status(hasUnhealthy ? 503 : 200);
            reply.send({
                service: serviceName,
                status: overallStatus,
                timestamp: new Date().toISOString(),
                checks: resultsArray.reduce((acc, [name, result]) => {
                    acc[name] = {
                        status: result.status,
                        latency: result.latency,
                        message: result.message,
                    };
                    return acc;
                }, {} as Record<string, { status: "healthy" | "degraded" | "unhealthy"; latency?: number; message?: string }>),
            });
        });
    };
}