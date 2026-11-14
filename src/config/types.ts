// --- Engine types ---

export interface ConfigValidator<T> {
    validate(input: unknown): T;
    validateAsync?(input: unknown): Promise<T>;
}

export interface ConfigSourceContext {
    readonly environment: string;
    readonly configDir?: string;
}

export interface ConfigSource {
    readonly name: string;
    load(context: ConfigSourceContext): Promise<unknown>;
}

export interface EnvironmentMappingEntry {
    readonly path: readonly string[];
    readonly parse?: (value: string) => unknown;
}

export type EnvironmentMapping = Record<string, EnvironmentMappingEntry>;

export interface LoadConfigOptions<T> {
    schema: ConfigValidator<T>;
    sources?: ConfigSource[];
    configDir?: string;
    env?: string;
    defaults?: unknown;
    envOverrides?: unknown;
    cliOverrides?: unknown;
    environment?: Record<string, string | undefined>;
    requireEnvironmentFile?: boolean;
    envMapping?: EnvironmentMapping;
}

export interface PipelineInput<T> {
    schema: ConfigValidator<T>;
    defaults?: unknown;
    envOverrides?: unknown;
    cliOverrides?: unknown;
    environment?: Record<string, string | undefined>;
    envMapping?: EnvironmentMapping;
}

// --- Legacy types (backward compatibility) ---

export interface LoadEnvOptions {
    dir?: string;
    path?: string;
}

export interface DotenvConfig {
    config: (opts: { path: string; override?: boolean }) => { error?: Error } | void;
}

export interface ServiceConfig {
    port: number;
    host: string;
    serviceName: string;
    nodeEnv: string;
    isDevelopment: boolean;
    isProduction: boolean;
    isTest: boolean;
}

export type NodeEnv = "development" | "production" | "test" | string;

export interface CreateConfigOptions {
    port?: number;
    host?: string;
    serviceName?: string;
    nodeEnv?: NodeEnv;
}

export interface Config {
    readonly port: number;
    readonly host: string;
    readonly serviceName: string;
    readonly nodeEnv: string;
    readonly isDevelopment: boolean;
    readonly isProduction: boolean;
    readonly isTest: boolean;
    toJSON(): ServiceConfig;
}
