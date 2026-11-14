// --- Legacy environment-based configuration API ---

export {
    envBool,
    envList,
    envFile,
    envNumber,
    envString,
    isDevelopment,
    isProduction,
    isTest,
    resolveNodeEnv,
} from "./env.js";

export { loadEnv } from "./load-env.js";
export { createConfig } from "./create-config.js";

export type {
    LoadEnvOptions,
    DotenvConfig,
    ServiceConfig,
    NodeEnv,
    CreateConfigOptions,
    Config,
} from "./types.js";

// --- Configuration Management Engine (generic) ---

export { loadConfig } from "./loader.js";
export { resolveConfig, deepFreeze } from "./resolver.js";
export { applyInterpolation } from "./interpolation.js";
export { zodValidator } from "./zod-validator.js";
export {
    YamlSource,
    createDefaultYamlSources,
    validateEnvironmentName,
    readYamlSync,
} from "./yaml-source.js";
export {
    ConfigSourceError,
    ConfigInterpolationError,
    ConfigValidationError,
    ConfigErrorCode,
} from "./errors.js";

export type {
    ConfigValidator,
    ConfigSource,
    ConfigSourceContext,
    LoadConfigOptions,
    EnvironmentMapping,
    EnvironmentMappingEntry,
} from "./types.js";

// --- Pipeline (interpolate → merge → validate → freeze) ---

export { runPipeline, runPipelineAsync, parseInteger, parseBoolean } from "./pipeline.js";
export type { PipelineInput } from "./types.js";

// --- Simplified facade (recommended for most users) ---

export {
    loadConfigSimple,
    loadConfigSync,
} from "./facade.js";
