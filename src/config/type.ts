export interface LoadEnvOptions {
    dir?: string;
    path?: string;
}

export interface DotenvConfig {
    config: (opts: { path: string; override?: boolean }) => void;
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
