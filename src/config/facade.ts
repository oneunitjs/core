import path from "node:path";

import type { ConfigValidator, LoadConfigOptions } from "./types.js";
import { runPipeline, runPipelineAsync } from "./pipeline.js";
import {
    ConfigSourceError,
    ConfigInterpolationError,
    ConfigValidationError,
} from "./errors.js";
import { YamlSource, validateEnvironmentName, readYamlSync } from "./yaml-source.js";

/**
 * Simplified async configuration loader. Defaults: ./config and env/NODE_ENV/development.
 */
export async function loadConfigSimple<T>(
    schema: ConfigValidator<T>,
    options: Omit<LoadConfigOptions<T>, "schema"> = {},
): Promise<T> {
    const {
        configDir = path.resolve(process.cwd(), "config"),
        env: envName,
        defaults,
        envOverrides,
        cliOverrides,
        environment = process.env,
        requireEnvironmentFile = false,
        sources,
        envMapping,
    } = options;

    const environmentName = validateEnvironmentName(
        envName ?? environment.NODE_ENV ?? "development",
    );

    const sourceSources = sources?.length
        ? sources
        : [
            new YamlSource("base-file", path.join(configDir, "config.yaml"), false),
            new YamlSource(
                "environment-file",
                path.join(configDir, `config.${environmentName}.yaml`),
                requireEnvironmentFile ?? false,
            ),
        ];
    const values = await Promise.all(
        sourceSources.map((source) =>
            source.load({ environment: environmentName, configDir }),
        ),
    );

    return runPipelineAsync(values, {
        schema,
        defaults,
        envMapping,
        envOverrides,
        cliOverrides,
        environment,
    });
}

/**
 * Synchronous YAML-only loader. Custom async sources and async validators are unsupported.
 */
export function loadConfigSync<T>(
    schema: ConfigValidator<T>,
    options: Omit<LoadConfigOptions<T>, "schema" | "sources"> = {},
): T {
    const {
        configDir = path.resolve(process.cwd(), "config"),
        env: envName = "development",
        defaults,
        envOverrides,
        cliOverrides,
        environment = process.env,
        requireEnvironmentFile = false,
        envMapping,
    } = options;

    const environmentName = validateEnvironmentName(envName);

    const values = [
        readYamlSync(path.join(configDir, "config.yaml"), false),
        readYamlSync(
            path.join(configDir, `config.${environmentName}.yaml`),
            requireEnvironmentFile ?? false,
        ),
    ];

    return runPipeline(values, {
        schema,
        defaults,
        envMapping,
        envOverrides,
        cliOverrides,
        environment,
    });
}

export { zodValidator } from "./zod-validator.js";
export {
    YamlSource,
    validateEnvironmentName,
    ConfigSourceError,
    ConfigInterpolationError,
    ConfigValidationError,
};
export type { ConfigValidator, LoadConfigOptions };
