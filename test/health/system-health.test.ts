import { describe, it, expect } from "vitest";
import {
    createSystemHealthProvider,
    createDockerHealthProvider,
    createKubernetesHealthProvider,
    createHealthProviders,
    registerHealthProviders,
    createDetectedHealthProviders,
    registerDetectedHealthProviders,
    detectHealthEnvironment,
    detectHealthEnvironmentAsync,
    type DetectedHealthEnvironment,
} from "../../src/health/system-health.js";

describe("system health providers", () => {
    describe("createSystemHealthProvider", () => {
        it("returns a health check result with real system metrics", async () => {
            const provider = createSystemHealthProvider();
            const result = await provider.check();

            expect(["healthy", "degraded", "unhealthy"]).toContain(result.status);
            expect(result.message).toContain("System is");
            expect(result.details).toBeDefined();
            expect((result.details as any).process.pid).toBeDefined();
            expect((result.details as any).memory.usagePercent).toBeGreaterThanOrEqual(0);
            expect((result.details as any).cpu.cores).toBeGreaterThan(0);
        });

        it("supports critical flag", () => {
            const provider = createSystemHealthProvider({ critical: true });
            expect(provider.critical).toBe(true);

            const provider2 = createSystemHealthProvider();
            expect(provider2.critical).toBe(false);
        });

        it("supports custom thresholds", () => {
            const provider = createSystemHealthProvider({
                thresholds: { memory: { degraded: 50, unhealthy: 80 } },
            });
            expect(provider).toBeDefined();
        });
    });

    describe("createDockerHealthProvider", () => {
        it("returns a provider with correct name", () => {
            const provider = createDockerHealthProvider();
            expect(provider.name).toBe("docker");
            expect(provider.critical).toBe(false);
        });

        it("supports critical flag", () => {
            const provider = createDockerHealthProvider({ critical: true });
            expect(provider.critical).toBe(true);
        });

        it("supports custom timeout", () => {
            const provider = createDockerHealthProvider({ timeoutMs: 1000 });
            expect(provider).toBeDefined();
        });

        it("returns a health check result", async () => {
            const provider = createDockerHealthProvider({ timeoutMs: 1000 });
            const result = await provider.check();

            expect(["healthy", "unhealthy"]).toContain(result.status);
            expect(result.message).toBeDefined();
            expect(result.details).toBeDefined();
            expect((result.details as any).reachable).toBeDefined();
        });
    });

    describe("createKubernetesHealthProvider", () => {
        it("returns a provider with correct name", () => {
            const provider = createKubernetesHealthProvider();
            expect(provider.name).toBe("kubernetes");
            expect(provider.critical).toBe(false);
        });

        it("supports critical flag", () => {
            const provider = createKubernetesHealthProvider({ critical: true });
            expect(provider.critical).toBe(true);
        });

        it("returns a health check result", async () => {
            const provider = createKubernetesHealthProvider({ timeoutMs: 1000 });
            const result = await provider.check();

            expect(["healthy", "unhealthy"]).toContain(result.status);
            expect(result.message).toBeDefined();
            expect(result.details).toBeDefined();
            expect((result.details as any).reachable).toBeDefined();
        });
    });

    describe("detectHealthEnvironment", () => {
        it("returns system always detected", () => {
            const env = detectHealthEnvironment();
            expect(env.system).toBe(true);
            expect(typeof env.docker).toBe("boolean");
            expect(typeof env.kubernetes).toBe("boolean");
        });

        it("returns valid DetectedHealthEnvironment type", () => {
            const env: DetectedHealthEnvironment = {
                system: true,
                docker: false,
                kubernetes: false,
            };
            expect(env.system).toBe(true);
        });
    });

    describe("detectHealthEnvironmentAsync", () => {
        it("detects environment asynchronously", async () => {
            const env = await detectHealthEnvironmentAsync(1000);
            expect(env.system).toBe(true);
            expect(typeof env.docker).toBe("boolean");
            expect(typeof env.kubernetes).toBe("boolean");
        });
    });

    describe("createHealthProviders (all providers)", () => {
        it("creates all 3 providers in one call", () => {
            const providers = createHealthProviders();
            expect(providers).toHaveLength(3);
            expect(providers.map((p) => p.name)).toEqual(["system", "docker", "kubernetes"]);
        });

        it("supports per-provider options", () => {
            const providers = createHealthProviders({
                system: { critical: true },
                docker: { critical: false, timeoutMs: 1000 },
                kubernetes: { critical: false, timeoutMs: 1000 },
            });
            expect(providers[0].critical).toBe(true);
            expect(providers[1].critical).toBe(false);
            expect(providers[2].critical).toBe(false);
        });

        it("all providers return valid health check results", async () => {
            const providers = createHealthProviders({
                system: {},
                docker: { timeoutMs: 1000 },
                kubernetes: { timeoutMs: 1000 },
            });

            const results = await Promise.all(providers.map((p) => p.check()));
            for (const result of results) {
                expect(["healthy", "degraded", "unhealthy"]).toContain(result.status);
                expect(result.message).toBeDefined();
                expect(result.details).toBeDefined();
            }
        });
    });

    describe("registerHealthProviders (one-liner DX)", () => {
        it("registers all providers to a registry in one call", async () => {
            const { createHealthRegistry } = await import("../../src/health/registry.js");
            const registry = createHealthRegistry();

            const providers = registerHealthProviders(registry, {
                system: { critical: true },
                docker: { critical: false, timeoutMs: 1000 },
                kubernetes: { critical: false, timeoutMs: 1000 },
            });

            expect(providers).toHaveLength(3);
            expect(registry.getAll()).toHaveLength(3);

            const results = await registry.checkAll();
            expect(results.system).toBeDefined();
            expect(results.docker).toBeDefined();
            expect(results.kubernetes).toBeDefined();

            for (const [name, result] of Object.entries(results)) {
                expect(["healthy", "degraded", "unhealthy"]).toContain(result.status);
            }
        }, 20000);
    });

    describe("createDetectedHealthProviders (detected DX)", () => {
        it("creates at least system provider by default", () => {
            const providers = createDetectedHealthProviders();
            expect(providers.length).toBeGreaterThanOrEqual(1);
            expect(providers.some((p) => p.name === "system")).toBe(true);
        });

        it("only creates detected providers", () => {
            const providers = createDetectedHealthProviders({
                only: ["system"],
            });
            expect(providers).toHaveLength(1);
            expect(providers[0].name).toBe("system");
        });

        it("supports per-provider options", () => {
            const providers = createDetectedHealthProviders({
                only: ["system", "docker"],
                system: { critical: true },
                docker: { timeoutMs: 1000 },
            });
            expect(providers[0].critical).toBe(true);
            expect(providers[0].name).toBe("system");
        });

        it("all providers return valid health check results", async () => {
            const providers = createDetectedHealthProviders({
                only: ["system"],
                system: {},
            });

            const results = await Promise.all(providers.map((p) => p.check()));
            for (const result of results) {
                expect(["healthy", "degraded", "unhealthy"]).toContain(result.status);
                expect(result.message).toBeDefined();
                expect(result.details).toBeDefined();
            }
        });
    });

    describe("registerDetectedHealthProviders (one-liner detected DX)", () => {
        it("registers detected providers to a registry in one call", async () => {
            const { createHealthRegistry } = await import("../../src/health/registry.js");
            const registry = createHealthRegistry();

            const providers = registerDetectedHealthProviders(registry, {
                only: ["system"],
                system: { critical: true },
            });

            expect(providers.length).toBeGreaterThanOrEqual(1);
            expect(registry.getAll()).toHaveLength(providers.length);

            const results = await registry.checkAll();
            expect(results.system).toBeDefined();

            for (const [name, result] of Object.entries(results)) {
                expect(["healthy", "degraded", "unhealthy"]).toContain(result.status);
            }
        }, 20000);
    });
});
