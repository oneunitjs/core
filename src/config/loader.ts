import path from "node:path";

import type { LoadConfigOptions } from "./types.js";
import { runPipelineAsync } from "./pipeline.js";
import { createDefaultYamlSources, validateEnvironmentName } from "./yaml-source.js";

export async function loadConfig<T>(
    options: LoadConfigOptions<T>,
): Promise<T> {
    const {
        schema,
        configDir,
        env: envName,
        defaults,
        envOverrides,
        cliOverrides,
        environment = process.env,
        requireEnvironmentFile = false,
        envMapping,
    } = options;

    const environmentName = validateEnvironmentName(
        envName ?? environment.NODE_ENV ?? "development",
    );

    // Determine sources: explicit sources take priority over default YAML.
    const sources =
        options.sources && options.sources.length > 0
            ? options.sources
            : createDefaultYamlSources(
                configDir ?? path.resolve(process.cwd(), "src/config/yaml"),
                environmentName,
                requireEnvironmentFile,
            );

    // Promise.all preserves input order, which is the precedence order.
    const loadedSources = await Promise.all(
        sources.map((source) =>
            source.load({
                environment: environmentName,
                configDir,
            }),
        ),
    );

    return runPipelineAsync(loadedSources, {
        schema,
        defaults,
        envOverrides,
        cliOverrides,
        environment,
        envMapping,
    });
}
