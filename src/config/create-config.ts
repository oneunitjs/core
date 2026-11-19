import {
    resolveNodeEnv,
    isDevelopment,
    isProduction,
    isTest,
    envNumber,
    envString,
} from "./env.js";
import type { CreateConfigOptions, Config, ServiceConfig } from "./types.js";

export function createConfig(options: CreateConfigOptions = {}): Config {
    const environment = resolveNodeEnv(options.nodeEnv);

    const port = options.port ?? envNumber("PORT") ?? 3000;
    if (port < 1 || port > 65535) {
        throw new Error(`Invalid port: ${port}. Port must be between 1 and 65535.`);
    }

    const config: Config = {
        port,
        host: options.host ?? envString("HOST") ?? "localhost",
        serviceName: options.serviceName ?? envString("SERVICE_NAME") ?? "app",
        nodeEnv: environment,
        isDevelopment: isDevelopment(environment),
        isProduction: isProduction(environment),
        isTest: isTest(environment),
        toJSON(): ServiceConfig {
            return {
                port: this.port,
                host: this.host,
                serviceName: this.serviceName,
                nodeEnv: this.nodeEnv,
                isDevelopment: this.isDevelopment,
                isProduction: this.isProduction,
                isTest: this.isTest,
            };
        },
    };

    return config;
}
