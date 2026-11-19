# Feature-Level Documentation — Part 1

**Package:** `@oneunit/core`  
**Version:** `1.0.0`  
**Scope:** Core, Config, Cookie, Security  
**Status:** Production-ready

This document is Part 1 of the comprehensive technical documentation suite for `@oneunit/core`. It provides feature-level reference for four components: Core, Config, Cookie, and Security. Each feature includes a functional description, API reference, and implementation examples.

Each feature section follows this structure:

- **Functional Description** — purpose, business logic, operational workflow
- **API Reference** — signatures, parameters (mandatory/optional, types, defaults), return values, error codes
- **Implementation Examples** — basic, advanced, cross-framework

---

## 1. Core

The Core component is the application bootstrap layer. It exposes `createApp`, a factory that assembles and caches all sub-system API instances behind a single `App` interface. All cached API instances return the same reference on repeated calls. The only exceptions are `cookies(req, res)` and `response(req, res)`, which create per-request instances bound to the incoming request/response pair.

### 1.1 `createApp` Factory Function

**File:** `src/core.ts`

#### Functional Description

`createApp` is the primary application factory. It accepts an optional `AppOptions` object and returns an `App` interface whose methods return cached API singletons. The lifecycle manager is initialized automatically in `"advanced"` mode by default. Per-call options shallow-merge over global defaults, allowing runtime overrides without mutating the original options object.

#### API Reference

**Signature:**
```ts
function createApp(options?: AppOptions): App
```

**`AppOptions`:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `serviceName` | `string` | no | `"app"` | Logical service identifier |
| `port` | `number` | no | `3000` | TCP port the service listens on |
| `host` | `string` | no | `"localhost"` | Bind address |
| `nodeEnv` | `string` | no | `"development"` | Environment mode |
| `secret` | `string` | no | `undefined` | Signing/encryption secret |
| `framework` | `"express" \| "fastify" \| "koa" \| "http"` | no | `undefined` | Declared web framework |
| `security` | `SecurityDefaults` | no | `{}` | Security module configuration |
| `cookie` | `CookieConfig` | no | `{}` | Cookie module configuration |
| `multipart` | `MultipartOptions` | no | `{}` | Multipart module configuration |
| `health` | `{ path?: string }` | no | `{}` | Health module configuration |
| `lifecycle` | `LifecycleOptions` | no | `{ mode: "advanced" }` | Lifecycle module configuration |

**Returns:** `App` interface.

**App methods:**
| Method | Returns | Cached? | Description |
|--------|---------|---------|-------------|
| `health()` | `HealthAPI` | yes | Health checks and registration |
| `hooks()` | `HooksAPI` | yes | Event hook registry |
| `config()` | `ConfigAPI` | yes | Service configuration |
| `cookies(_req?, _res?)` | `CookieStoreAPI` | no | Cached store when no args; per-request detected store when req/res provided |
| `security()` | `SecurityAPI` | yes | Security middleware factories |
| `msgpack()` | `MsgPackAPI` | yes | MessagePack encode/decode |
| `multipart()` | `MultipartAPI` | yes | Multipart form handling |
| `lifecycle()` | `LifecycleAPI` | yes | Lifecycle management |
| `createLifecycle(_options?)` | `LifecycleAPI` | no | Isolated lifecycle instance |
| `response(_req?, _res?)` | `ResponseAPI` | no | Per-request response helpers |
| `lib()` | `LibAPI` | yes | Utility library |
| `use(_middleware)` | `App` | yes | Chainable middleware registration |

**HealthAPI methods:**
| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `register(name, check, critical?)` | `name: string`, `check: () => HealthResult`, `critical?: boolean` | `void` | Register a named health check |
| `check()` | none | `Promise<Record<string, HealthCheckResult>>` | Run all registered checks |
| `route(server)` | `server: HealthServer` | `Promise<void>` | Mount health route on framework server |
| `registerSystem(options?)` | `{ critical?, thresholds? }` | `void` | Register system health provider |
| `registerDocker(options?)` | `{ critical?, timeoutMs?, includeContainers? }` | `void` | Register Docker health provider |
| `registerKubernetes(options?)` | `{ critical?, timeoutMs?, includePods? }` | `void` | Register Kubernetes health provider |
| `detectEnvironment()` | none | `DetectedHealthEnvironment` | Detect runtime environment |

**HooksAPI methods:**
| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `on(name, listener)` | `name: string`, `listener: (context) => void \| Promise<void>` | `HooksAPI` | Register a listener (chainable) |
| `use(name, listener)` | `name: string`, `listener: (context) => void \| Promise<void>` | `HooksAPI` | Alias for `on` |
| `off(name, listener)` | `name: string`, `listener: (context) => void \| Promise<void>` | `HooksAPI` | Remove a specific listener |
| `once(name, listener)` | `name: string`, `listener: (context) => void \| Promise<void>` | `HooksAPI` | One-time listener (auto-removed) |
| `emit(name, context)` | `name: string`, `context: unknown` | `Promise<void>` | Async emit (sequential) |
| `emitSync(name, context)` | `name: string`, `context: unknown` | `void` | Sync emit (sequential) |
| `has(name)` | `name: string` | `boolean` | Whether event has listeners |
| `listeners(name)` | `name: string` | `HookListener[]` | Listeners for event |
| `listenerCount(name)` | `name: string` | `number` | Listener count for event |
| `clear()` | none | `HooksAPI` | Remove all listeners |
| `clearHook(name)` | `name: string` | `HooksAPI` | Remove listeners for event |
| `toJSON()` | none | `Record<string, number>` | Event → listener count map |

**ConfigAPI methods:**
| Member | Type | Description |
|--------|------|-------------|
| `port` | `number` (getter) | Validated port |
| `host` | `string` (getter) | Bind host |
| `serviceName` | `string` (getter) | Service name |
| `nodeEnv` | `string` (getter) | Normalized environment |
| `isDevelopment` | `boolean` (getter) | `nodeEnv === 'development'` |
| `isProduction` | `boolean` (getter) | `nodeEnv === 'production'` |
| `isTest` | `boolean` (getter) | `nodeEnv === 'test'` |
| `toJSON()` | `ServiceConfig` | Plain config object |
| `set(key, value)` | `void` | Set a config value (throws on unknown key) |
| `get(key)` | `unknown` | Get a config value (throws on unknown key) |

**CookieStoreAPI methods:**
| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `get(name)` | `(name: string)` | `string \| undefined` | Read a cookie value |
| `set(name, value, options?)` | `(name: string, value: string, options?: CookieOptions)` | `CookieStoreAPI` | Set a cookie (chainable) |
| `delete(name, options?)` | `(name: string, options?: { path?, domain? })` | `CookieStoreAPI` | Delete a cookie (chainable) |
| `has(name)` | `(name: string)` | `boolean` | Existence check |
| `all()` | `()` | `Record<string, string>` | All cookies |
| `clear()` | `()` | `CookieStoreAPI` | Clear all (chainable) |
| `setSigned(name, value, options?)` | `(name: string, value: string, options?: CookieOptions)` | `CookieStoreAPI` | HMAC-SHA256 signed cookie (chainable) |
| `setEncrypted(name, value, options?)` | `(name: string, value: string, options?: CookieOptions)` | `CookieStoreAPI` | AES-256-GCM encrypted cookie (chainable) |
| `getSigned(name)` | `(name: string)` | `string \| undefined` | Verify signature; fallback secrets |
| `getEncrypted(name)` | `(name: string)` | `string \| null` | Decrypt; fallback secrets |
| `serialize(name, value, options?)` | `(name: string, value: string, options?: CookieOptions)` | `string` | Set-Cookie header value |
| `parse(cookieHeader)` | `(cookieHeader: string)` | `Record<string, string>` | Parse Cookie header |
| `createStore(name, config?)` | `(name: string, config?: CookieConfig)` | `CookieStoreAPI` | Named isolated in-memory store |
| `getStore(name)` | `(name: string)` | `CookieStoreAPI \| undefined` | Retrieve named store |

**SecurityAPI methods:**
| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `cors(options?)` | `(options?: CorsOptions)` | `CorsMiddleware` | CORS middleware |
| `csrf(options?)` | `(options?: CsrfOptions)` | `CsrfMiddleware` | CSRF middleware |
| `helmet(options?)` | `(options?: HelmetOptions)` | `HelmetMiddleware` | HTTP header hardening |
| `compression(options?)` | `(options?: CompressionOptions)` | `CompressionMiddleware` | Response compression |
| `sanitize(options?)` | `(options?: SanitizeOptions)` | `Sanitizer` | HTML/object sanitization |

**LifecycleAPI methods:**
| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `mode()` | none | `LifecycleMode` | Current mode |
| `setMode(mode)` | `mode: LifecycleMode` | `{ success, conflicts, error? }` | Change mode |
| `initialize()` | none | `{ success, conflicts, error? }` | Initialize lifecycle |
| `registerMiddleware(name, type, middleware, opts?)` | name, type, handler, options | `{ success, conflicts, error? }` | Register middleware |
| `unregisterMiddleware(name)` | `name: string` | `boolean` | Remove middleware |
| `registerPlugin(name, namespace, hooks, opts?)` | name, namespace, hooks, options | `{ success, conflicts, error? }` | Register plugin |
| `unregisterPlugin(name, namespace)` | name, namespace | `boolean` | Remove plugin |
| `executeMiddleware(name, req, res, phase?)` | name, req, res, phase | `Promise<MiddlewareResult>` | Execute named middleware |
| `executeMiddlewareChain(req, res, phase?)` | req, res, phase | `Promise<MiddlewareResult[]>` | Execute all middleware |
| `executeHook(hookName, context)` | hookName, context | `Promise<PluginResult[]>` | Execute hook on all plugins |
| `executeHookIsolated(hookName, context, namespace)` | hookName, context, namespace | `Promise<PluginResult>` | Execute hook in isolation |
| `getState()` | none | `LifecycleState` | Current lifecycle state |
| `getMiddlewareList()` | none | `MiddlewareRegistration[]` | Registered middleware |
| `getPluginList()` | none | `PluginRegistration[]` | Registered plugins |
| `getNamespaces()` | none | `string[]` | All namespaces |
| `hasMiddleware(name)` | `name: string` | `boolean` | Middleware registered? |
| `hasPlugin(name, namespace)` | name, namespace | `boolean` | Plugin registered? |
| `clear()` | none | `void` | Clear all registrations |
| `isSafe()` | none | `boolean` | Whether no error-level conflicts |
| `getValidationReport()` | none | `{ safe, conflicts, headerConflicts, warnings, errors }` | Validation report |
| `createPluginContext(name, namespace)` | name, namespace | `PluginContext` | Create plugin context |

**MsgPackAPI methods:**
| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `encode(value, options?)` | `value: unknown` | `Uint8Array` | Sync encode |
| `decode<T>(data, options?)` | `data: Uint8Array \| ArrayBuffer` | `T` | Sync decode |
| `encodeSync(value, options?)` | `value: unknown` | `Uint8Array` | Sync encode |
| `decodeSync<T>(data, options?)` | `data: Uint8Array \| ArrayBuffer` | `T` | Sync decode |

**ResponseAPI methods:**
| Method | Signature | Description |
|--------|-----------|-------------|
| `ok(options?)` | `(options?: SuccessOptions)` | Send 200 response |
| `success(options?)` | `(options?: SuccessOptions)` | Send success response |
| `created(options?)` | `(options?: SuccessOptions)` | Send 201 response |
| `accepted(options?)` | `(options?: SuccessOptions)` | Send 202 response |
| `noContent()` | `()` | Send 204 response |
| `badRequest(options?)` | `(options?: ErrorOptions)` | Send 400 response |
| `unauthorized(options?)` | `(options?: ErrorOptions)` | Send 401 response |
| `forbidden(options?)` | `(options?: ErrorOptions)` | Send 403 response |
| `notFound(options?)` | `(options?: ErrorOptions)` | Send 404 response |
| `conflict(options?)` | `(options?: ErrorOptions)` | Send 409 response |
| `unprocessable(options?)` | `(options?: ErrorOptions)` | Send 422 response |
| `internalServerError(options?)` | `(options?: ErrorOptions)` | Send 500 response |
| `respond(options)` | `(options: RespondOptions)` | Generic status + body |

**LibAPI methods:**
| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `formatBytes(bytes, decimals?)` | `bytes: number`, `decimals?: number` | `string` | Human-readable byte size |
| `formatTime(ms)` | `ms: number` | `string` | Human-readable duration |
| `timestamp(date)` | `date: Date` | `string` | ISO-8601 timestamp |
| `getSystemInfo()` | none | `SystemInfo` | System/process information |
| `getSystemStatus(system, checks, thresholds?)` | `SystemMetrics`, `HealthChecks`, `SystemThresholds?` | `SystemStatus` | System health status |

#### Implementation Examples

**Basic usage:**
```ts
import { createApp } from '@oneunit/core';

const app = createApp({
  serviceName: 'billing',
  port: 8080,
  host: '0.0.0.0',
  nodeEnv: 'production',
  secret: process.env.APP_SECRET,
});

console.log(app.config().toJSON());
// { port: 8080, host: '0.0.0.0', serviceName: 'billing', nodeEnv: 'production' }

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

**Advanced usage (cached instances + per-request instances):**
```ts
const app = createApp({ serviceName: 'api', port: 3000 });

// Cached instance — same reference every call
const cfg1 = app.config();
const cfg2 = app.config();
console.log(cfg1 === cfg2); // true

// Per-request cookie store — bound to req/res
app.use((req, res) => {
  const cookies = app.cookies(req, res);
  cookies.set('session', 'abc123', { httpOnly: true, sameSite: 'lax' });

  const response = app.response(req, res);
  response.ok({ user: 'alice' });
});
```

**Lifecycle usage:**
```ts
const app = createApp({ lifecycle: { mode: 'strict' } });
const lifecycle = app.lifecycle();

lifecycle.registerMiddleware('logger', 'http', async (ctx) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  await ctx.next();
}, { priority: 10 });

const result = await lifecycle.executeMiddleware('logger', req, res, 'request');
```

---

## 2. Config

The Config component provides service configuration loading, environment parsing, and validation. It consists of `createConfig` (service config), env helper functions (`src/config/env.ts`), and a generic config engine with validation pipelines, interpolation, YAML loading, and Zod integration.

### 2.1 `createConfig`

**File:** `src/config/create-config.ts`

#### Functional Description

`createConfig` builds a `Config` service object from optional overrides. It applies defaults (`port=3000`, `host="localhost"`, `serviceName="app"`, `nodeEnv="development"`), reads environment variables (`PORT`, `HOST`, `SERVICE_NAME`), validates the port (1–65535), and exposes environment-flag helpers (`isDevelopment`, `isProduction`, `isTest`) plus `toJSON()` serialization. Explicit options take precedence over environment variables.

#### API Reference

**Signature:**
```ts
function createConfig(options?: CreateConfigOptions): Config
```

**`CreateConfigOptions`:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `port` | `number` | no | `3000` | `PORT` env or default |
| `host` | `string` | no | `"localhost"` | `HOST` env or default |
| `serviceName` | `string` | no | `"app"` | `SERVICE_NAME` env or default |
| `nodeEnv` | `"development" \| "production" \| "test" \| string` | no | `"development"` | `NODE_ENV` env or default |

**`Config` interface:**
| Member | Type | Description |
|--------|------|-------------|
| `port` | `number` (readonly) | Validated port |
| `host` | `string` (readonly) | Bind host |
| `serviceName` | `string` (readonly) | Service name |
| `nodeEnv` | `string` (readonly) | Normalized environment |
| `isDevelopment` | `boolean` (readonly) | `nodeEnv === 'development'` |
| `isProduction` | `boolean` (readonly) | `nodeEnv === 'production'` |
| `isTest` | `boolean` (readonly) | `nodeEnv === 'test'` |
| `toJSON()` | `ServiceConfig` | Plain config object |

**Validation:**
- Port must be an integer in `1..65535`; otherwise throws `Error`.

#### Implementation Examples

**Basic usage:**
```ts
import { createConfig } from '@oneunit/core/config';

const config = createConfig({ port: 8080, serviceName: 'payments' });

console.log(config.port);        // 8080
console.log(config.serviceName); // 'payments'
console.log(config.isDevelopment()); // true
console.log(config.toJSON());
// { port: 8080, host: 'localhost', serviceName: 'payments', nodeEnv: 'development' }
```

**Advanced usage (env precedence + validation):**
```ts
// PORT=9000 SERVICE_NAME=auth node env
const config = createConfig({}); // picks up PORT=9000, SERVICE_NAME='auth'
console.log(config.port);   // 9000

// Explicit options win over env
const config2 = createConfig({ port: 3000 }); // PORT=9000 ignored
console.log(config2.port); // 3000

// Invalid port throws
try {
  createConfig({ port: 70000 });
} catch (e) {
  // Error: Invalid port: 70000. Port must be between 1 and 65535.
}
```

---

### 2.2 Env Helper Functions

**File:** `src/config/env.ts`

#### Functional Description

The env module provides type-safe environment variable readers with fallback semantics. Each reader trims whitespace, treats empty/missing values as the fallback, and validates the target type. `resolveNodeEnv` normalizes `NODE_ENV` to lowercase with a `development` default. `envFile` resolves `.env.{nodeEnv}` paths for dotenv-style loading.

All readers return `undefined` when the variable is unset or invalid (fallback is returned instead).

#### API Reference

| Function | Signature | Fallback behavior | Returns |
|----------|-----------|-------------------|---------|
| `envString` | `envString(name, fallback?)` | trims; empty → fallback | `string \| undefined` |
| `envNumber` | `envNumber(name, fallback?)` | `Number(value)`, `!isFinite` → fallback | `number \| undefined` |
| `envBool` | `envBool(name, fallback?)` | case-insensitive `true/1/yes/on` → `true`; `false/0/no/off` → `false`; else fallback | `boolean \| undefined` |
| `envList` | `envList(name, fallback?)` | comma split, trim, filter empty | `string[] \| undefined` |
| `resolveNodeEnv` | `resolveNodeEnv(nodeEnv?)` | lowercase; `undefined` → `'development'` | `string` |
| `isDevelopment` | `isDevelopment(nodeEnv?)` | — | `boolean` |
| `isProduction` | `isProduction(nodeEnv?)` | — | `boolean` |
| `isTest` | `isTest(nodeEnv?)` | — | `boolean` |
| `envFile` | `envFile(baseDir, nodeEnv?)` | — | `.env.{nodeEnv}` path string |

**Error codes:** None (all are fallback-safe; no throws).

#### Implementation Examples

```ts
import {
  envString, envNumber, envBool, envList,
  resolveNodeEnv, isDevelopment, isProduction, isTest, envFile,
} from '@oneunit/core/config/env';

const port = envNumber('PORT', 3000);        // " 8080 " → 8080; "" → 3000
const debug = envBool('DEBUG', false);       // "TRUE" → true; "off" → false
const origins = envList('CORS_ORIGINS', []); // "a.com, b.com " → ['a.com','b.com']
const nodeEnv = resolveNodeEnv(process.env.NODE_ENV); // "PRODUCTION" → 'production'

console.log(isProduction(nodeEnv)); // true
console.log(envFile('/app/config', 'production')); // /app/config/.env.production
```

---

### 2.3 Generic Config Engine

**File:** `src/config/` (engine modules)

#### Functional Description

The generic config engine supports typed configuration for any domain. The pipeline is: **interpolate → merge → validate → freeze**. Sources implement `ConfigSource.load()`, validators implement `ConfigValidator<T>`. Interpolation supports `${VAR}` and `${VAR:fallback}` syntax across nested objects and arrays. The result is deeply frozen via `deepFreeze`. Async and sync loaders are provided.

#### API Reference

**Interfaces:**
```ts
interface ConfigValidator<T> {
  validate(input: unknown): T;
  validateAsync?(input: unknown): Promise<T>;
}

interface ConfigSource {
  readonly name: string;
  load(context: ConfigSourceContext): Promise<unknown>;
}
```

**Pipeline functions:**
| Function | Signature | Async? | Sources |
|----------|-----------|--------|---------|
| `runPipeline` | `runPipeline(sources, validator)` | yes | any |
| `runPipelineAsync` | `runPipelineAsync(sources, validator)` | yes | any |
| `loadConfigSimple` | `loadConfigSimple(baseDir, nodeEnv)` | yes | YAML |
| `loadConfigSync` | `loadConfigSync(baseDir, nodeEnv)` | no | YAML only |

**Helpers:**
- `applyInterpolation(value, env)` — `${VAR}`, `${VAR:fallback}`, nested objects/arrays
- `deepFreeze(value)` — recursive `Object.freeze`
- `resolveConfig(value, validator)` — validate + freeze
- `zodValidator(schema)` — Zod-backed `ConfigValidator`

**Error codes:** None specific (validation errors propagate from the validator).

#### Implementation Examples

**Basic usage (Zod + pipeline):**
```ts
import { z } from 'zod';
import { zodValidator, runPipeline } from '@oneunit/core/config';

const schema = z.object({
  port: z.number().min(1).max(65535).default(3000),
  host: z.string().default('localhost'),
});

const config = await runPipeline(
  [{ load: () => ({ port: 8080 }) }],
  zodValidator(schema)
);

console.log(config.port); // 8080
```

**Advanced usage (interpolation + freeze):**
```ts
import { applyInterpolation, deepFreeze, resolveConfig } from '@oneunit/core/config';

const raw = {
  database: { url: 'postgres://${DB_HOST:localhost}:${DB_PORT:5432}/db' },
  features: ['${FEATURE_A}', '${FEATURE_B:default}'],
};

const interpolated = applyInterpolation(raw, process.env);
// DB_HOST=db.internal → 'postgres://db.internal:5432/db'

const frozen = deepFreeze(resolveConfig(interpolated, zodValidator(schema)));
```

---

## 3. Cookie

The Cookie component (`src/cookie/`, `src/adapters/cookie/`) provides signed and encrypted cookie storage with framework adapters for Express, Fastify, Koa, and `node:http`. It supports HMAC-SHA256 signing, AES-256-GCM encryption, prefix validation (`__Secure-`, `__Host-`), SameSite/Secure rules, and secret rotation via fallback secrets.

### 3.1 CookieStore API

**File:** `src/cookie/registery.ts`

#### Functional Description

`CookieStore` is the primary cookie interface. It offers get/set/delete/has/all/clear for plain cookies, signed (HMAC-SHA256) and encrypted (AES-256-GCM) variants, plus `serialize`/`parse` for raw Set-Cookie/Cookie headers, and `createStore`/`getStore` for named isolated stores. Instances are typically obtained via `app.cookies(req, res)`.

Signed cookies store `value.signature` and verify via `getSigned()`. Encrypted cookies use AES-256-GCM with a random salt and IV per value. `all()` re-verifies signed/decrypts encrypted entries on read.

#### API Reference

**`createCookieStore`:**
```ts
function createCookieStore(config?: CookieConfig | string): CookieStore
```
When `config` is a string, it is treated as the secret with signing auto-enabled.

**`CookieOptions`:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | `string` | `"/"` | Cookie path |
| `domain` | `string` | `undefined` | Cookie domain |
| `expires` | `Date` | `undefined` | Expiration date |
| `maxAge` | `number` | `0` | Max age in seconds |
| `secure` | `boolean` | `NODE_ENV === 'production'` | Secure flag (resolved at merge time) |
| `httpOnly` | `boolean` | `true` | HttpOnly flag |
| `sameSite` | `"strict" \| "lax" \| "none" \| boolean` | `"lax"` | SameSite attribute |
| `signed` | `boolean` | `false` | Sign the cookie |
| `secret` | `string` | `undefined` | Signing secret |
| `secrets` | `string[]` | `[]` | Fallback secrets (rotation) |
| `encode` | `function` | `encodeURIComponent` | Value encoder |
| `decode` | `function` | `decodeURIComponent` | Value decoder |
| `encrypted` | `boolean` | `false` | Encrypt the cookie |

**`CookieStore` methods:**
| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `get(name)` | `(name: string)` | `string \| undefined` | Read a cookie value |
| `set(name, value, options?)` | `(name: string, value: string, options?: CookieOptions)` | `CookieStore` | Set a cookie (chainable) |
| `delete(name, options?)` | `(name: string, options?: { path?, domain? })` | `CookieStore` | Delete a cookie (chainable) |
| `has(name)` | `(name: string)` | `boolean` | Existence check |
| `all()` | `()` | `Record<string, string>` | All cookies (re-verifies signed/encrypted) |
| `clear()` | `()` | `CookieStore` | Clear all (chainable) |
| `setSigned(name, value, options?)` | `(name: string, value: string, options?: CookieOptions)` | `CookieStore` | HMAC-SHA256 signed cookie |
| `setEncrypted(name, value, options?)` | `(name: string, value: string, options?: CookieOptions)` | `CookieStore` | AES-256-GCM encrypted cookie |
| `getSigned(name)` | `(name: string)` | `string \| undefined` | Verify signature; fallback secrets |
| `getEncrypted(name)` | `(name: string)` | `string \| null` | Decrypt; fallback secrets |
| `serialize(name, value, options?)` | `(name: string, value: string, options?: CookieOptions)` | `string` | Set-Cookie header value |
| `parse(cookieHeader)` | `(cookieHeader: string)` | `Record<string, string>` | Parse Cookie header |

**Validation rules:**
- SameSite=`none` requires `secure=true`
- `__Secure-` prefix requires `secure`
- `__Host-` prefix requires `secure` + `path="/"` + no `domain`
- Cookie names must be non-empty and contain no `=;\\s`
- Signed cookies: tamper detection on signature mismatch
- Encrypted cookies: ciphertext/auth-tag tamper detection

**Error codes:**
| Code | Meaning |
|------|---------|
| `COOKIE_ERROR` | Generic cookie failure |
| `COOKIE_SECRET_REQUIRED` | Secret missing for signed/encrypted cookies |
| `INVALID_COOKIE_NAME` | Cookie name violates naming rules |
| `COOKIE_SECURE_PREFIX_ERROR` | `__Secure-`/`__Host-` prefix requires Secure |
| `SAMESITE_NONE_REQUIRES_SECURE` | SameSite=None requires Secure attribute |
| `COOKIE_DECRYPTION_ERROR` | Failed to decrypt cookie value |
| `COOKIE_SIGNATURE_ERROR` | Cookie signature verification failed |

#### Implementation Examples

**Basic usage:**
```ts
import { createApp } from '@oneunit/core';

const app = createApp({ secret: 's3cr3t' });

app.use((req, res) => {
  const cookies = app.cookies(req, res);
  cookies.set('theme', 'dark', { maxAge: 86400, sameSite: 'lax' });
  console.log(cookies.get('theme')); // 'dark'
  console.log(cookies.all());        // { theme: 'dark' }
});
```

**Advanced usage (signed + encrypted + rotation):**
```ts
const app = createApp({
  secret: 'current-secret',
  cookie: { secrets: ['old-secret-1', 'old-secret-2'] },
});

app.use((req, res) => {
  const cookies = app.cookies(req, res);

  // Signed cookie (HMAC-SHA256)
  cookies.setSigned('user', 'alice', { signed: true, secret: 'current-secret' });
  const user = cookies.getSigned('user'); // 'alice' or undefined if tampered

  // Encrypted cookie (AES-256-GCM)
  cookies.setEncrypted('token', 'eyJhbG...', { encrypted: true });
  const token = cookies.getEncrypted('token'); // string or null

  // Named isolated store
  const sessionStore = app.cookies().createStore('session');
  sessionStore.set('sid', 'abc123');
  const store = app.cookies().getStore('session'); // sessionStore
});
```

**Cross-framework usage:**
Adapters auto-detect the request shape: `ctx.cookies` (Koa) → `req.cookies` (Fastify) → `req.headers.cookie` (Express) → `res.setHeader` (node:http). Pass the framework's `req`/`res` (or Koa `ctx`) to `app.cookies(req, res)`.

---

### 3.2 Cookie Adapters

**File:** `src/adapters/cookie/`

#### Functional Description

Four framework adapters normalize request/response cookie access so `CookieStore` works uniformly across Express, Fastify, Koa, and raw `node:http`. Detection priority: Koa `ctx.cookies` → Fastify `req.cookies` → Express `req.headers.cookie` → `node:http` `res.setHeader`. Each adapter implements the `CookieAdapter` interface (`get`, `set`, `delete`, `getAll`) plus `BaseAdapter` lifecycle (`initialize`, `dispose`).

Adapters must be initialized before use (the factory functions `create*CookieAdapter` call `initialize()` automatically).

#### API Reference

| Adapter | Factory | Framework | Read mechanism | Write mechanism |
|---------|---------|-----------|----------------|-----------------|
| `ExpressCookieAdapter` | `createExpressCookieAdapter(req, res)` | Express | `req.headers.cookie` | `res.setHeader('Set-Cookie', ...)` |
| `FastifyCookieAdapter` | `createFastifyCookieAdapter(req, reply)` | Fastify | `req.cookies` | `reply.setCookie()` / `reply.unsetCookie()` |
| `KoaCookieAdapter` | `createKoaCookieAdapter(ctx)` | Koa | `ctx.cookies.get()` | `ctx.cookies.set()` |
| `HttpCookieAdapter` | `createHttpCookieAdapter(req, res)` | node:http | `req.headers.cookie` | `res.setHeader('Set-Cookie', ...)` |

**`CookieAdapter` interface:**
| Method | Signature | Description |
|--------|-----------|-------------|
| `get(name)` | `(name: string)` | `string \| undefined` | Read a cookie value |
| `set(name, value, options)` | `(name: string, value: string, options: CookieOptions)` | `void` | Set a cookie |
| `delete(name, options?)` | `(name: string, options?: { path?, domain? })` | `void` | Delete a cookie |
| `getAll()` | `()` | `Record<string, string>` | All cookies |

**`BaseAdapter` contract:**
| Method | Signature | Description |
|--------|-----------|-------------|
| `initialize()` | `()` | `void` — one-time setup |
| `dispose()` | `()` | `void` — teardown |
| `initialized` | `boolean` (getter) | Whether initialized |

#### Implementation Examples

**Express:**
```ts
import express from 'express';
import { createApp } from '@oneunit/core';

const app = createApp({ framework: 'express' });
const expressApp = express();

expressApp.use((req, res) => {
  const cookies = app.cookies(req, res);
  cookies.set('session', 'xyz', { httpOnly: true });
  res.json({ ok: true });
});
```

**Fastify:**
```ts
import fastify from 'fastify';
import { createApp } from '@oneunit/core';

const app = createApp({ framework: 'fastify' });
const f = fastify();

f.addHook('onRequest', (req, reply) => {
  const cookies = app.cookies(req, reply);
  cookies.set('session', 'xyz');
});
```

**Koa:**
```ts
import Koa from 'koa';
import { createApp } from '@oneunit/core';

const app = createApp({ framework: 'koa' });
const koa = new Koa();

koa.use((ctx) => {
  const cookies = app.cookies(ctx);
  cookies.set('session', 'xyz');
  ctx.body = { ok: true };
});
```

**node:http:**
```ts
import http from 'http';
import { createApp } from '@oneunit/core';

const app = createApp({ framework: 'http' });

http.createServer((req, res) => {
  const cookies = app.cookies(req, res);
  cookies.set('session', 'xyz');
  res.end('ok');
});
```

---

## 4. Security

The Security component (`src/security/`) provides HTTP hardening middleware: CORS, CSRF (double-submit), Helmet headers, compression (gzip/deflate/brotli), sanitization (HTML/object), and sliding-window rate limiting. All share a `SecurityMiddleware` base with `enable`/`disable`/`toggle`/`enabled`/`options`.

### 4.1 `SecurityMiddleware` Base

**File:** `src/security/middleware-base.ts`

#### Functional Description

`createSecurityMiddlewareBase` is the common enabled-toggle + middleware wrapper used by all security middleware implementations. It provides lifecycle control (`enable`, `disable`, `toggle`), an `enabled` getter, and an `options` getter.

#### API Reference

| Member | Type | Description |
|--------|------|-------------|
| `name` | `string` | Middleware name |
| `enabled` | `boolean` (getter) | Current state |
| `options` | `object` (getter) | Resolved options |
| `enable()` | `void` | Activate the middleware |
| `disable()` | `void` | Deactivate the middleware |
| `toggle()` | `void` | Flip enabled state |
| `middleware()` | `() => (req, res, next?) => void` | Returns the wrapped handler |

#### Implementation Examples

```ts
import { createSecurityMiddlewareBase } from '@oneunit/core/security';

const base = createSecurityMiddlewareBase('cors', {}, (req, res, next) => {
  if (next) next();
});
console.log(base.enabled); // true
base.disable();
console.log(base.enabled); // false
```

---

### 4.2 CORS (`createCors`)

**File:** `src/security/cors.ts`

#### Functional Description

`createCors` implements Cross-Origin Resource Sharing. It handles preflight `OPTIONS` requests, reflects request origin when credentials are enabled with a wildcard, returns `403` for disallowed origins, and sets `Access-Control-*` response headers. The `middleware()` returns an Express-style handler.

#### API Reference

**Signature:**
```ts
function createCors(options?: CorsOptions): CorsMiddleware
```

**`CorsOptions`:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `origin` | `string \| string[] \| boolean` | `"*"` | Allowed origin(s); `true` reflects request origin |
| `methods` | `string[]` | `[GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS]` | Allowed methods |
| `allowedHeaders` | `string[]` | `["Origin", ...]` | Allowed request headers |
| `exposedHeaders` | `string[]` | `[]` | Headers exposed to clients |
| `credentials` | `boolean` | `false` | Allow credentials |
| `maxAge` | `number` | `86400` | Preflight cache seconds |
| `preflightContinue` | `boolean` | `false` | Pass preflight to next handler |
| `optionsSuccessStatus` | `number` | `204` | Successful preflight status |

**`CorsMiddleware`:**
| Member | Type | Description |
|--------|------|-------------|
| `name` | `string` | `"cors"` |
| `enabled` | `boolean` (getter) | Current state |
| `options` | `CorsOptions` (getter) | Resolved options |
| `enable()`/`disable()`/`toggle()` | `void` | Lifecycle control |
| `middleware()` | `() => (req, res, next?) => void` | Express-style handler |
| `headers()` | `() => Record<string,string>` | Resolved header map |

**Behavior:**
- Disallowed origin → `403 Forbidden`
- `credentials: true` + `origin: "*"` → reflects `Origin` header
- Preflight `OPTIONS` → `optionsSuccessStatus` (default `204`)

**Error codes:** None (CORS failures produce `403` responses, not throws).

#### Implementation Examples

**Basic usage:**
```ts
import { createApp } from '@oneunit/core';

const app = createApp({
  security: { cors: { origin: '*', credentials: false } },
});
app.use(app.security().cors().middleware());
```

**Advanced usage (credentials + wildcard reflection):**
```ts
import { createCors } from '@oneunit/core/security';

const cors = createCors({
  origin: true,           // reflect request Origin
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['content-type', 'authorization'],
  exposedHeaders: ['x-total-count'],
  maxAge: 600,
});

app.use(cors.middleware());
app.use((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
});
```

---

### 4.3 CSRF (`createCsrf`)

**File:** `src/security/csrf.ts`

#### Functional Description

`createCsrf` implements the double-submit cookie CSRF pattern. A token is generated (64-char hex from 32 random bytes), stored in a cookie, and validated against a token sent via header, query, or body using constant-time comparison. `GET`/`HEAD`/`OPTIONS` are skipped by default. Validation failure returns `403`. `middlewareWithToken()` re-issues the cookie when no existing cookie token is present.

#### API Reference

**Signature:**
```ts
function createCsrf(options?: CsrfOptions): CsrfMiddleware
```

**`CsrfOptions`:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `secret` | `string` | `undefined` | CSRF signing secret |
| `cookieName` | `string` | `"_csrf"` | CSRF cookie name |
| `headerName` | `string` | `"X-CSRF-Token"` | Token header name |
| `cookieOptions` | `object` | `{ path: "/", sameSite: "lax", httpOnly: true, secure: NODE_ENV === "production" }` | Underlying cookie options |
| `ignoreMethods` | `string[]` | `['GET','HEAD','OPTIONS']` | Methods exempt from validation |

**`CsrfMiddleware`:**
| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `generateToken` | `()` | `string` (64-char hex) | Generate a new token |
| `validateToken` | `(token, cookieToken?)` | `boolean` | Constant-time compare |
| `getTokenFromRequest` | `(req)` | `string \| undefined` | Header → query → body |
| `middleware` | `()` | `(req,res,next)=>void` | Validate; skip ignored methods; 403 on fail |
| `middlewareWithToken` | `()` | `(req,res,next)=>void` | Validate + re-issue cookie when missing |

**Error codes:** None (validation failure → `403 Forbidden`).

#### Implementation Examples

**Basic usage:**
```ts
import { createApp } from '@oneunit/core';

const app = createApp({
  security: {
    csrf: { cookieName: 'csrf_token', headerName: 'x-csrf-token' },
  },
});
app.use(app.security().csrf().middleware());
```

**Advanced usage (token generation + rotation):**
```ts
import { createCsrf } from '@oneunit/core/security';

const csrf = createCsrf({
  cookieName: 'csrf_token',
  headerName: 'x-csrf-token',
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
});

const token = csrf.generateToken(); // 64-char hex
console.log(csrf.validateToken(token, token)); // true

app.use(csrf.middlewareWithToken());
```

---

### 4.4 Helmet (`createHelmet`)

**File:** `src/security/helmet.ts`

#### Functional Description

`createHelmet` hardens HTTP response headers. It sets Content-Security-Policy, Referrer-Policy, X-XSS-Protection, X-Frame-Options, and related headers. Defaults disable CSP but enable `no-referrer` referrer policy, XSS block, `SAMEORIGIN` framing, hide `X-Powered-By`, and nosniff. `headers()` returns the resolved header map; `middleware()` applies them to the response.

#### API Reference

**Signature:**
```ts
function createHelmet(options?: HelmetOptions): HelmetMiddleware
```

**`HelmetOptions`:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `contentSecurityPolicy` | `object \| boolean` | `false` | CSP policy object or disabled |
| `referrerPolicy` | `string` | `"no-referrer"` | Referrer-Policy value |
| `xssProtection` | `string` | `"1; mode=block"` | X-XSS-Protection value |
| `frameOptions` | `string` | `"SAMEORIGIN"` | X-Frame-Options value |
| `hidePoweredBy` | `boolean` | `true` | Remove X-Powered-By |
| `hsts` | `boolean \| object` | `false` | Strict-Transport-Security |
| `noSniff` | `boolean` | `true` | X-Content-Type-Options: nosniff |
| `ieNoOpen` | `boolean` | `true` | X-Download-Options: noopen |
| `dnsPrefetchControl` | `boolean` | `true` | X-DNS-Prefetch-Control |

Plus `expectCt`, `featurePolicy`, `crossOriginPolicy`, `crossOriginEmbedderPolicy`, `crossOriginOpenerPolicy`, `crossOriginResourcePolicy`, `originAgentCluster`, `permittedCrossDomainPolicies`.

**`HelmetMiddleware`:**
| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `headers` | `()` | `Record<string,string>` | Resolved header map |
| `middleware` | `()` | `(req,res,next)=>void` | Set headers on response |

**Default header map:**
| Header | Default value |
|--------|---------------|
| `Referrer-Policy` | `no-referrer` |
| `X-XSS-Protection` | `1; mode=block` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Download-Options` | `noopen` |
| `X-DNS-Prefetch-Control` | `off` |
| `X-Powered-By` | removed |

**Error codes:** None.

#### Implementation Examples

**Basic usage:**
```ts
import { createApp } from '@oneunit/core';

const app = createApp({
  security: { helmet: { contentSecurityPolicy: false, hsts: false } },
});
app.use(app.security().helmet().middleware());
```

**Advanced usage (full hardening):**
```ts
import { createHelmet } from '@oneunit/core/security';

const helmet = createHelmet({
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"] },
  },
  referrerPolicy: 'strict-origin-when-cross-origin',
  frameOptions: 'DENY',
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true },
  noSniff: true,
  ieNoOpen: true,
  dnsPrefetchControl: true,
});

console.log(helmet.headers());
// { 'referrer-policy': '...', 'x-frame-options': 'DENY', ... }

app.use(helmet.middleware());
```

---

### 4.5 Compression (`createCompression`)

**File:** `src/security/compression.ts`

#### Functional Description

`createCompression` compresses HTTP response bodies using gzip, deflate, or brotli based on `Accept-Encoding`. It monkey-patches `res.write`/`res.end` once per response, removes `Content-Length` when compressing, and skips compression below the threshold. Defaults: threshold 1024 bytes, level 6.

#### API Reference

**Signature:**
```ts
function createCompression(options?: CompressionOptions): CompressionMiddleware
```

**`CompressionOptions`:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `threshold` | `number` | `1024` | Minimum body bytes to compress |
| `level` | `number` | `6` | Compression level (1–9) |
| `memLevel` | `number` | `8` | zlib memLevel |
| `strategy` | `number` | `0` | zlib strategy |
| `windowBits` | `number` | `15` | zlib windowBits |
| `filter` | `(req, res) => boolean` | `undefined` | Whether to compress |

**`CompressionMiddleware`:**
| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `middleware` | `()` | `(req,res,next)=>void` | Patch res.write/end, compress body |
| `shouldCompress` | `(req, res)` | `boolean` | Whether request should be compressed |

**Behavior:**
- Body < threshold → no compression, `Content-Length` preserved
- Body ≥ threshold → compress, `Content-Length` removed, `Content-Encoding` set
- Patching happens once per response (idempotent)

**Error codes:** None.

#### Implementation Examples

**Basic usage:**
```ts
import { createApp } from '@oneunit/core';

const app = createApp({
  security: { compression: { threshold: 1024, level: 6 } },
});
app.use(app.security().compression().middleware());
```

**Advanced usage (custom filter):**
```ts
import { createCompression } from '@oneunit/core/security';

const compression = createCompression({
  threshold: 512,
  level: 9,
  filter: (req, res) => /gzip|deflate|br/.test((req as any)?.headers?.['accept-encoding'] || ''),
});

app.use(compression.middleware());
```

---

### 4.6 Sanitize (`createSanitizer`)

**File:** `src/security/sanitize.ts`

#### Functional Description

`createSanitizer` removes unsafe HTML (script tags, event handlers) and recursively sanitizes objects/arrays. It uses a default allow-list of tags, attributes, and schemes backed by `sanitize-html`. Suitable for cleaning user-generated content before storage or rendering.

#### API Reference

**Signature:**
```ts
function createSanitizer(options?: SanitizeOptions): Sanitizer
```

**`SanitizeOptions`:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `allowedTags` | `string[]` | default set | Permitted HTML tags |
| `allowedAttributes` | `object` | default set | Permitted attributes per tag |
| `allowedSchemes` | `string[]` | `['http','https','mailto','tel']` | Permitted URL schemes |

**`Sanitizer`:**
| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `sanitize` | `(html, options?)` | `string` | Strip scripts/event handlers from HTML |
| `sanitizeObject` | `(obj, options?)` | `object` | Recursive sanitization of objects/arrays |

**Default allow-list:**
- Tags: `a, abbr, b, bdo, blockquote, br, cite, code, dd, del, dfn, div, dl, dt, em, emoji, h1–h6, i, img, ins, kbd, li, mark, ol, p, q, rp, rt, ruby, s, samp, small, span, strong, sub, sup, table, tbody, td, tfoot, th, thead, tr, u, ul, var, wbr`
- Attributes: `href, title, target, rel` (a); `src, alt, width, height` (img); `class` (div/span/p/h1–h6); etc.
- Schemes: `http, https, mailto, tel`

**Error codes:** None.

#### Implementation Examples

**Basic usage:**
```ts
import { createApp } from '@oneunit/core';

const app = createApp({ security: { sanitize: {} } });
const { sanitize } = app.security();

const clean = sanitize('<p>Hello</p><script>alert("xss")</script>');
console.log(clean); // '<p>Hello</p>'
```

**Advanced usage (object sanitization + custom allow-list):**
```ts
const sanitize = createSanitizer({
  allowedTags: ['b', 'i', 'em', 'a'],
  allowedAttributes: { a: ['href', 'title'] },
  allowedSchemes: ['https'],
});

const dirty = {
  bio: '<b>hi</b><img src="x" onerror="alert(1)">',
  links: ['https://example.com', 'javascript:alert(1)'],
};

const clean = sanitize.sanitizeObject(dirty);
// { bio: '<b>hi</b>', links: ['https://example.com'] }
```

---

### 4.7 Rate Limit (`createRateLimit`)

**File:** `src/security/rate-limit.ts`

#### Functional Description

`createRateLimit` implements a sliding-window rate limiter. It tracks requests per key (default: IP from `x-forwarded-for`/`x-real-ip`/connection), enforces `maxRequests` per `windowMs`, and returns `429` with `Retry-After` when exceeded. Response headers expose limit/remaining/reset. Supports skipping failed or successful requests and custom key generators.

#### API Reference

**Signature:**
```ts
function createRateLimit(options?: RateLimitOptions): RateLimitMiddleware
```

**`RateLimitOptions`:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `windowMs` | `number` | `60000` | Window size in milliseconds |
| `maxRequests` | `number` | `100` | Max requests per window |
| `keyGenerator` | `(req) => string` | IP from headers/connection | Key derivation function |
| `message` | `string` | `'Too many requests'` | 429 response body |
| `statusCode` | `number` | `429` | Response status code |
| `includeRetryAfter` | `boolean` | `true` | Add Retry-After header |
| `skipFailedRequests` | `boolean` | `false` | Don't count 4xx/5xx |
| `skipSuccessfulRequests` | `boolean` | `false` | Don't count 2xx |

**`RateLimitMiddleware`:**
| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `middleware` | `()` | `(req,res,next)=>void` | Enforce limit; 429 on exceed |
| `getRateLimitInfo(key)` | `(key: string)` | `RateLimitInfo \| null` | `{ totalRequests, remaining, resetTime, limited }` |
| `resetKey(key)` | `(key: string)` | `void` | Clear a key's window |
| `resetAll()` | `()` | `void` | Clear all windows |

**Response headers (429):**
| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | maxRequests |
| `X-RateLimit-Remaining` | remaining in window |
| `X-RateLimit-Reset` | epoch seconds until reset |
| `Retry-After` | seconds until reset (when enabled) |

**Error codes:** None (limit exceeded → `429` response).

#### Implementation Examples

**Basic usage:**
```ts
import { createApp } from '@oneunit/core';

const app = createApp({
  security: { rateLimit: { windowMs: 60000, maxRequests: 100 } },
});
app.use(app.security().compression().middleware());
```

**Advanced usage (custom key + skip logic):**
```ts
import { createRateLimit } from '@oneunit/core/security';

const rateLimit = createRateLimit({
  windowMs: 60000,
  maxRequests: 10,
  keyGenerator: (req) => (req as any)?.headers?.['x-forwarded-for'] || 'unknown',
  statusCode: 429,
  includeRetryAfter: true,
  skipFailedRequests: true,
});

app.use(rateLimit.middleware());
app.use((req, res) => {
  const info = rateLimit.getRateLimitInfo(rateLimit.keyGenerator ? rateLimit.keyGenerator(req) : 'unknown');
  console.log(info?.remaining);
  res.json({ ok: true });
});

// Reset a specific client
rateLimit.resetKey('client-123');
// Reset everything
rateLimit.resetAll();
```

---

## Compatibility Matrix

| Component | Express | Fastify | Koa | node:http |
|-----------|---------|---------|-----|-----------|
| Core (`createApp`) | ✅ | ✅ | ✅ | ✅ |
| Config (`createConfig`) | ✅ | ✅ | ✅ | ✅ |
| Cookie (`app.cookies`) | ✅ | ✅ | ✅ | ✅ |
| Security middleware | ✅ | ✅ | ✅ | ✅ |

---

## Error Code Reference

| Code | Meaning | Component |
|------|---------|-----------|
| `COOKIE_ERROR` | Generic cookie failure | Cookie |
| `COOKIE_SECRET_REQUIRED` | Secret missing for signed/encrypted | Cookie |
| `INVALID_COOKIE_NAME` | Bad cookie name | Cookie |
| `COOKIE_SECURE_PREFIX_ERROR` | `__Secure-`/`__Host-` rules violated | Cookie |
| `SAMESITE_NONE_REQUIRES_SECURE` | SameSite=None without Secure | Cookie |
| `COOKIE_DECRYPTION_ERROR` | Encrypted cookie tampered | Cookie |
| `COOKIE_SIGNATURE_ERROR` | Signed cookie signature mismatch | Cookie |
| `INVALID_BYTES` | Bytes not finite | Lib |
| `NEGATIVE_BYTES` | Bytes negative | Lib |
| `INVALID_TIME` | Time not finite | Lib |
| `NEGATIVE_TIME` | Time negative | Lib |
| `INVALID_DATE` | Invalid date | Lib |

---

*End of Part 1 — Feature-Level Documentation for @oneunit/core v1.0.0.*
