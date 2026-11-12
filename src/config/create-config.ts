import {
    resolveNodeEnv,
    isDevelopment,
    isProduction,
    isTest,
    envNumber,
    envString,
} from "./env.js";
import type { CreateConfigOptions, Config, ServiceConfig } from "./type.js";

export function createConfig(options: CreateConfigOptions = {}): Config {
    const environment = resolveNodeEnv(options.nodeEnv);

    const config: Config = {
        port: envNumber("PORT", options.port ?? 3000)!,
        host: envString("HOST", options.host ?? "localhost")!,
        serviceName: envString("SERVICE_NAME", options.serviceName ?? "app")!,
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
