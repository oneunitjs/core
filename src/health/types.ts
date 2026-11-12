export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthReply {
    status(statusCode: number): HealthReply;
    send(body: unknown): void;
}

export interface HealthServer {
    get(path: string, handler: (request: unknown, reply: HealthReply) => void | Promise<void>): void;
    decorate(name: string, value: unknown): void;
}

export interface HealthCheckResult {
    status: HealthStatus;
    latency?: number;
    message?: string;
    details?: object;
}

export type HealthCheck = () => HealthCheckResult | Promise<HealthCheckResult>;

export interface HealthProvider {
    name: string;
    check: HealthCheck;
    critical?: boolean;
}

export interface HealthRegistry {
    register(provider: HealthProvider): void;
    unregister(name: string): void;
    getAll(): HealthProvider[];
    checkAll(): Promise<Record<string, HealthCheckResult>>;
}

export interface HealthRouteOptions {
    path?: string;
    serviceName?: string;
    includeDetails?: boolean;
}
