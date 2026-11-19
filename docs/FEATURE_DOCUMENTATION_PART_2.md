# Feature-Level Documentation — Part 2

**Package:** `@oneunit/core`  
**Version:** `1.0.0`  
**Scope:** Health, Hooks, Lib, Lifecycle, MsgPack  
**Status:** Production-ready

This document is Part 2 of the comprehensive technical documentation suite for `@oneunit/core`. It provides feature-level reference for five components: Health, Hooks, Lib, Lifecycle, and MsgPack. Each feature includes a functional description, API reference, and implementation examples.

Each feature section follows this structure:

- **Functional Description** — purpose, business logic, operational workflow
- **API Reference** — signatures, parameters (mandatory/optional, types, defaults), return values, error codes
- **Implementation Examples** — basic, advanced, cross-framework

---

## 1. Health

The Health component provides application health monitoring, dependency probing, environment detection, and an HTTP health route. It consists of `createHealthRegistry`, `createHealthRoute`, `createHealthProvider` and built-in providers, `detectHealthEnvironment`, `DEFAULT_THRESHOLDS`, and `createHealth`/`registerHealth` factory helpers.

### 1.1 Health Registry (`createHealthRegistry`)

**File:** `src/health/registry.ts`

#### Functional Description

`createHealthRegistry` builds a registry holding named health checks. `checkAll()` executes every registered check in parallel (via `Promise.all`), aggregates the results into a `Record<string, HealthCheckResult>`, and returns them. Individual check failures are caught and reported as `status: "unhealthy"` with the error message. The registry is the engine behind health route status aggregation.

#### API Reference

**Signature:**
```ts
function createHealthRegistry(): HealthRegistry
```

**`HealthRegistry` methods:**

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `register(provider)` | `provider: HealthProvider` | `void` | Register a named health check |
| `unregister(name)` | `name: string` | `void` | Remove a check |
| `getAll()` | none | `HealthProvider[]` | All registered providers |
| `checkAll()` | none | `Promise<Record<string, HealthCheckResult>>` | Run all checks in parallel |

**`HealthCheckResult` interface:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"healthy" \| "degraded" \| "unhealthy"` | Check outcome |
| `latency?` | `number` | Check duration in ms |
| `message?` | `string` | Provider-specific message |
| `details?` | `object` | Provider-specific details |

**`HealthProvider` interface:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Provider/check name |
| `check` | `() => HealthCheckResult \| Promise<HealthCheckResult>` | Probe function |
| `critical?` | `boolean` | Whether failure is critical |

**`HealthCheck` type:**
```ts
type HealthCheck = () => HealthCheckResult | Promise<HealthCheckResult>;
```

**Error codes:** None (check failures are caught and reported as unhealthy results, not thrown).

#### Implementation Examples

**Basic usage:**
```ts
import { createHealthRegistry } from '@oneunit/core/health';

const registry = createHealthRegistry();
registry.register({
  name: 'db',
  check: async () => ({
    name: 'db',
    status: 'healthy',
    latency: 12,
    details: { connections: 5 },
  }),
});

const result = await registry.checkAll();
console.log(result.db.status); // 'healthy'
```

**Advanced usage (parallel execution):**
```ts
const start = Date.now();
const results = await registry.checkAll();
console.log(`Ran ${Object.keys(results).length} checks in ${Date.now() - start}ms`);
```

---

### 1.2 Health Route (`createHealthRoute`)

**File:** `src/health/route.ts`

#### Functional Description

`createHealthRoute` builds an HTTP route handler that runs `checkAll()` on each request, aggregates status, and responds with JSON via a framework server adapter. Status mapping: any unhealthy → `503`, any degraded → `200` with degraded status, all healthy → `200`. The response body includes the aggregated status, service name, timestamp, and per-check details. An optional `/details` endpoint returns raw results when `includeDetails` is enabled.

#### API Reference

**Signature:**
```ts
function createHealthRoute(registry: HealthRegistry, options?: HealthRouteOptions): (server: HealthServer) => Promise<void>
```

**`HealthRouteOptions`:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | `string` | `"/health"` | Health route path |
| `serviceName` | `string` | `"app"` | Service name in response |
| `includeDetails` | `boolean` | `false` | Include `/details` sub-route |

**`HealthServer` interface:**

| Method | Description |
|--------|-------------|
| `get(path, handler)` | Register a GET route handler |
| `decorate(name, value)` | Decorate the server instance |

**Response body:**
```json
{
  "service": "app",
  "status": "healthy",
  "timestamp": "2026-01-15T10:30:00Z",
  "checks": {
    "db": { "status": "healthy", "latency": 12 },
    "cache": { "status": "degraded", "latency": 45 }
  }
}
```

**Error codes:** None (route never throws; failures map to 503).

#### Implementation Examples

```ts
import { createApp, createHealthRegistry, createHealthRoute } from '@oneunit/core';

const app = createApp({ serviceName: 'api' });
const registry = createHealthRegistry();
registry.register({
  name: 'system',
  check: async () => ({ status: 'healthy' }),
});

const healthRoute = createHealthRoute(registry, { path: '/health', serviceName: 'api' });
await healthRoute(server);

// curl http://localhost:3000/health
// 200: {"status":"healthy","checks":{...},"timestamp":"..."}
// 503: {"status":"unhealthy","checks":{...},"timestamp":"..."}
```

---

### 1.3 Health Providers

**File:** `src/health/provider.ts`, `src/health/system-health.ts`

#### Functional Description

Health providers are pre-built `HealthCheck` callables for common infrastructure dependencies. `createHealthProvider` is the generic factory. Specialized providers wrap a user-supplied probe function and translate success/failure into `HealthCheckResult`. System/Docker/Kubernetes providers probe actual infrastructure and return health status based on thresholds and connectivity.

#### API Reference

**`createHealthProvider(name, check, critical?)`:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | yes | — | Provider/check name |
| `check` | `() => HealthCheckResult \| Promise<HealthCheckResult>` | yes | — | Probe function |
| `critical` | `boolean` | no | `false` | Whether failure is critical |

**Built-in providers:**

| Provider | Signature | Description |
|----------|-----------|-------------|
| `createDatabaseHealthProvider` | `(check, critical?)` | Pings a SQL database via user-supplied check |
| `createRedisHealthProvider` | `(check, critical?)` | Pings Redis via user-supplied check |
| `createKafkaHealthProvider` | `(check, critical?)` | Metadata fetch from Kafka via user-supplied check |
| `createSystemHealthProvider` | `(options?)` | CPU/memory usage against thresholds |
| `createDockerHealthProvider` | `(options?)` | Docker daemon ping (socket or CLI) |
| `createKubernetesHealthProvider` | `(options?)` | Kubernetes API health (kubectl or in-cluster) |

**System/Docker/Kubernetes provider options:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `critical` | `boolean` | `false` | Whether failure is critical |
| `thresholds` | `SystemThresholds` | `DEFAULT_THRESHOLDS` | System provider thresholds |
| `timeoutMs` | `number` | `3000` | Docker/K8s probe timeout |
| `includeContainers` | `boolean` | `false` | Docker: include container list |
| `includePods` | `boolean` | `false` | K8s: include pod list |

**`DEFAULT_THRESHOLDS` (Lib):**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `memory.degraded` | `number` | `75` | Memory usage % degraded threshold |
| `memory.unhealthy` | `number` | `90` | Memory usage % unhealthy threshold |
| `load.degraded` | `number` | `0.7` | Normalized load average degraded threshold |
| `load.unhealthy` | `number` | `1` | Normalized load average unhealthy threshold |

**Error codes:** None.

#### Implementation Examples

**Basic usage:**
```ts
import { createRedisHealthProvider } from '@oneunit/core/health';

const redis = createRedisHealthProvider(async () => {
  // your Redis PING logic
  await redisClient.ping();
});
const result = await redis();
console.log(result.status); // 'healthy' | 'degraded' | 'unhealthy'
```

**Advanced usage (register all providers):**
```ts
const health = app.health();
health.register('database', createDatabaseHealthProvider(async () => {
  await db.query('SELECT 1');
}));
health.register('redis', createRedisHealthProvider(async () => {
  await redisClient.ping();
}));
health.register('system', createSystemHealthProvider());
health.register('docker', createDockerHealthProvider({ includeContainers: true }));
health.register('kubernetes', createKubernetesHealthProvider({ namespace: 'default' }));
```

---

### 1.4 Environment Detection

**File:** `src/health/system-health.ts`

#### Functional Description

`detectHealthEnvironment()` inspects environment variables and mounted filesystems to determine the runtime environment: Docker (`/var/run/docker.sock`), Kubernetes (`KUBERNETES_SERVICE_HOST`), or system (always true). Returns a `DetectedHealthEnvironment` object with boolean flags for each.

#### API Reference

**Signature:**
```ts
function detectHealthEnvironment(): DetectedHealthEnvironment
```

**`DetectedHealthEnvironment`:**

| Field | Type | Description |
|-------|------|-------------|
| `system` | `boolean` | Always `true` |
| `docker` | `boolean` | Docker socket present |
| `kubernetes` | `boolean` | `KUBERNETES_SERVICE_HOST` env set |

**`detectHealthEnvironmentAsync(timeoutMs?)`:** Async version that actively probes Docker socket and K8s API.

**Error codes:** None (fallback-safe; defaults to system-only).

#### Implementation Examples

```ts
import { detectHealthEnvironment } from '@oneunit/core/health';

const env = detectHealthEnvironment();
console.log(env); // { system: true, docker: false, kubernetes: false }

// Via app.health()
const env2 = app.health().detectEnvironment();
```

---

### 1.5 Health Factory Helpers

**File:** `src/health/health-factory.ts`

#### Functional Description

`createHealth()` builds a complete health facade (registry + register + check + route) in one call. `registerHealth()` creates the facade and immediately registers the route on a server. Framework-specific health adapters (`ExpressHealthAdapter`, `FastifyHealthAdapter`, `KoaHealthAdapter`, `HttpHealthAdapter`) are also available under `src/adapters/health/`.

#### API Reference

**`createHealth(options?)`:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `serviceName` | `string` | `"app"` | Service name in response |
| `path` | `string` | `"/health"` | Health route path |

**Returns:**
| Member | Type | Description |
|--------|------|-------------|
| `registry` | `HealthRegistry` | The underlying registry |
| `register(provider)` | `(provider: HealthProvider) => void` | Register a provider |
| `check()` | `() => Promise<Record<string, HealthCheckResult>>` | Run all checks |
| `route(server)` | `(server: HealthServer) => Promise<void>` | Mount health route |

**`registerHealth(server, options?)`:** Creates health facade, mounts route, returns the facade.

#### Implementation Examples

```ts
import { createHealth } from '@oneunit/core/health';

const health = createHealth({ serviceName: 'api', path: '/health' });
health.register({
  name: 'db',
  check: async () => ({ status: 'healthy' }),
});

// Mount on a framework server
await health.route(server);
```

---

## 2. Hooks

The Hooks component is a typed event listener registry supporting `on`, `use`, `off`, `once`, `emit`, `emitSync`, `has`, `listeners`, `listenerCount`, `clear`, `clearHook`, `toJSON`, `supportedHooks`, `isSupported`, plus `createHooksWithDefaults`, `DEFAULT_HOOKS`, and `throwOnError` behavior.

### 2.1 Hooks API

**File:** `src/hooks/registery.ts`

#### Functional Description

Hooks is a typed event emitter. Listeners are registered via `on`/`use`/`once`, triggered via `emit` (async, sequential) or `emitSync` (sync, sequential). `once` listeners auto-remove after first invocation. `off` removes specific listeners; `clear`/`clearHook` bulk-remove. `throwOnError` controls whether listener errors propagate or are caught and stored. Serialization (`toJSON`) and introspection (`has`, `listeners`, `listenerCount`) support debugging. `allowedHooks` restricts which event names may be used.

Each listener receives a single `context` argument and returns `void | Promise<void>`.

#### API Reference

**Signature:**
```ts
function createHooks<Context = unknown>(options?: HooksOptions): Hooks<Context>
```

**`HooksOptions`:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `throwOnError` | `boolean` | no | `false` | Propagate listener errors instead of swallowing |
| `allowedHooks` | `readonly string[]` | no | `null` | Restrict allowed event names |

**`Hooks<Context, HookName>` methods:**

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `on(name, listener)` | `name: HookName`, `listener: HookListener<Context>` | `Hooks` | Register a listener (chainable) |
| `use(name, listener)` | `name: HookName`, `listener: HookListener<Context>` | `Hooks` | Alias for `on` |
| `off(name, listener)` | `name: HookName`, `listener: HookListener<Context>` | `Hooks` | Remove a specific listener |
| `once(name, listener)` | `name: HookName`, `listener: HookListener<Context>` | `Hooks` | One-time listener (auto-removed) |
| `emit(name, context)` | `name: HookName`, `context: Context` | `Promise<void>` | Async emit (sequential) |
| `emitSync(name, context)` | `name: HookName`, `context: Context` | `void` | Sync emit (sequential) |
| `getErrors()` | none | `Error[]` | Caught listener errors |
| `has(name)` | `name: HookName` | `boolean` | Whether event has listeners |
| `listeners(name)` | `name: HookName` | `HookListener<Context>[]` | Listeners for event |
| `listenerCount(name)` | `name: HookName` | `number` | Listener count for event |
| `clear()` | none | `Hooks` | Remove all listeners |
| `clearHook(name)` | `name: HookName` | `Hooks` | Remove listeners for event |
| `toJSON()` | none | `Record<string, number>` | Event → listener count map |
| `supportedHooks()` | none | `readonly string[]` | Allowed or default hook names |
| `isSupported(name)` | `name: string` | `boolean` | Whether name is a supported hook |

**`HookListener` type:**
```ts
type HookListener<Context = unknown> = (context: Context) => void | Promise<void>;
```

**`throwOnError` behavior:**
- `false` (default): listener errors are caught, stored via `getErrors()`, and execution continues; `emit`/`emitSync` do not throw.
- `true`: listener errors propagate out of `emitSync`; `emit` throws on the first error.

**`once` listener wrapper removal:**
`once` wraps the listener so it is removed via `off` immediately before the listener is invoked (the wrapper removes itself, then calls the inner listener).

#### Implementation Examples

**Basic usage:**
```ts
import { createHooks } from '@oneunit/core/hooks';

const hooks = createHooks();

hooks.on('start', (service) => {
  console.log(`${service} started`);
});

await hooks.emit('start', 'billing');
// 'billing started'

console.log(hooks.listenerCount('start')); // 1
```

**Advanced usage (once + throwOnError):**
```ts
const hooks = createHooks({ throwOnError: true, allowedHooks: ['init', 'start'] });

let count = 0;
hooks.once('init', async (context) => {
  count += 1;
  console.log('init', context);
});

await hooks.emit('init', { service: 'billing' });
await hooks.emit('init', { service: 'billing' }); // wrapper already removed; does not run again
console.log(count); // 1
```

---

### 2.2 Default Hooks

**File:** `src/hooks/default-hooks.ts`

#### Functional Description

`DEFAULT_HOOKS` defines canonical event names used across the platform. `createHooksWithDefaults()` builds a hooks instance with `allowedHooks` set to `DEFAULT_HOOKS`, so services share a consistent event vocabulary and unknown hooks are rejected.

#### API Reference

**`DEFAULT_HOOKS` groups:**

| Group | Events |
|-------|--------|
| `APPLICATION_HOOKS` | `init`, `start`, `ready`, `shutdown` |
| `LIFECYCLE_HOOKS` | `request`, `beforeParse`, `afterParse`, `beforeValidation`, `afterValidation`, `beforeAuth`, `afterAuth`, `beforeHandler`, `afterHandler`, `beforeSerialize`, `beforeSend`, `afterSend`, `response`, `error`, `notFound`, `timeout` |
| `SERVER_HOOKS` | `beforeListen`, `afterListen`, `beforeClose`, `afterClose` |
| `CACHE_HOOKS` | `cacheHit`, `cacheMiss` |
| `CONNECTION_HOOKS` | `connection`, `disconnection` |

**`createHooksWithDefaults(options?)`:** Returns `Hooks<Context, DefaultHookName>` with `allowedHooks` set to `DEFAULT_HOOKS`.

**Type exports:** `DefaultHookName`, `ApplicationHookName`, `LifecycleHookName`, `ServerHookName`, `CacheHookName`, `ConnectionHookName`.

#### Implementation Examples

```ts
import { createHooksWithDefaults, DEFAULT_HOOKS } from '@oneunit/core/hooks';

console.log(DEFAULT_HOOKS[0]); // 'init'

const hooks = createHooksWithDefaults({ throwOnError: true });
hooks.on('server', (event) => console.log('server', event));
await hooks.emit('server', 'listening');
```

---

## 3. Lib

The Lib component is a utility library providing byte/time formatting, timestamps, system introspection, and system status evaluation. It includes `formatBytes`, `formatTime`, `timestamp`, `getSystemInfo`, `getSystemStatus` (with `DEFAULT_THRESHOLDS`), plus Docker/Kubernetes probing utilities.

### 3.1 `formatBytes`

**File:** `src/lib/formatter.ts`

#### Functional Description

`formatBytes` converts a byte count into a human-readable string using binary (1024-based) units. It throws typed errors for non-finite or negative input.

#### API Reference

**Signature:**
```ts
function formatBytes(bytes: number, decimals?: number): string
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `bytes` | `number` | yes | — | Byte count |
| `decimals` | `number` | no | `2` | Decimal places |

**Returns:** `string` (e.g., `"1.5 KB"`).

**Error codes:**
| Code | Meaning |
|------|---------|
| `INVALID_BYTES` | `bytes` is not a finite number |
| `NEGATIVE_BYTES` | `bytes` is negative |

#### Implementation Examples

```ts
import { formatBytes } from '@oneunit/core/lib';

console.log(formatBytes(1536));          // '1.5 KB'
console.log(formatBytes(1536, 0));       // '2 KB'
console.log(formatBytes(1048576));       // '1 MB'
```

---

### 3.2 `formatTime`

**File:** `src/lib/formatter.ts`

#### Functional Description

`formatTime` formats a duration in milliseconds into a human-readable string. It uses `ms`/`s`/`m`/`h`/`d`/`y` suffixes depending on magnitude.

#### API Reference

**Signature:**
```ts
function formatTime(ms: number): string
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ms` | `number` | yes | Duration in milliseconds |

**Returns:** `string` (e.g., `"1.5m"`).

**Error codes:**
| Code | Meaning |
|------|---------|
| `INVALID_TIME` | `ms` is not a finite number |
| `NEGATIVE_TIME` | `ms` is negative |

#### Implementation Examples

```ts
import { formatTime } from '@oneunit/core/lib';

console.log(formatTime(25));      // '25ms'
console.log(formatTime(1500));    // '1.5s'
console.log(formatTime(90000));   // '1.5m'
console.log(formatTime(7200000)); // '2h'
```

---

### 3.3 `timestamp`

**File:** `src/lib/formatter.ts`

#### Functional Description

`timestamp` formats a `Date` object into an ISO-8601 string.

#### API Reference

**Signature:**
```ts
function timestamp(data: Date): string
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | `Date` | yes | The Date object to format |

**Returns:** `string` (ISO-8601, e.g. `"2022-01-01T00:00:00.000Z"`).

**Error codes:**
| Code | Meaning |
|------|---------|
| `INVALID_DATE` | `data` is not a `Date` object |

#### Implementation Examples

```ts
import { timestamp } from '@oneunit/core/lib';

console.log(timestamp(new Date())); // "2022-01-01T00:00:00.000Z"
```

---

### 3.4 `getSystemInfo`

**File:** `src/lib/system.ts`

#### Functional Description

`getSystemInfo` gathers detailed OS/process/memory/CPU/network/user information. All byte values are human-readable strings via `formatBytes`; numeric values (uptime, load average, cores) are numbers.

#### API Reference

**Signature:**
```ts
function getSystemInfo(): SystemInfo
```

**`SystemInfo` interface:**

| Field | Type | Description |
|-------|------|-------------|
| `process.pid` | `number` | Process ID |
| `process.ppid` | `number` | Parent process ID |
| `process.node` | `string` | `process.version` |
| `process.version` | `string` | `process.versions.node` |
| `process.environment` | `string` | `NODE_ENV` or `"unknown"` |
| `process.uptime` | `string` | Formatted process uptime |
| `performance.startupTime` | `string` | Time since module load |
| `performance.systemUptime` | `string` | Formatted OS uptime |
| `performance.timestamp` | `string` | ISO-8601 timestamp |
| `memory.total` | `string` | Total system memory |
| `memory.free` | `string` | Free system memory |
| `memory.used` | `string` | Used system memory |
| `memory.usagePercent` | `number` | Memory usage percentage |
| `memory.process.rss` | `string` | Process RSS |
| `memory.process.heapTotal` | `string` | Process heap total |
| `memory.process.heapUsed` | `string` | Process heap used |
| `memory.process.external` | `string` | Process external memory |
| `memory.process.arrayBuffers` | `string` | Process array buffers |
| `cpu.architecture` | `string` | `os.arch()` |
| `cpu.platform` | `string` | `os.platform()` |
| `cpu.model` | `string` | CPU model |
| `cpu.cores` | `number` | CPU core count |
| `cpu.loadAverage.oneMinute` | `number` | 1-minute load average |
| `cpu.loadAverage.fiveMinutes` | `number` | 5-minute load average |
| `cpu.loadAverage.fifteenMinutes` | `number` | 15-minute load average |
| `network` | `NetworkInterfaceInfo[]` | `os.networkInterfaces()` |
| `user.username` | `string` | OS username |
| `user.uid` | `number` | User UID |
| `user.gid` | `number` | User GID |
| `user.shell` | `unknown` | User shell |
| `user.homedir` | `string` | User home directory |

#### Implementation Examples

```ts
import { getSystemInfo } from '@oneunit/core/lib';

const info = getSystemInfo();
console.log(info.process.node);
console.log(info.memory.usagePercent);
console.log(info.cpu.cores);
```

---

### 3.5 `getSystemStatus`

**File:** `src/lib/system-status.ts`

#### Functional Description

`getSystemStatus` evaluates system health against configurable thresholds. Dependency failure (any check with `status: false`) immediately returns `"unhealthy"`. Critical resource pressure (memory or load above unhealthy threshold) returns `"unhealthy"`. Elevated pressure returns `"degraded"`. Otherwise returns `"healthy"`.

#### API Reference

**Signature:**
```ts
function getSystemStatus(system: SystemMetrics, checks: HealthChecks, thresholds?: SystemThresholds): SystemStatus
```

**`SystemMetrics`:**

| Field | Type | Description |
|-------|------|-------------|
| `memory.usagePercent` | `number` | Memory usage percentage |
| `cpu.cores` | `number` | CPU core count |
| `cpu.loadAverage.oneMinute` | `number` | 1-minute load average |

**`HealthCheck`:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | `boolean` | Check passed? |
| `latency?` | `number` | Check duration in ms |
| `message?` | `string` | Check message |

**`HealthChecks`:** `Record<string, HealthCheck>`

**`SystemThresholds`:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `memory.degraded` | `number` | `75` | Memory degraded threshold |
| `memory.unhealthy` | `number` | `90` | Memory unhealthy threshold |
| `load.degraded` | `number` | `0.7` | Load degraded threshold |
| `load.unhealthy` | `number` | `1` | Load unhealthy threshold |

**Returns:** `SystemStatus` = `"healthy" \| "degraded" \| "unhealthy"`

**`DEFAULT_THRESHOLDS`:**
```ts
{
  memory: { degraded: 75, unhealthy: 90 },
  load: { degraded: 0.7, unhealthy: 1 },
}
```

#### Implementation Examples

```ts
import { getSystemStatus, DEFAULT_THRESHOLDS } from '@oneunit/core/lib';

const status = getSystemStatus(
  {
    memory: { usagePercent: 50 },
    cpu: { cores: 4, loadAverage: { oneMinute: 0.5 } },
  },
  { db: { status: true }, cache: { status: true } },
  DEFAULT_THRESHOLDS,
);
console.log(status); // 'healthy'
```

---

### 3.6 Docker / Kubernetes Probing

**File:** `src/lib/docker.ts`, `src/lib/kubernetes.ts`

#### Functional Description

`pingDocker` probes the Docker daemon via socket (`/var/run/docker.sock`) then falls back to the `docker` CLI. `listDockerContainers` lists running containers via `docker ps`. `pingKubernetes` probes via `kubectl` then falls back to the in-cluster Kubernetes API. `listK8sPods` lists pods via `kubectl get pods`.

#### API Reference

| Function | Signature | Returns |
|----------|-----------|---------|
| `pingDocker` | `(timeoutMs?)` | `Promise<{ ok, version?, error?, source? }>` |
| `listDockerContainers` | `(timeoutMs?)` | `Promise<{ ok, containers: DockerContainerInfo[], error? }>` |
| `pingKubernetes` | `(timeoutMs?)` | `Promise<{ ok, version?, context?, error?, source? }>` |
| `listK8sPods` | `(timeoutMs?)` | `Promise<{ ok, pods: K8sPodInfo[], error? }>` |

**Defaults:** `timeoutMs` is `3000` for Docker, `5000` for Kubernetes.

**Error codes:** None (failures return `ok: false` with an `error` string).

#### Implementation Examples

```ts
import { pingDocker, pingKubernetes } from '@oneunit/core/lib';

const docker = await pingDocker();
console.log(docker.ok, docker.version);

const k8s = await pingKubernetes();
console.log(k8s.ok, k8s.source);
```

---

## 4. Lifecycle

The Lifecycle component manages application lifecycle phases, middleware chains, and plugins. It supports three modes (`easy`/`advanced`/`strict`), a `LifecycleManager`, middleware/plugin registration, middleware chains, hook execution, plugin contexts, and framework middleware adapters.

### 4.1 Lifecycle Mode

**File:** `src/lifecycle/types.ts`

#### Functional Description

`LifecycleMode` governs how strictly the lifecycle enforces ordering, conflict detection, and safety:

- `easy`: permissive, auto-registers essential middleware, throws on errors.
- `advanced`: standard validation, conflict warnings, explicit registration required (default).
- `strict`: full validation, conflicts throw, execution timeout 2s, max 20 middleware/plugins.

#### API Reference

**`LifecycleMode`:**
```ts
type LifecycleMode = "easy" | "advanced" | "strict";
```

**Mode defaults:**

| Field | easy | advanced | strict |
|-------|------|----------|--------|
| `mode` | `"easy"` | `"advanced"` | `"strict"` |
| `executionTimeoutMs` | `5000` | `5000` | `2000` |
| `throwOnError` | `true` | `false` | `true` |
| `maxMiddleware` | `50` | `50` | `20` |
| `maxPlugins` | `50` | `50` | `20` |
| `autoRegisterEssential` | `true` | `false` | `false` |

**`LIFECYCLE_MODES`:** `["easy", "advanced", "strict"]`

**`ESSENTIAL_MIDDLEWARE_TYPES`:** `["cors", "csrf", "helmet", "compression", "sanitize", "multipart"]`

---

### 4.2 LifecycleManager

**File:** `src/lifecycle/manager.ts`

#### Functional Description

`LifecycleManager` is the core lifecycle engine. It manages middleware and plugin registrations, detects conflicts, executes middleware chains by name or all-at-once, executes plugin hooks, and provides validation reports. It is initialized automatically when created via `createApp`.

#### API Reference

**Constructor:**
```ts
new LifecycleManager(options?: LifecycleOptions)
```

**`LifecycleOptions`:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `mode` | `LifecycleMode` | no | `"advanced"` | Lifecycle strictness |
| `executionTimeoutMs` | `number` | no | `5000` | Timeout per execution |
| `throwOnError` | `boolean` | no | `false` | Throw on middleware/plugin errors |
| `maxMiddleware` | `number` | no | `50` | Max middleware per namespace |
| `maxPlugins` | `number` | no | `50` | Max plugins |
| `allowedMiddlewareTypes` | `string[]` | no | `[]` | Allowed types in easy mode |
| `autoRegisterEssential` | `boolean` | no | `false` | Auto-register essential middleware |

**`LifecycleManager` methods:**

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getMode()` | none | `LifecycleMode` | Current mode |
| `setMode(mode)` | `mode: LifecycleMode` | `{ success, conflicts, error? }` | Change mode |
| `initialize()` | none | `{ success, conflicts, error? }` | Initialize lifecycle |
| `registerMiddleware(name, type, middleware, opts?)` | name, type, handler, options | `{ success, conflicts, headerConflicts, error? }` | Register middleware |
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
| `createLifecycleMiddleware(framework?)` | `framework?: "express" \| "fastify" \| "koa" \| "http"` | `(req, res, next) => void` | Framework middleware |

**`MiddlewareRegistration`:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | yes | — | Middleware name |
| `type` | `string` | yes | — | Middleware type |
| `middleware` | `(_req, _res, _next?) => void \| Promise<void>` | yes | — | Handler function |
| `priority` | `number` | no | `0` | Execution order |
| `conflictTypes?` | `string[]` | no | `[]` | Conflicting types |
| `version` | `string` | no | `"1.0.0"` | Middleware version |
| `trackHeaders?` | `string[]` | no | `undefined` | Headers to track |

**`PluginRegistration`:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | yes | — | Plugin name |
| `namespace` | `string` | yes | — | Plugin namespace |
| `hooks` | `Record<string, Array<(_context) => void \| Promise<void>>>` | yes | — | Hook handlers |
| `priority` | `number` | no | `0` | Execution priority |
| `version` | `string` | no | `"1.0.0"` | Plugin version |

**`MiddlewareResult`:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Execution succeeded |
| `aborted` | `boolean` | Chain was aborted |
| `error?` | `Error` | Error if failed |
| `durationMs` | `number` | Execution duration |

**`PluginResult`:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Execution succeeded |
| `error?` | `Error` | Error if failed |
| `durationMs` | `number` | Execution duration |

**`MiddlewareContext`:**

| Field | Type | Description |
|-------|------|-------------|
| `req` | `unknown` | Request object |
| `res` | `unknown` | Response object |
| `next` | `() => void` | Chain continuation |
| `phase` | `"request" \| "response" \| "error"` | Execution phase |
| `abort` | `() => void` | Abort the chain |
| `aborted` | `boolean` | Whether aborted |

**`PluginContext`:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Plugin name |
| `namespace` | `string` | Plugin namespace |
| `emit` | `(_event, _data) => void` | Emit lifecycle hook |
| `on` | `(_event, _listener) => void` | Register hook listener |

**`ConflictInfo`:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"middleware" \| "plugin" \| "hook"` | Conflict type |
| `name` | `string` | Conflicting item name |
| `conflictWith` | `string[]` | Items it conflicts with |
| `reason` | `string` | Conflict reason |
| `severity` | `"warning" \| "error"` | Conflict severity |

**`HeaderConflict`:**

| Field | Type | Description |
|-------|------|-------------|
| `header` | `string` | Header name |
| `setBy` | `string[]` | Middleware setting the header |
| `severity` | `"warning" \| "error"` | Conflict severity |

**`LifecycleState`:**

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `LifecycleMode` | Current mode |
| `initialized` | `boolean` | Whether initialized |
| `middlewareCount` | `number` | Registered middleware count |
| `pluginCount` | `number` | Registered plugin count |
| `conflicts` | `ConflictInfo[]` | Detected conflicts |
| `headerConflicts` | `HeaderConflict[]` | Header conflicts |
| `executionCount` | `number` | Total executions |
| `errorCount` | `number` | Total errors |

#### Implementation Examples

**Basic usage:**
```ts
import { createApp } from '@oneunit/core';

const app = createApp({ lifecycle: { mode: 'advanced' } });
const lifecycle = app.lifecycle();

await lifecycle.initialize();
console.log(lifecycle.getMode()); // 'advanced'
```

**Middleware registration:**
```ts
lifecycle.registerMiddleware('logger', 'http', async (ctx) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  await ctx.next();
}, { priority: 10 });

const result = await lifecycle.executeMiddleware('logger', req, res, 'request');
console.log(result.success); // true
```

**Plugins:**
```ts
lifecycle.registerPlugin('auth', 'security', {
  beforeAuth: [(ctx) => { /* load user */ }],
  afterAuth: [(ctx) => { /* log */ }],
});

console.log(lifecycle.getPluginList()); // [{ name: 'auth', namespace: 'security', ... }]
```

**Isolated lifecycle:**
```ts
import { LifecycleManager } from '@oneunit/core/lifecycle';

const isolated = new LifecycleManager({ mode: 'easy', namespace: 'jobs' });
isolated.initialize();
console.log(isolated.getNamespaces()); // []
```

---

## 5. MsgPack

The MsgPack component provides binary serialization using the `@msgpack/msgpack` library. It exposes `encode`, `decode`, `encodeSync`, `decodeSync` plus `MsgPackOptions` for codec configuration. All operations are synchronous (the underlying library is synchronous; `encodeSync`/`decodeSync` are aliases).

### 5.1 MsgPack API

**File:** `src/msgpack/registery.ts`

#### Functional Description

`createMsgPack` creates a `MsgPack` instance that wraps `@msgpack/msgpack`'s `encode`/`decode` with `@oneunit/core` options. `encode`/`decode` are synchronous and return `Uint8Array`/`T` directly. Supports custom extension codecs, bigint handling, key sorting, depth limits, and buffer sizing.

#### API Reference

**Signature:**
```ts
function createMsgPack(config?: MsgPackConfig): MsgPack
```

**`MsgPack` methods:**

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `encode(value, options?)` | `value: unknown` | `Uint8Array` | Encode value to MessagePack bytes |
| `decode<T>(data, options?)` | `data: Uint8Array \| ArrayBuffer` | `T` | Decode MessagePack bytes |
| `encodeSync(value, options?)` | `value: unknown` | `Uint8Array` | Sync encode (alias for `encode`) |
| `decodeSync<T>(data, options?)` | `data: Uint8Array \| ArrayBuffer` | `T` | Sync decode (alias for `decode`) |

**`MsgPackOptions`:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `forceFloat32` | `boolean` | no | `false` | Encode floats as 32-bit |
| `useBigInt64` | `boolean` | no | `false` | Encode bigints as BigInt64 |
| `sortKeys` | `boolean` | no | `false` | Sort object keys |
| `ignoreUndefined` | `boolean` | no | `false` | Skip undefined values |
| `forceIntegerToFloat` | `boolean` | no | `false` | Encode integers as float |
| `maxDepth` | `number` | no | `100` | Max nesting depth |
| `initialBufferSize` | `number` | no | `2048` | Initial encode buffer bytes |
| `extensionCodec` | `ExtensionCodecType` | no | `undefined` | Custom extension codec |

**`DEFAULT_MSGPACK_CONFIG`:**
```ts
{
  forceFloat32: false,
  useBigInt64: false,
  sortKeys: false,
  ignoreUndefined: false,
  forceIntegerToFloat: false,
  maxDepth: 100,
  initialBufferSize: 2048,
}
```

**`mergeMsgPackConfig(defaults, overrides)`:** Merges per-call options over instance defaults.

**Error codes:** None (errors propagate from `@msgpack/msgpack`).

#### Implementation Examples

**Basic usage:**
```ts
import { createApp } from '@oneunit/core';

const app = createApp();
const msgpack = app.msgpack();

const obj = { name: 'billing', version: 1, tags: ['a', 'b'] };
const bytes = msgpack.encodeSync(obj);
console.log(bytes instanceof Uint8Array); // true

const decoded = msgpack.decodeSync(bytes);
console.log(decoded); // { name: 'billing', version: 1, tags: ['a', 'b'] }
```

**Advanced usage (options):**
```ts
const bytes = msgpack.encode(obj, { sortKeys: true, forceFloat32: true });
const decoded = msgpack.decode(bytes, { ignoreUndefined: true });
```

**BigInt handling:**
```ts
const big = { id: 12345678901234567890n };
const bytes = msgpack.encodeSync(big, { useBigInt64: true });
const decoded = msgpack.decodeSync(bytes);
console.log(typeof decoded.id); // 'bigint'
```

**Direct import:**
```ts
import { createMsgPack, DEFAULT_MSGPACK_CONFIG, mergeMsgPackConfig } from '@oneunit/core/msgpack';

const mp = createMsgPack({ maxDepth: 50 });
```

---

## Error Code Summary (Part 2)

| Component | Code | Meaning |
|-----------|------|---------|
| Lib | `INVALID_BYTES` | Bytes not finite |
| Lib | `NEGATIVE_BYTES` | Bytes negative |
| Lib | `INVALID_TIME` | Time not finite |
| Lib | `NEGATIVE_TIME` | Time negative |
| Lib | `INVALID_DATE` | Invalid date |

Health, Hooks, Lifecycle, and MsgPack do not define their own coded errors; failures are returned as results or thrown as standard `Error` instances.

---

*End of Part 2 — Feature-Level Documentation for @oneunit/core v1.0.0.*
