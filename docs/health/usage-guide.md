# Health — Usage Guide

@oneunit/core v1.0.0

## Overview

The Health feature provides application health monitoring, dependency checks, and HTTP health endpoints. It lets you register custom health checks, use built-in providers for common services (databases, Redis, Kafka, system metrics, Docker, Kubernetes), detect the runtime environment, and expose aggregated health status over HTTP.

Use Health to answer "is my service alive and able to do its job?" — including whether its dependencies (database, cache, message broker) are reachable and whether system resources are within safe thresholds.

## Quick Start

```js
import { createApp } from '@oneunit/core';

const app = createApp();

// Register a custom check
app.health().register('database', async () => {
  // perform your check here
  return { status: 'healthy', message: 'connected' };
});

// Run all checks
const results = await app.health().check();
console.log(results);
// { database: { status: 'healthy', message: 'connected' } }
```

## Health API (app.health())

`app.health()` returns the health registry object with the following methods:

| Method | Signature | Parameters | Returns |
|--------|-----------|------------|---------|
| register | `register(name, check, critical?)` | `name: string`, `check: HealthCheckFunction`, `critical?: boolean` | `void` |
| check | `check()` | none | `Promise<Record<string, HealthCheckResult>>` |
| route | `route(server)` | `server: HealthServer` | `Promise<void>` |
| registerSystem | `registerSystem(options?)` | `options?: SystemHealthOptions` | `void` |
| registerDocker | `registerDocker(options?)` | `options?: DockerHealthOptions` | `void` |
| registerKubernetes | `registerKubernetes(options?)` | `options?: KubernetesHealthOptions` | `void` |
| detectEnvironment | `detectEnvironment()` | none | `DetectedHealthEnvironment` |

### Types

**HealthCheckResult**
| Field | Type | Description |
|-------|------|-------------|
| status | `"healthy" \| "degraded" \| "unhealthy"` | Overall result of the check |
| latency | `number` (ms) | Time the check took to execute |
| message | `string` | Human-readable status message |
| details | `object` | Optional provider-specific details |

**HealthCheckFunction**
`() => Promise<HealthCheckResult> \| HealthCheckResult`

**HealthServer interface**
| Method | Signature | Description |
|--------|-----------|-------------|
| get | `get(path, handler)` | Register an HTTP GET route |
| decorate | `decorate(name, value)` | Attach a value to the server instance |

**DetectedHealthEnvironment**
| Field | Type | Description |
|-------|------|-------------|
| system | `boolean` | Always `true` |
| docker | `boolean` | `true` if Docker is detected |
| kubernetes | `boolean` | `true` if Kubernetes is detected |

**SystemHealthOptions**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| memoryThreshold | `number` | `90` | Memory usage % considered unhealthy |
| loadThreshold | `number` | `1.0` | CPU load average per core considered unhealthy |

**DockerHealthOptions**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| socketPath | `string` | `/var/run/docker.sock` | Path to the Docker socket |

**KubernetesHealthOptions**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| inCluster | `boolean` | `false` | Use in-cluster API configuration |
| kubeconfig | `string` | undefined | Path to kubeconfig file |

## Registering Custom Checks

Use `register(name, check, critical?)` to add a custom health check. `critical` marks whether a failure of this check makes the whole service unhealthy (default: `false`).

```js
const health = app.health();

// Non-critical check — failure degrades but does not take down the service
health.register('cache', async () => {
  const start = process.hrtime.bigint();
  try {
    await redis.ping();
    return { status: 'healthy', message: 'redis reachable' };
  } catch (err) {
    return { status: 'degraded', message: err.message };
  }
}, false);

// Critical check — failure marks the service unhealthy
health.register('database', async () => {
  const client = await db.connect();
  const ok = await client.query('SELECT 1');
  return ok
    ? { status: 'healthy', message: 'database connected' }
    : { status: 'unhealthy', message: 'query failed' };
}, true);

// Synchronous check returning a result directly
health.register('version', () => ({
  status: 'healthy',
  message: 'v1.0.0',
  details: { version: '1.0.0', commit: 'abc123' },
}));
```

Run all registered checks:

```js
const results = await health.check();
// {
//   cache: { status: 'healthy', latency: 4, message: 'redis reachable' },
//   database: { status: 'healthy', latency: 12, message: 'database connected' },
//   version: { status: 'healthy', message: 'v1.0.0' }
// }
```

## Built-in Providers

Use factory functions to create providers for common dependencies, then register them by name.

### createHealthProvider

Generic provider wrapping any async check function.

```js
import { createHealthProvider } from '@oneunit/core';

const mailProvider = createHealthProvider(
  'mail',
  async () => {
    const ok = await smtp.verify();
    return ok
      ? { status: 'healthy', message: 'smtp ready' }
      : { status: 'unhealthy', message: 'smtp unavailable' };
  },
  true // critical
);

health.register(mailProvider.name, mailProvider.check, mailProvider.critical);
```

### createDatabaseHealthProvider

```js
import { createDatabaseHealthProvider } from '@oneunit/core';

const dbProvider = createDatabaseHealthProvider(
  async () => {
    await db.query('SELECT 1');
  },
  true
);

health.register('database', dbProvider.check, dbProvider.critical);
```

### createRedisHealthProvider

```js
import { createRedisHealthProvider } from '@oneunit/core';

const redisProvider = createRedisHealthProvider(
  async () => {
    await redis.ping();
  },
  false
);

health.register('redis', redisProvider.check, redisProvider.critical);
```

### createKafkaHealthProvider

```js
import { createKafkaHealthProvider } from '@oneunit/core';

const kafkaProvider = createKafkaHealthProvider(
  async () => {
    const admin = kafka.admin();
    await admin.connect();
    await admin.fetchTopics();
    await admin.disconnect();
  },
  true
);

health.register('kafka', kafkaProvider.check, kafkaProvider.critical);
```

## System Health

`registerSystem(options?)` registers memory and CPU load checks using `DEFAULT_THRESHOLDS`:

| Metric | degraded | unhealthy |
|--------|----------|-----------|
| memory | 75% | 90% |
| load | 0.7 × cores | 1.0 × cores |

```js
const health = app.health();

// Use defaults
health.registerSystem();

// Custom thresholds
health.registerSystem({
  memoryThreshold: 85, // unhealthy above 85% memory
  loadThreshold: 0.8,  // unhealthy above 0.8 load per core
});

// Run checks
const results = await health.check();
// {
//   system.memory: { status: 'healthy', latency: 2, details: { used: '512MB', total: '8GB', percent: 64 } },
//   system.load: { status: 'healthy', latency: 1, details: { load1: 0.45, cores: 8, loadPerCore: 0.056 } }
// }
```

Memory is unhealthy above 90% (configurable). CPU load is unhealthy when the 1-minute load average exceeds the number of CPU cores (configurable via loadThreshold multiplier).

## Docker & Kubernetes Health

### registerDocker

Pings the Docker socket/CLI to verify the Docker daemon is reachable.

```js
const health = app.health();

// Default socket path
health.registerDocker();

// Custom socket path
health.registerDocker({ socketPath: '/var/run/docker.sock' });

const results = await health.check();
// docker: { status: 'healthy', message: 'docker daemon reachable' }
```

### registerKubernetes

Checks Kubernetes availability via `kubectl` or the in-cluster API.

```js
const health = app.health();

// Out-of-cluster (kubectl / kubeconfig)
health.registerKubernetes();

// In-cluster (when running inside a pod)
health.registerKubernetes({ inCluster: true });

// With explicit kubeconfig path
health.registerKubernetes({ kubeconfig: '/path/to/kubeconfig' });

const results = await health.check();
// kubernetes: { status: 'healthy', message: 'kubernetes api reachable' }
```

## Environment Detection

`detectEnvironment()` returns what the runtime supports. Docker is detected by checking `/var/run/docker.sock` existence; Kubernetes is detected by the `KUBERNETES_SERVICE_HOST` environment variable.

```js
const health = app.health();
const env = health.detectEnvironment();
// { system: true, docker: true, kubernetes: false }

if (env.docker) {
  health.registerDocker();
}
if (env.kubernetes) {
  health.registerKubernetes({ inCluster: true });
}
health.registerSystem();
```

## Health HTTP Route

`route(server)` registers HTTP health endpoints on any server implementing the `HealthServer` interface.

### Response format

`GET /health` returns:

```json
{
  "service": "my-app",
  "status": "healthy",
  "timestamp": "2026-11-19T14:07:51.123Z",
  "checks": {
    "database": { "status": "healthy", "latency": 12, "message": "connected" },
    "redis": { "status": "healthy", "latency": 4, "message": "ping ok" }
  }
}
```

HTTP status: `200` for healthy, `503` for unhealthy. Degraded returns `200`.

### Express example

```js
import express from 'express';
import { createApp } from '@oneunit/core';

const app = createApp();
const expressApp = express();

app.health().register('database', async () => ({ status: 'healthy' }));
await app.health().route(expressApp);

expressApp.listen(3000);
// GET http://localhost:3000/health
```

### Fastify example

```js
import Fastify from 'fastify';
import { createApp } from '@oneunit/core';

const app = createApp();
const fastify = Fastify();

app.health().register('database', async () => ({ status: 'healthy' }));
await app.health().route(fastify);

await fastify.listen({ port: 3000 });
// GET http://localhost:3000/health
```

### Koa example

```js
import Koa from 'koa';
import { createApp } from '@oneunit/core';

const app = createApp();
const koa = new Koa();

app.health().register('database', async () => ({ status: 'healthy' }));
await app.health().route(koa);

koa.listen(3000);
// GET http://localhost:3000/health
```

### Node http example

```js
import http from 'http';
import { createApp } from '@oneunit/core';

const app = createApp();

const server = http.createServer((req, res) => {
  // minimal HealthServer adapter
  const healthServer = {
    get: (path, handler) => {
      if (req.url === path) handler(req, res);
    },
    decorate: (name, value) => { healthServer[name] = value; },
  };
  app.health().route(healthServer);
});

server.listen(3000);
```

### /health/details route

When `includeDetails` is enabled, an additional `GET /health/details` route returns full check details including the `details` field from each result.

```js
await app.health().route(server, { includeDetails: true });

// GET /health/details
// {
//   "service": "my-app",
//   "status": "healthy",
//   "timestamp": "2026-11-19T14:07:51.123Z",
//   "checks": {
//     "database": {
//       "status": "healthy",
//       "latency": 12,
//       "message": "connected",
//       "details": { "poolSize": 10, "active": 2 }
//     }
//   }
// }
```

## Status Aggregation

The overall status is computed from all check results:

| Condition | Overall Status | HTTP Code |
|-----------|----------------|-----------|
| Any check is `unhealthy` | `unhealthy` | 503 |
| No unhealthy, any check is `degraded` | `degraded` | 200 |
| All checks are `healthy` | `healthy` | 200 |
| No checks registered | `healthy` | 200 |

Critical vs non-critical checks affect registration semantics: a failing critical check is reported as `unhealthy`, driving the aggregate to `unhealthy` and HTTP 503. A failing non-critical check is typically `degraded`, driving the aggregate to `degraded` (HTTP 200) unless another check is unhealthy.

## Thresholds

`DEFAULT_THRESHOLDS` used by system health:

| Metric | degraded | unhealthy |
|--------|----------|-----------|
| memory | 75 | 90 |
| load | 0.7 | 1.0 |

Customize via `registerSystem({ memoryThreshold, loadThreshold })`. Thresholds are percentages for memory (0–100) and load-per-core multipliers for CPU (e.g. 1.0 means unhealthy when load average >= core count).

## Best Practices

- Register critical checks for dependencies your service cannot function without (database, message broker).
- Register non-critical checks for optional dependencies (cache, email provider) so a failure degrades rather than takes down the service.
- Keep checks fast; slow checks increase latency and timeout risk. Prefer lightweight ping/query operations.
- Use `detectEnvironment()` to conditionally register Docker/Kubernetes checks only when relevant.
- Expose `/health` on a dedicated port or behind authentication in production.
- Avoid logging sensitive connection details inside check `message` or `details`.
- Do not throw synchronously inside a check function; catch errors and return `{ status: 'unhealthy', message: err.message }`.

## Error Handling

Provider errors are caught automatically. On provider error:

- `status` = `"unhealthy"`
- `message` = error message
- Latency is still measured via `process.hrtime.bigint()`

```js
health.register('flaky', async () => {
  throw new Error('connection refused');
});

// check() returns:
// { flaky: { status: 'unhealthy', message: 'connection refused', latency: 1 } }
```

The registry's `checkAll()` runs all checks in parallel via `Promise.all`. A single provider error does not prevent other checks from running.
