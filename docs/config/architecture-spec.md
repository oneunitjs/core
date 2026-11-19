# Config — Architecture Specification

@oneunit/core v1.0.0

## Component Overview

**Purpose:** The Config feature provides a type-safe, immutable configuration engine for the @oneunit/core package. It reads configuration from environment variables, YAML sources, and explicit options, then resolves, interpolates, validates, and freezes a configuration object for application consumption.

**Scope:** Covers the full lifecycle of configuration from source ingestion through frozen output. Includes environment variable parsing (string, number, boolean, list), YAML file loading, variable interpolation (${VAR} and ${VAR:fallback}), schema validation (Zod), pipeline orchestration (synchronous and asynchronous), immutability enforcement via deep freezing, and facade wrappers for simplified synchronous/async loading.

**Responsibilities:**
- Factory creation of typed Config objects via `createConfig()`
- Environment variable resolution with precedence: explicit option > env var > default
- Loading configuration from multiple sources (process.env, YAML files)
- String interpolation of ${VAR} and ${VAR:fallback} placeholders
- Schema validation using Zod (sync and async variants)
- Pipeline orchestration: interpolate → merge → validate → deepFreeze
- Immutable output via recursive object freezing
- Prototype pollution protection for env var path mappings
- Error handling with typed error codes

## Source File Map

| File path | Responsibility | Key exports |
|-----------|---------------|-------------|
| `src/config/create-config.ts` | createConfig() factory: resolves nodeEnv, port, host, serviceName, env flags; builds frozen Config object | `createConfig`, `CreateConfigOptions` |
| `src/config/env.ts` | Environment variable parsing functions: string, number, boolean, list, nodeEnv, type guards, dotenv loading | `envString`, `envNumber`, `envBool`, `envList`, `resolveNodeEnv`, `isDevelopment`, `isProduction`, `isTest`, `envFile` |
| `src/config/types.ts` | TypeScript interfaces and type definitions for the config engine | `ConfigValidator`, `ConfigSource`, `CreateConfigOptions`, `Config`, `ServiceConfig` |
| `src/config/index.ts` | Barrel module re-exporting all config feature public API | All config module exports |
| `src/config/loader.ts` | Configuration source loading orchestration | `loadConfig` |
| `src/config/resolver.ts` | Pipeline resolution: resolveConfig, deepFreeze immutability enforcement | `resolveConfig`, `deepFreeze` |
| `src/config/interpolation.ts` | Variable interpolation: ${VAR} and ${VAR:fallback} replacement in strings and nested structures | `applyInterpolation` |
| `src/config/pipeline.ts` | Pipeline execution: sync/async pipeline runs, integer/boolean parsing, env override building | `runPipeline`, `runPipelineAsync`, `parseInteger`, `parseBoolean`, `buildEnvironmentOverrides` |
| `src/config/zod-validator.ts` | Zod schema validator adapter implementing ConfigValidator | `zodValidator` |
| `src/config/facade.ts` | Simplified loading facades: sync and async convenience wrappers | `loadConfigSimple`, `loadConfigSync` |
| `src/config/load-env.ts` | Dotenv file loading into process.env | `loadEnv` |
| `src/config/yaml-source.ts` | YAML file source implementation: reading, parsing, environment name validation | `YamlSource`, `validateEnvironmentName`, `readYamlSync` |
| `src/config/errors.ts` | Error classes and error code constants for the config feature | `ConfigSourceError`, `ConfigInterpolationError`, `ConfigValidationError`, `ConfigErrorCode` |

## Component Relationships Diagram (Mermaid)

```mermaid
flowchart TD
    classDef source fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef process fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef output fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef util fill:#f3e5f5,stroke:#4a148c,stroke-width:2px

    subgraph Sources
        ENV[process.env]
        YAML[YamlSource]
    end

    subgraph Pipeline
        INTER[applyInterpolation]
        MERGE[Merge sources]
        VALIDATE[ConfigValidator]
        FREEZE[deepFreeze]
    end

    subgraph Output
        CONFIG[Config object]
        TOJSON[toJSON() → ServiceConfig]
    end

    ENV --> INTER
    YAML --> INTER
    INTER --> MERGE
    MERGE --> VALIDATE
    VALIDATE --> FREEZE
    FREEZE --> CONFIG
    CONFIG --> TOJSON

    class ENV,YAML source
    class INTER,MERGE,VALIDATE,FREEZE process
    class CONFIG,TOJSON output
```

## Data Flow Diagrams (Mermaid)

### Diagram 1: createConfig() flow

```mermaid
flowchart TD
    classDef input fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef process fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef output fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px

    OPTIONS[createConfig(options)]
    NODEENV[resolveNodeEnv(options.nodeEnv)]
    PORT[envNumber PORT = options.port ?? env PORT ?? 3000]
    HOST[envString HOST = options.host ?? env HOST ?? localhost]
    SERVICE[envString SERVICE_NAME = options.serviceName ?? env SERVICE_NAME ?? app]
    FLAGS[isDevelopment/isProduction/isTest flags]
    CONFIG[Config object: readonly getters + toJSON()]

    OPTIONS --> NODEENV
    OPTIONS --> PORT
    OPTIONS --> HOST
    OPTIONS --> SERVICE
    NODEENV --> FLAGS
    PORT --> CONFIG
    HOST --> CONFIG
    SERVICE --> CONFIG
    FLAGS --> CONFIG

    class OPTIONS input
    class NODEENV,PORT,HOST,SERVICE,FLAGS process
    class CONFIG output
```

### Diagram 2: Pipeline flow

```mermaid
flowchart TD
    classDef stage fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef output fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px

    SOURCES[ConfigSource[] load()]
    INTERPOLATE[applyInterpolation to each source]
    MERGE[Deep merge sources into one object]
    VALIDATE{ConfigValidator.validate}
    VALIDATE_OK[Validation passed]
    VALIDATE_FAIL[ConfigValidationError thrown]
    FREEZE[deepFreeze recursive]
    OUTPUT[Frozen Config object]

    SOURCES --> INTERPOLATE
    INTERPOLATE --> MERGE
    MERGE --> VALIDATE
    VALIDATE -->|pass| VALIDATE_OK
    VALIDATE -->|fail| VALIDATE_FAIL
    VALIDATE_OK --> FREEZE
    FREEZE --> OUTPUT

    class SOURCES,INTERPOLATE,MERGE,VALIDATE_OK,FREEZE,OUTPUT stage
    class VALIDATE,VALIDATE_FAIL decision
    class OUTPUT output
```

### Diagram 3: applyInterpolation flow

```mermaid
flowchart TD
    classDef input fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef process fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef output fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px

    INPUT[Input: string, object, or array]
    TYPE{Type check}
    STRING[String: replace \${VAR} and \${VAR:fallback}]
    OBJECT[Object: recurse into values]
    ARRAY[Array: recurse into elements]
    PRIMITIVE[Primitive: return as-is]
    OUTPUT[Output: interpolated value]

    INPUT --> TYPE
    TYPE -->|string| STRING
    TYPE -->|object| OBJECT
    TYPE -->|array| ARRAY
    TYPE -->|primitive| PRIMITIVE
    STRING --> OUTPUT
    OBJECT --> OUTPUT
    ARRAY --> OUTPUT
    PRIMITIVE --> OUTPUT

    class INPUT input
    class TYPE,STRING,OBJECT,ARRAY,PRIMITIVE process
    class OUTPUT output
```

## Internal State Model

**Config object:**
- `port: number` — getter, resolved from `options.port` > `env PORT` > `3000`
- `host: string` — getter, resolved from `options.host` > `env HOST` > `"localhost"`
- `serviceName: string` — getter, resolved from `options.serviceName` > `env SERVICE_NAME` > `"app"`
- `nodeEnv: string` — getter, resolved from `resolveNodeEnv(options.nodeEnv)`
- `isDevelopment: boolean` — getter, `nodeEnv === "development"`
- `isProduction: boolean` — getter, `nodeEnv === "production"`
- `isTest: boolean` — getter, `nodeEnv === "test"`
- `toJSON(): ServiceConfig` — returns a plain, unfrozen `ServiceConfig` object with all properties

**ServiceConfig interface:**
```typescript
interface ServiceConfig {
  port: number;
  host: string;
  serviceName: string;
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
}
```

**Environment variables:** Read exclusively from `process.env` at creation time. No runtime re-reading occurs after the Config object is constructed.

**Immutability:** The Config object is deeply frozen via `deepFreeze()` after validation. All properties are exposed through getters on a frozen object; mutation attempts throw in strict mode or silently fail in sloppy mode.

## Design Patterns

**Factory Pattern:** `createConfig()` — encapsulates object construction logic, resolves defaults and environment fallbacks, returns a fully initialized and frozen Config instance.

**Pipeline Pattern:** `runPipeline()` / `runPipelineAsync()` — sequential stages: interpolate sources → merge → validate → deepFreeze. Each stage transforms the configuration before passing it to the next.

**Strategy Pattern:** `ConfigValidator<T>` — defines `validate(input: unknown): T` with optional `validateAsync`. `zodValidator` is a concrete strategy wrapping Zod schemas. Consumers can supply custom validators.

**Builder Pattern:** `loadConfigSimple()` and `loadConfigSync()` — facade builders that configure sources, run the pipeline, and return the final config with minimal caller setup.

## Technical Implementation Details

**Port range validation:** Valid ports are integers in the range 1–65535. Port 0 and values above 65535 are invalid. Non-numeric or non-finite values fall back to the default (3000).

**Environment variable precedence:** Explicit option > environment variable > hardcoded default. Implemented as `options.port ?? envNumber("PORT") ?? 3000`.

**Case-insensitive env bool matching:** `envBool` recognizes `true`, `1`, `yes`, `on` (case-insensitive) as `true`; `false`, `0`, `no`, `off` (case-insensitive) as `false`; any other value returns the fallback.

**Empty/whitespace env string treatment:** `envString` trims whitespace; empty or whitespace-only values are treated as unset and fall back to the provided fallback.

**Prototype pollution guards:** `buildEnvironmentOverrides` rejects path segments equal to `"__proto__"` and empty path segments to prevent prototype pollution via environment variable mappings.

**deepFreeze:** Recursively calls `Object.freeze()` on the target and all enumerable own properties that are objects. Prevents post-creation mutation of the configuration.

**Interpolation:** `applyInterpolation` replaces `${VAR}` with `process.env[VAR]` and `${VAR:fallback}` with `process.env[VAR]` or the fallback if unset. Traverses nested objects and arrays. Does not recursively interpolate env values themselves (env values are substituted once).

**buildEnvironmentOverrides:** Maps environment variable names to dot-separated config paths. Supports optional parse functions per mapping (e.g., parseInteger, parseBoolean).

## Concurrency Considerations

**Immutability after creation:** Config objects are deeply frozen by the pipeline before being returned. Once created, no property can be added, removed, or modified. This makes Config instances safe to share across threads, modules, and async boundaries without defensive copying.

**Environment variables read at creation time only:** `process.env` is accessed synchronously during `createConfig()` or pipeline execution. Subsequent changes to `process.env` do not affect an already-created Config object. This eliminates race conditions where configuration could change mid-request.

**Sync vs async pipelines:** `runPipeline` executes synchronously and rejects if any validator is async. `runPipelineAsync` supports async validators and awaits them before freezing. Callers must choose the appropriate variant based on validator synchronicity.

## Error Model

| Error | Condition | Error code |
|-------|-----------|------------|
| Invalid port | Port outside 1–65535, or non-finite numeric | `ConfigErrorCode.INVALID_PORT` |
| Async validator in sync pipeline | `runPipeline` invoked with an async `validateAsync` validator | `ConfigErrorCode.ASYNC_VALIDATOR_IN_SYNC_PIPELINE` |
| Empty envMapping path | `buildEnvironmentOverrides` receives an empty path segment | `ConfigErrorCode.EMPTY_ENV_MAPPING_PATH` |
| Prototype pollution path | Path segment equals `"__proto__"` in envMapping | `ConfigErrorCode.PROTOTYPE_POLLUTION_PATH` |
| Missing interpolation variable | `${VAR}` referenced but `process.env[VAR]` is undefined and no fallback provided | `ConfigErrorCode.MISSING_INTERPOLATION_VARIABLE` |
| Interpolation error | Malformed interpolation syntax or unresolvable reference | `ConfigErrorCode.INTERPOLATION_ERROR` |

**Secret value protection:** Interpolation errors never include the unresolved env value in error messages. Error messages reference only the variable name, never its value, preventing accidental secret leakage through logs or stack traces.

**Error classes:**
- `ConfigErrorCode` — enum of all config error codes
- `ConfigSourceError` — source loading failures (YAML parse, file read, missing file)
- `ConfigInterpolationError` — interpolation failures (missing variables, malformed syntax)
- `ConfigValidationError` — schema validation failures
- `ConfigError` — base error class carrying a `ConfigErrorCode`

## Complexity Analysis

| Operation | Time complexity | Space complexity | Notes |
|-----------|----------------|------------------|-------|
| `envString` | O(n) where n = env value length | O(n) for trimmed copy | Single pass trim |
| `envNumber` | O(n) | O(1) | parseFloat + isFinite check |
| `envBool` | O(n) | O(1) | Case-insensitive string compare |
| `envList` | O(n) where n = string length | O(k) where k = items | Split + trim + filter |
| `resolveNodeEnv` | O(1) | O(1) | Direct env read |
| `applyInterpolation` (string) | O(m × v) where m = string length, v = vars | O(m) | Single pass regex replace |
| `applyInterpolation` (object/array) | O(m × v) where m = total leaf nodes | O(m) | Recursive traversal |
| Deep merge | O(n) where n = total properties | O(n) | Recursive merge, new object allocation |
| `zodValidator.validate` | O(s) where s = schema size | O(s) | Zod schema execution |
| `deepFreeze` | O(n) where n = total object nodes | O(d) where d = max depth | Recursive freeze, call stack depth |
| `runPipeline` | O(sources + merge + validate + freeze) | O(merged) | Linear pipeline stages |
| `createConfig` | O(1) | O(1) | Fixed number of env reads |
