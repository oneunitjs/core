# Config — Usage Guide

@oneunit/core v1.0.0

## Overview

The Config feature provides application configuration management with environment variable support, validation, and runtime overrides.

It exposes two layers:

1. **Service Configuration** — `createConfig()` builds a typed `ServiceConfig` object for common service settings (port, host, service name, node environment) with sensible defaults and environment variable fallbacks.
2. **Generic Config Engine** — a validation pipeline (`ConfigValidator`, `ConfigSource`, `runPipeline`, `loadConfigSimple`, `loadConfigSync`, `applyInterpolation`) for loading, merging, validating, and freezing arbitrary typed configuration objects.

## Quick Start

Create a config with defaults:

```ts
import { createConfig } from '@oneunit/core/config';

const config = createConfig();
console.log(config.port);        // 3000
console.log(config.host);        // "localhost"
console.log(config.serviceName); // "app"
console.log(config.nodeEnv);     // "development"
console.log(config.isDevelopment); // true
```

Create a config with custom options:

```ts
const config = createConfig({
  port: 8080,
  host: "0.0.0.0",
  serviceName: "auth-service",
  nodeEnv: "production",
});

console.log(config.port);        // 8080
console.log(config.isProduction); // true
```

Environment variables act as fallbacks when options are not provided. `PORT`, `HOST`, and `SERVICE_NAME` are read from `process.env`. Explicit options take precedence over environment variables.

## Service Configuration (createConfig)

### Signature

```ts
createConfig(options?: ServiceConfigOptions): ServiceConfig
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| port | `number` | `3000` | TCP port the service listens on. Must be 1–65535. Read from `PORT` env var if not provided. |
| host | `string` | `"localhost"` | Hostname or IP the service binds to. Read from `HOST` env var if not provided. |
| serviceName | `string` | `"app"` | Logical name of the service. Read from `SERVICE_NAME` env var if not provided. |
| nodeEnv | `string` | `"development"` | Node environment (`development`, `production`, `test`). Normalized to lowercase. Read from `NODE_ENV` env var if not provided. |

### ServiceConfig Properties

| Property | Type | Description |
|----------|------|-------------|
| port | `number` | Resolved port number. |
| host | `string` | Resolved host. |
| serviceName | `string` | Resolved service name. |
| nodeEnv | `string` | Normalized node environment. |
| isDevelopment | `boolean` | `true` when `nodeEnv` is `"development"`. |
| isProduction | `boolean` | `true` when `nodeEnv` is `"production"`. |
| isTest | `boolean` | `true` when `nodeEnv` is `"test"`. |
| toJSON() | `() => ServiceConfig` | Returns a plain JSON-serializable copy of the config. |

### Examples

```ts
// Defaults only
const dev = createConfig();
// dev.port === 3000
// dev.isDevelopment === true

// From environment
// PORT=5000 HOST=0.0.0.0 SERVICE_NAME=api node app.js
const env = createConfig();
// env.port === 5000
// env.host === "0.0.0.0"
// env.serviceName === "api"

// Explicit options override env vars
// PORT=5000 node app.js
const overridden = createConfig({ port: 8080 });
// overridden.port === 8080

// JSON serialization
const json = config.toJSON();
// json === { port: 3000, host: "localhost", serviceName: "app", nodeEnv: "development" }
```

## Environment Detection

`nodeEnv` is normalized to lowercase via `resolveNodeEnv()`, defaulting to `"development"` when unset or invalid.

### Flags

| Flag | True when |
|------|-----------|
| `isDevelopment` | `nodeEnv === "development"` |
| `isProduction` | `nodeEnv === "production"` |
| `isTest` | `nodeEnv === "test"` |

### Examples

```ts
import { createConfig, isDevelopment, isProduction, isTest, resolveNodeEnv } from '@oneunit/core/config';

const config = createConfig({ nodeEnv: "Production" });
config.nodeEnv;     // "production"
config.isProduction; // true
config.isDevelopment; // false

resolveNodeEnv();            // "development" (when NODE_ENV unset)
resolveNodeEnv("PROD");      // "prod"
resolveNodeEnv("Test");      // "test"

isDevelopment("development"); // true
isProduction("production");   // true
isTest("test");               // true
```

## Environment Variable Helpers

### envString(name, fallback?)

Reads a string environment variable, trims whitespace, and returns the fallback when the value is empty or unset.

```ts
envString("HOST", "localhost");
// "localhost" when HOST is unset
// "0.0.0.0" when HOST=" 0.0.0.0 "
// "localhost" when HOST="   " (empty after trim)
```

### envNumber(name, fallback?)

Reads a numeric environment variable. Returns the fallback when the value is unset, non-finite, or not a valid number.

```ts
envNumber("PORT", 3000);
// 3000 when PORT is unset
// 8080 when PORT="8080"
// 3000 when PORT="not-a-number"
// 3000 when PORT="NaN"
```

### envBool(name, fallback?)

Reads a boolean environment variable (case-insensitive). Truthy: `true`, `1`, `yes`, `on`. Falsy: `false`, `0`, `no`, `off`. Returns the fallback when unset or unrecognized.

```ts
envBool("DEBUG", false);
// false when DEBUG is unset
// true when DEBUG="true", "TRUE", "1", "Yes", "ON"
// false when DEBUG="false", "0", "no", "off"
// false when DEBUG="maybe"
```

### envList(name, fallback?)

Reads a comma-separated list environment variable. Splits on commas, trims each entry, and filters out empty entries. Returns the fallback when unset or empty.

```ts
envList("ALLOWED_ORIGINS", ["*"]);
// ["*"] when ALLOWED_ORIGINS is unset
// ["http://a.com", "http://b.com"] when ALLOWED_ORIGINS="http://a.com, http://b.com"
// ["a", "b"] when ALLOWED_ORIGINS="a,,b,  ,c"
```

### envFile(baseDir, nodeEnv?)

Resolves the path to an environment file: `.env.{nodeEnv}` within `baseDir`. Falls back to `.env` when `nodeEnv` is unset.

```ts
envFile("/app/config", "production");
// "/app/config/.env.production"

envFile("/app/config");
// "/app/config/.env"
```

## Config API (from app.config())

A `Config` instance exposes readonly configuration accessors:

| Method | Signature | Description |
|--------|-----------|-------------|
| get() | `(key: string) => unknown` | Reads a configuration value by key. |
| set() | `(key: string, value: unknown) => void` | Overrides a configuration value at runtime. |
| toJSON() | `() => ServiceConfig` | Returns a plain JSON-serializable snapshot. |

Properties (`port`, `host`, `serviceName`, `nodeEnv`, `isDevelopment`, `isProduction`, `isTest`) are readonly after construction. Use `set()` for runtime overrides.

```ts
const config = createConfig({ port: 3000 });
config.get("port");       // 3000
config.set("port", 8080);
config.get("port");       // 8080
config.toJSON().port;     // 8080
```

## Generic Config Engine (advanced)

The generic engine supports typed configuration loading, validation, and freezing.

### ConfigValidator<T>

```ts
interface ConfigValidator<T> {
  validate(value: unknown): T;
  validateAsync?(value: unknown): Promise<T>;
}
```

`validate()` throws on invalid input. `validateAsync()` is optional and returns a `Promise<T>`.

### ConfigSource

```ts
interface ConfigSource {
  load(): unknown;
}
```

A source provides raw configuration data via `load()`.

### Pipeline

The pipeline runs four stages in order:

1. **interpolate** — replace `${VAR}` and `${VAR:fallback}` placeholders.
2. **merge** — combine multiple sources into one object.
3. **validate** — run the validator against the merged result.
4. **freeze** — `Object.freeze()` the validated object.

### runPipeline / runPipelineAsync

```ts
runPipeline<T>(sources: ConfigSource[], validator: ConfigValidator<T>): T
runPipelineAsync<T>(sources: ConfigSource[], validator: ConfigValidator<T>): Promise<T>
```

### zodValidator(schema)

Creates a `ConfigValidator` from a Zod schema:

```ts
import { z } from 'zod';
import { zodValidator } from '@oneunit/core/config';

const schema = z.object({
  port: z.number().min(1).max(65535).default(3000),
  host: z.string().default("localhost"),
});

const validator = zodValidator(schema);
const config = validator.validate({ port: 8080 });
```

### loadConfigSimple / loadConfigSync

```ts
loadConfigSimple<T>(options: { sources: ConfigSource[]; validator: ConfigValidator<T> }): T
loadConfigSync<T>(options: { sources: ConfigSource[]; validator: ConfigValidator<T> }): T
```

Both load and validate configuration synchronously. `loadConfigSimple` is the convenience entry point; `loadConfigSync` is the explicit synchronous variant.

### applyInterpolation

Replaces `${VAR}` and `${VAR:fallback}` placeholders recursively across nested objects and arrays.

```ts
applyInterpolation({ url: "http://${HOST:localhost}:${PORT}" }, { HOST: "example.com", PORT: "8080" });
// { url: "http://example.com:8080" }
```

## Interpolation Syntax

| Syntax | Behavior | Example |
|--------|----------|---------|
| `${VAR}` | Replaced with the value of environment variable `VAR`. Throws if `VAR` is unset and no fallback. | `${PORT}` → `3000` |
| `${VAR:fallback}` | Replaced with the value of `VAR`, or `fallback` when `VAR` is unset. | `${HOST:localhost}` → `localhost` |

Placeholders are resolved recursively against nested objects and arrays. Interpolation occurs before validation in the pipeline.

```ts
// Input
{ database: { url: "postgres://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME}" } }

// With DB_HOST="db.example.com", DB_NAME="mydb", DB_PORT unset
// Result
{ database: { url: "postgres://db.example.com:5432/mydb" } }
```

## Best Practices

### Do

- Provide sensible defaults for all configuration values.
- Use environment variables for deployment-specific settings (port, host, service name).
- Keep secrets out of configuration files; inject them via environment variables at runtime.
- Call `toJSON()` for logging or debugging configuration state.
- Use the generic engine with a Zod schema for strongly typed, validated configuration.
- Normalize `NODE_ENV` to lowercase before branching on environment flags.

### Don't

- Hardcode production secrets or credentials in source code.
- Rely on `process.env` directly inside business logic; route reads through `envString`, `envNumber`, `envBool`, `envList`.
- Mutate config properties directly after construction; use `set()` for runtime overrides.
- Skip validation when loading configuration from untrusted sources.
- Assume `PORT` is always a valid number; always provide a fallback and validate the range (1–65535).

## Error Handling

| Situation | Behavior |
|-----------|----------|
| `createConfig` with `port` outside 1–65535 | Throws a `RangeError`. |
| `envNumber` with non-numeric value | Returns the fallback (does not throw). |
| `envBool` with unrecognized value | Returns the fallback (does not throw). |
| `envList` with empty or unset variable | Returns the fallback (does not throw). |
| `resolveNodeEnv` with unset/invalid value | Returns `"development"` (does not throw). |
| Interpolation `${VAR}` with `VAR` unset and no fallback | Throws an error indicating the missing variable. |
| `ConfigValidator.validate()` with invalid input | Throws a validation error. |
| `runPipeline` with validation failure | Throws before freezing; no frozen object is produced. |
