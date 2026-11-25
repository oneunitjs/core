import type { HealthProvider, HealthRegistry, HealthCheckResult } from "./types.js";

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

        async checkAll(options: { timeoutMs?: number } = {}): Promise<Record<string, HealthCheckResult>> {
            const entries = Array.from(providers.values());
            const timeoutMs = options.timeoutMs;

            // The checks run in parallel: the endpoint answers in the time of
            // the slowest provider instead of the sum of all of them. A slow
            // dependency must not delay the answer of the others. Each provider
            // is bounded by a per-provider timeout so a hung provider cannot
            // hang the entire health-check endpoint indefinitely. Timers are
            // cleared in a finally block so fast providers do not leak timer
            // resources, and an AbortSignal is surfaced so providers can
            // cooperatively cancel (cancellation cannot forcibly stop arbitrary
            // JavaScript).
            const results = await Promise.all(
                entries.map(async (provider) => {
                    const start = process.hrtime.bigint();
                    let result: HealthCheckResult;
                    let timeoutHandle: NodeJS.Timeout | null = null;
                    const abortController = new AbortController();

                    const timeoutPromise = timeoutMs !== undefined
                        ? new Promise<never>((_, reject) => {
                              timeoutHandle = setTimeout(() => {
                                  abortController.abort();
                                  reject(new Error("Health check timed out"));
                              }, timeoutMs);
                          })
                        : null;

                    const clearTimer = (): void => {
                        if (timeoutHandle) {
                            clearTimeout(timeoutHandle);
                            timeoutHandle = null;
                        }
                    };

                    try {
                        const checkPromise = provider.check({ signal: abortController.signal });
                        const resolved = timeoutPromise
                            ? Promise.race([checkPromise, timeoutPromise])
                            : checkPromise;

                        result = await resolved;
                    } catch {
                        result = {
                            status: "unhealthy",
                            message: "Health check failed",
                        };
                    } finally {
                        clearTimer();
                    }

                    const end = process.hrtime.bigint();
                    return [
                        provider.name,
                        {
                            ...result,
                            latency: Number(end - start) / 1_000_000,
                        },
                    ] as const;
                }),
            );

            return Object.fromEntries(results);
        },
    };
}

export type { HealthRegistry } from "./types.js";