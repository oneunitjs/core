import { getSystemInfo } from "../lib/system.js";
import { getSystemStatus, type SystemThresholds } from "../lib/system-status.js";
import type { HealthProvider, HealthCheckResult, HealthRegistry } from "./types.js";
import { pingDocker, listDockerContainers, type DockerContainerInfo } from "../lib/docker.js";
import { pingKubernetes, listK8sPods, type K8sPodInfo } from "../lib/kubernetes.js";

export type HealthEnvironment = "system" | "docker" | "kubernetes";

export interface DetectedHealthEnvironment {
    system: boolean;
    docker: boolean;
    kubernetes: boolean;
}

export interface HealthProvidersOptions {
    system?: { critical?: boolean; thresholds?: SystemThresholds };
    docker?: { critical?: boolean; timeoutMs?: number; includeContainers?: boolean };
    kubernetes?: { critical?: boolean; timeoutMs?: number; includePods?: boolean };
    only?: HealthEnvironment[];
}

export function createSystemHealthProvider(options?: {
    critical?: boolean;
    thresholds?: SystemThresholds;
}): HealthProvider {
    return {
        name: "system",
        critical: options?.critical ?? false,
        check: async (): Promise<HealthCheckResult> => {
            const info = getSystemInfo();

            const checks: Record<string, { status: boolean; message?: string }> = {
                memory: {
                    status: info.memory.usagePercent < 90,
                    message: `${info.memory.usagePercent.toFixed(2)}% memory used`,
                },
                cpu: {
                    status: info.cpu.loadAverage.oneMinute < info.cpu.cores,
                    message: `1-minute load average: ${info.cpu.loadAverage.oneMinute}`,
                },
            };

            const metrics = {
                memory: { usagePercent: info.memory.usagePercent },
                cpu: {
                    cores: info.cpu.cores,
                    loadAverage: { oneMinute: info.cpu.loadAverage.oneMinute },
                },
            };

            const status = getSystemStatus(
                metrics as Parameters<typeof getSystemStatus>[0],
                checks as Parameters<typeof getSystemStatus>[1],
                options?.thresholds,
            );

            return {
                status,
                message: `System is ${status}`,
                details: info,
            };
        },
    };
}

export function createDockerHealthProvider(options?: {
    critical?: boolean;
    timeoutMs?: number;
    includeContainers?: boolean;
}): HealthProvider {
    return {
        name: "docker",
        critical: options?.critical ?? false,
        check: async (): Promise<HealthCheckResult> => {
            const result = await pingDocker(options?.timeoutMs);

            const details: Record<string, unknown> = {
                reachable: result.ok,
                source: result.source,
            };

            if (result.version) {
                details.version = result.version;
            }

            if (result.error) {
                details.error = result.error;
            }

            if (result.ok && options?.includeContainers) {
                const containers = await listDockerContainers(options?.timeoutMs);
                details.containers = containers.ok ? containers.containers : { error: containers.error };
            }

            return {
                status: result.ok ? "healthy" : "unhealthy",
                message: result.ok ? `Docker is reachable (${result.source ?? "unknown"})` : `Docker unreachable: ${result.error}`,
                details,
            };
        },
    };
}

export function createKubernetesHealthProvider(options?: {
    critical?: boolean;
    timeoutMs?: number;
    includePods?: boolean;
}): HealthProvider {
    return {
        name: "kubernetes",
        critical: options?.critical ?? false,
        check: async (): Promise<HealthCheckResult> => {
            const result = await pingKubernetes(options?.timeoutMs);

            const details: Record<string, unknown> = {
                reachable: result.ok,
                source: result.source,
            };

            if (result.version) {
                details.version = result.version;
            }

            if (result.context) {
                details.context = result.context;
            }

            if (result.error) {
                details.error = result.error;
            }

            if (result.ok && options?.includePods) {
                const pods = await listK8sPods(options?.timeoutMs);
                details.pods = pods.ok ? pods.pods : { error: pods.error };
            }

            return {
                status: result.ok ? "healthy" : "unhealthy",
                message: result.ok ? `Kubernetes is reachable (${result.source ?? "unknown"})` : `Kubernetes unreachable: ${result.error}`,
                details,
            };
        },
    };
}

export function detectHealthEnvironment(): DetectedHealthEnvironment {
    return {
        system: true,
        docker: false,
        kubernetes: false,
    };
}

export async function detectHealthEnvironmentAsync(
    timeoutMs: number = 2000
): Promise<DetectedHealthEnvironment> {
    const result: DetectedHealthEnvironment = { system: true, docker: false, kubernetes: false };

    const dockerResult = await pingDocker(timeoutMs);
    result.docker = dockerResult.ok;

    const k8sResult = await pingKubernetes(timeoutMs);
    result.kubernetes = k8sResult.ok;

    return result;
}

export function createHealthProviders(options: HealthProvidersOptions = {}): HealthProvider[] {
    return [
        createSystemHealthProvider(options.system),
        createDockerHealthProvider(options.docker),
        createKubernetesHealthProvider(options.kubernetes),
    ];
}

export function createDetectedHealthProviders(options: HealthProvidersOptions = {}): HealthProvider[] {
    const env = detectHealthEnvironment();
    const providers: HealthProvider[] = [];

    const only = options.only;
    const includeSystem = only ? only.includes("system") : true;
    const includeDocker = only ? only.includes("docker") : env.docker;
    const includeKubernetes = only ? only.includes("kubernetes") : env.kubernetes;

    if (includeSystem) {
        providers.push(createSystemHealthProvider(options.system));
    }

    if (includeDocker) {
        providers.push(createDockerHealthProvider(options.docker));
    }

    if (includeKubernetes) {
        providers.push(createKubernetesHealthProvider(options.kubernetes));
    }

    return providers;
}

export function registerHealthProviders(
    registry: HealthRegistry,
    options: HealthProvidersOptions = {}
): HealthProvider[] {
    const providers = createHealthProviders(options);
    for (const provider of providers) {
        registry.register(provider);
    }
    return providers;
}

export function registerDetectedHealthProviders(
    registry: HealthRegistry,
    options: HealthProvidersOptions = {}
): HealthProvider[] {
    const providers = createDetectedHealthProviders(options);
    for (const provider of providers) {
        registry.register(provider);
    }
    return providers;
}

export { pingDocker, listDockerContainers, type DockerContainerInfo } from "../lib/docker.js";
export { pingKubernetes, listK8sPods, type K8sPodInfo } from "../lib/kubernetes.js";
