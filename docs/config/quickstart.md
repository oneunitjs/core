# Quickstart — `@oneunit/core` Configuration

Get a validated, typed, immutable configuration record loaded in under 5 minutes.

---

## 1. Install

```bash
npm install @oneunit/core zod yaml
```

---

## 2. Which loader should I use?

| Scenario | Use |
|---|---|
| Most apps (Node.js, async startup) | `loadConfigSimple()` |
| Need custom sources (DB, Vault, etc.) | `loadConfig()` with `sources:` |
| Simple sync startup, no async needed | `loadConfigSync()` |
| Advanced: pre-loaded raw data | `runPipeline()` / `runPipelineAsync()` |

> [!NOTE]
> Each loader has a **different default YAML directory**. See [§ 4. Create configuration files](#4-create-configuration-files) for the full breakdown.

---

## 3. Define your configuration schema

Create a Zod schema that describes your application's configuration shape. This schema is the single source of truth — it defines types, defaults, and validation rules.

```ts
// src/config/schema.ts
import { z } from "zod";
import { zodValidator } from "@oneunit/core/config";

export const AppSchema = z.object({
  app: z.object({
    name: z.string().min(1).default("my-app"),
    port: z.number().int().min(1).max(65535).default(3000),
  }),
  database: z.object({
    url: z.string().min(1),
    pool: z.number().int().min(1).max(100).default(10),
  }),
  logging: z.object({
    level: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  }),
});

export type AppConfig = z.infer<typeof AppSchema>;
export const appValidator = zodValidator(AppSchema);
```

### What this gives you

- **Type safety**: `AppConfig` is inferred from the schema.
- **Defaults**: Missing fields fall back to schema defaults.
- **Validation**: Invalid values (wrong type, out of range, missing required) throw at load time.
- **Immutability**: The loaded configuration record is recursively frozen.

---

## 4. Create configuration files

YAML files live in a directory that varies by loader. The base file is optional; environment-specific files override it (rightmost wins).

### Default YAML directory per loader

| Loader | Default `configDir` |
|---|---|
| `loadConfigSimple()` | `./config/` |
| `loadConfigSync()` | `./config/` |
| `loadConfig()` | `./src/config/yaml/` |

All loaders accept a `configDir` option to override the default:

```ts
await loadConfigSimple(appValidator, { configDir: "./conf" });
await loadConfig({ schema: appValidator, configDir: "./config" });
```

> [!IMPORTANT]
> `loadConfig()` defaults to `src/config/yaml/`, **not** `config/`. If your YAML files live in `config/`, either pass `configDir: "./config"` explicitly or switch to `loadConfigSimple()`.

### Example files

```yaml
# config/config.yaml
app:
  name: my-app
  port: 3000
database:
  url: "${DATABASE_URL}"
  pool: 10
logging:
  level: info
```

```yaml
# config/config.production.yaml
app:
  port: "${APP_PORT:8080}"
logging:
  level: warn
```

### File conventions

| File | Purpose |
|---|---|
| `config.yaml` | Base configuration (optional) |
| `config.development.yaml` | Development overrides (optional) |
| `config.test.yaml` | Test overrides (optional) |
| `config.production.yaml` | Production overrides (optional) |

Environment names must match `/^[a-zA-Z0-9_-]+$/` — a `ConfigSourceError` is thrown otherwise.

---

## 5. Load and consume your configuration

### `loadConfigSimple()` — async, recommended for most apps

```ts
// src/main.ts
import { loadConfigSimple } from "@oneunit/core/config";
import { appValidator } from "./config/schema.js";

const config = await loadConfigSimple(appValidator, {
  env: process.env.NODE_ENV ?? "development",
});

// Fully typed and immutable
console.log(config.app.port);     // number
console.log(config.database.url); // string
console.log(config.logging.level); // "trace" | "debug" | "info" | "warn" | "error"
```

### `loadConfig()` — async, full control

Use when you need a non-default `configDir`, custom sources, or advanced options. Note its default YAML directory is `src/config/yaml/`.

```ts
import { loadConfig } from "@oneunit/core/config";
import { appValidator } from "./config/schema.js";

const config = await loadConfig({
  schema: appValidator,
  env: process.env.NODE_ENV ?? "development",
  configDir: "./config", // override the src/config/yaml default
});
```

### `loadConfigSync()` — synchronous startup

Reads YAML files synchronously. Does **not** support async validators or custom async sources. Its `env` defaults to `"development"` — it does **not** read `NODE_ENV` automatically.

```ts
import { loadConfigSync } from "@oneunit/core/config";
import { appValidator } from "./config/schema.js";

const config = loadConfigSync(appValidator, {
  env: process.env.NODE_ENV ?? "development", // pass explicitly — default is "development"
});
```

> [!WARNING]
> `loadConfigSync()` hardcodes its `env` default to `"development"` and does **not** inspect `NODE_ENV`. Always pass `env` explicitly in production environments.

---

## 6. Map environment variables to config paths (strict typing)

Use `envMapping` to bind environment variables to nested configuration paths with strict type parsers. This is the correct way to get typed values from the environment.

> [!IMPORTANT]
> **`${NAME:fallback}` placeholder interpolation always produces strings.** `${PORT:3000}` resolves to the string `"3000"`, not the number `3000`. The previous guidance that "numeric/boolean fallbacks preserve their primitive type" was incorrect. For typed values, use `envMapping` with `parseInteger` or `parseBoolean`.

```ts
import { loadConfigSimple, parseInteger, parseBoolean } from "@oneunit/core/config";
import { appValidator } from "./config/schema.js";

const config = await loadConfigSimple(appValidator, {
  env: "production",
  envMapping: {
    APP_PORT:         { path: ["app", "port"],          parse: parseInteger },
    FEATURE_ENABLED:  { path: ["features", "enabled"],  parse: parseBoolean },
    DATABASE_URL:     { path: ["database", "url"] },
  },
});

console.log(config.app.port); // 8080 (number, not string "8080")
```

### Available parsers

| Parser | Accepts | Rejects |
|---|---|---|
| `parseInteger(value)` | `"42"`, `"-7"`, `"  100  "` | `"3.14"`, `"abc"`, `""`, out-of-safe-range |
| `parseBoolean(value)` | `"true"`, `"1"`, `"yes"`, `"on"` (case-insensitive) | `"false"`, `"0"`, `"no"`, `"off"`, `"maybe"`, `""` |

> **Heads-up**: Never use JavaScript truthiness for boolean strings. `Boolean("false")` is `true`. `parseBoolean("false")` correctly returns `false`.

---

## 7. Use a custom source

When YAML files are not enough — for example, when secrets live in AWS Secrets Manager or HashiCorp Vault — provide a custom `ConfigSource` via `loadConfig()`. Supplying a non-empty `sources` array replaces the default YAML pair entirely.

```ts
import { loadConfig, zodValidator } from "@oneunit/core/config";
import type { ConfigSource, ConfigSourceContext } from "@oneunit/core/config";
import { appValidator } from "./config/schema.js";

class SecretsManagerSource implements ConfigSource {
  readonly name = "secrets-manager";

  async load(_context: ConfigSourceContext): Promise<unknown> {
    // Fetch from AWS Secrets Manager, Vault, etc.
    return { database: { url: "postgres://..." } };
  }
}

const config = await loadConfig({
  schema: appValidator,
  sources: [new SecretsManagerSource()], // replaces default YAML sources
  env: "production",
});
```

> [!NOTE]
> `loadConfigSimple()` also accepts `sources`. When provided and non-empty, it replaces the default YAML pair there too.

---

## 8. Override configuration at runtime

Override precedence (lowest to highest):

```
consumer defaults
  < config.yaml
  < config.<env>.yaml
  < envMapping
  < envOverrides
  < cliOverrides
  < final schema validation
```

```ts
const config = await loadConfigSimple(appValidator, {
  env: "production",
  envOverrides: { logging: { level: "debug" } },  // beats file values
  cliOverrides: { app: { port: 7000 } },          // beats envOverrides
});
```

`undefined` values do not override earlier values. `null` is an explicit value.

---

## 9. Handle errors safely

All configuration errors extend `OneUnitError` and include a `code` field. Error messages never leak secret values.

```ts
import {
  loadConfigSimple,
  ConfigErrorCode,
  ConfigValidationError,
  ConfigInterpolationError,
} from "@oneunit/core/config";
import { appValidator } from "./config/schema.js";

try {
  const config = await loadConfigSimple(appValidator, {
    env: process.env.NODE_ENV ?? "development",
  });
} catch (err) {
  if (err instanceof ConfigValidationError) {
    // err.code === ConfigErrorCode.CONFIG_VALIDATION_ERROR
    // err.issues contains full Zod issue objects (not stripped)
    // err.message === "Configuration validation failed" (never repeats raw input)
    console.error("Invalid configuration:", err.message, err.issues);
  } else if (err instanceof ConfigInterpolationError) {
    // err.referenceName names the missing environment variable
    console.error("Missing environment variable:", err.referenceName);
  } else {
    console.error("Configuration error:", (err as Error).message);
  }
}
```

### Error codes

| Code | Meaning |
|---|---|
| `CONFIG_SOURCE_ERROR` | YAML file missing, malformed, or unreadable; also thrown for invalid `env` names |
| `CONFIG_INTERPOLATION_ERROR` | Required `${NAME}` placeholder has no value |
| `CONFIG_VALIDATION_ERROR` | Schema validation failed |

---

## 10. Advanced: raw pipeline (`runPipeline` / `runPipelineAsync`)

Use the raw pipeline when you already have config data in memory and want to run it through interpolation, env mapping, merging, validation, and freezing — without any YAML file loading.

```ts
import { runPipelineAsync, zodValidator, parseInteger } from "@oneunit/core/config";
import { AppSchema } from "./config/schema.js";

const rawData = {
  app: { name: "my-app", port: "8080" },
  database: { url: "postgres://localhost/db" },
  logging: { level: "info" },
};

const config = await runPipelineAsync([rawData], {
  schema: zodValidator(AppSchema),
  envMapping: {
    APP_PORT: { path: ["app", "port"], parse: parseInteger },
  },
});
```

> [!NOTE]
> `runPipeline()` (sync) throws if `schema.validate()` returns a Promise. Use `runPipelineAsync()` with async validators.

---

## 11. Legacy API (backward compatibility)

If you're already using `createConfig()`, it continues to work unchanged:

```ts
import { createConfig } from "@oneunit/core/config";

const config = createConfig({
  port: 8080,
  host: "0.0.0.0",
  serviceName: "my-api",
  nodeEnv: "production",
});

config.port;         // 8080
config.isProduction; // true
config.toJSON();     // plain ServiceConfig object
```

Environment helpers remain available: `envString`, `envNumber`, `envBool`, `envList`, `resolveNodeEnv`, `isDevelopment`, `isProduction`, `isTest`, `envFile`, `loadEnv`.

---

## 12. Complete end-to-end example

```ts
// src/config/schema.ts
import { z } from "zod";
import { zodValidator } from "@oneunit/core/config";

export const AppSchema = z.object({
  app: z.object({
    name: z.string().min(1).default("my-app"),
    port: z.number().int().min(1).max(65535).default(3000),
  }),
  database: z.object({
    url: z.string().min(1),
    pool: z.number().int().min(1).max(100).default(10),
  }),
  logging: z.object({
    level: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  }),
});

export type AppConfig = z.infer<typeof AppSchema>;
export const appValidator = zodValidator(AppSchema);
```

```yaml
# config/config.yaml
app:
  name: my-app
  port: 3000
database:
  url: "${DATABASE_URL}"
  pool: 10
logging:
  level: info
```

```yaml
# config/config.production.yaml
app:
  port: "${APP_PORT}"   # interpolation result is a string — envMapping converts to number below
logging:
  level: warn
```

```ts
// src/main.ts
import { loadConfigSimple, parseInteger } from "@oneunit/core/config";
import { appValidator, type AppConfig } from "./config/schema.js";

const config: AppConfig = await loadConfigSimple(appValidator, {
  env: process.env.NODE_ENV ?? "development",
  envMapping: {
    // parseInteger ensures config.app.port is a number, not a string
    APP_PORT:     { path: ["app", "port"],  parse: parseInteger },
    DATABASE_URL: { path: ["database", "url"] },
  },
});

console.log(`Server listening on ${config.app.name}:${config.app.port}`);
console.log(`Database: ${config.database.url}`);
console.log(`Log level: ${config.logging.level}`);

// config is frozen — this throws in strict mode:
// config.app.port = 9999; // TypeError: Cannot assign to read-only property
```

---

## 13. API reference

| Function | Signature | Purpose |
|---|---|---|
| `loadConfigSimple(schema, options?)` | `(schema, options?) => Promise<T>` | Simplified async loader; default dir `./config/` |
| `loadConfig(options)` | `(options: LoadConfigOptions<T>) => Promise<T>` | Full async loader; default dir `./src/config/yaml/` |
| `loadConfigSync(schema, options?)` | `(schema, options?) => T` | Sync YAML loader; default dir `./config/`, default env `"development"` |
| `zodValidator(schema)` | `(schema: ZodType<T>) => ConfigValidator<T>` | Wrap a Zod schema as a config validator |
| `runPipeline(sources, input)` | `(sources, input) => T` | Sync pipeline: interpolate → map → merge → validate → freeze |
| `runPipelineAsync(sources, input)` | `(sources, input) => Promise<T>` | Async pipeline (supports async validators) |
| `parseInteger(value)` | `(value: string) => number` | Strict integer environment parser |
| `parseBoolean(value)` | `(value: string) => boolean` | Strict boolean environment parser |

---

## 14. Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `Required configuration reference is unavailable: X` | `${X}` placeholder has no value and no fallback | Set `X` in environment or add `${X:fallback}` |
| `Configuration validation failed` | Values don't match schema | Check types, ranges, and required fields; inspect `err.issues` for Zod details |
| `Unsafe environment name: X` | `env` option fails `/^[a-zA-Z0-9_-]+$/` | Use alphanumeric, underscore, hyphen only |
| `Required configuration file not found: ...` | `requireEnvironmentFile: true` but file missing | Set to `false` or create the file |
| `Synchronous configuration loading does not support asynchronous validators` | Async-only validator used with `loadConfigSync` | Use `loadConfig()` or add a sync `validate` method to your validator |
| `Expected an integer environment value` | `parseInteger` received a non-numeric string | Check the environment variable value |
| `Expected a boolean environment value` | `parseBoolean` received an unrecognized string | Use `true`/`1`/`yes`/`on` or `false`/`0`/`no`/`off` |
| `loadConfig()` can't find YAML files | Default `configDir` for `loadConfig()` is `src/config/yaml`, not `config/` | Pass `configDir: "./config"` explicitly, or use `loadConfigSimple()` |
| `${PORT:3000}` gives a string, not a number | Placeholder interpolation always produces strings | Use `envMapping: { PORT: { path: ["app", "port"], parse: parseInteger } }` |
| `loadConfigSync` ignores `NODE_ENV` | `loadConfigSync` defaults `env` to `"development"`, not `NODE_ENV` | Pass `env: process.env.NODE_ENV ?? "development"` explicitly |

---

## 15. Security notes

- Never log or serialize the complete configuration object.
- Configuration errors never include secret values.
- Use deployment secret injection (e.g., Kubernetes secrets, AWS Secrets Manager) rather than committing secrets to YAML files.
- The configuration record is frozen — do not attempt to mutate it at runtime.

---

## Next steps

- Read [`docs/config/ARCHITECTURE.md`](./ARCHITECTURE.md) for the full architecture and data flow.
- See the test suite in `test/config/` for usage patterns and edge cases.
- Run `npm run typecheck`, `npm run lint`, and `npm test` to verify your integration.
