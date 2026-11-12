import type { HealthProvider, HealthCheckResult } from "./types.js";

export function createHealthProvider(
    name: string,
    check: () => HealthCheckResult | Promise<HealthCheckResult>,
    critical = false,
): HealthProvider {
    return { name, check, critical };
}

export function createDatabaseHealthProvider(
    check: () => Promise<unknown>,
    critical = false,
): HealthProvider {
    return createHealthProvider("database", async () => {
        try {
            await check();
            return { status: "healthy" };
        } catch (err) {
            return {
                status: "unhealthy",
                message: err instanceof Error ? err.message : String(err),
            };
        }
    }, critical);
}

export function createRedisHealthProvider(
    check: () => Promise<unknown>,
    critical = false,
): HealthProvider {
    return createHealthProvider("redis", async () => {
        try {
            await check();
            return { status: "healthy" };
        } catch (err) {
            return {
                status: "unhealthy",
                message: err instanceof Error ? err.message : String(err),
            };
        }
    }, critical);
}

export function createKafkaHealthProvider(
    check: () => Promise<unknown>,
    critical = false,
): HealthProvider {
    return createHealthProvider("kafka", async () => {
        try {
            await check();
            return { status: "healthy" };
        } catch (err) {
            return {
                status: "unhealthy",
                message: err instanceof Error ? err.message : String(err),
            };
        }
    }, critical);
}
