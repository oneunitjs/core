# Lifecycle — Usage Guide

@oneunit/core v1.0.0

## Overview

Lifecycle is a middleware and plugin management system for the `@oneunit/core` package. It manages registration, execution, and conflict detection across three operational modes: easy, advanced, and strict.

Lifecycle solves three core problems:

1. **Registration order management** — middleware and plugins are assigned priorities so execution order is deterministic.
2. **Conflict detection** — certain middleware types cannot coexist (for example, two CORS handlers), and Lifecycle detects and reports these conflicts before they cause runtime failures.
3. **Namespace isolation** — plugins are registered under namespaces, allowing independent plugin sets to execute without interfering with each other.

Who it's for:

- Application developers who need a consistent way to register and run middleware across request phases.
- Plugin authors who need isolated hook execution with event emission and listening.
- Framework integrators who want to expose Lifecycle as Express, Fastify, Koa, or Node http middleware.

## Quick Start

Register a CORS middleware and execute it on a request:

```js
import { createLifecycle } from '@oneunit/core';

const lifecycle = createLifecycle({ mode: 'easy' });

lifecycle.registerMiddleware('cors', 'cors', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, { priority: 10 });

const result = await lifecycle.executeMiddleware('cors', req, res, 'request');

if (result.success) {
  console.log('Middleware executed in', result.durationMs, 'ms');
}
```

## Lifecycle Modes

Lifecycle operates in one of three modes. The mode controls default safety behavior such as whether errors are thrown, whether essential middleware is auto-registered, and execution limits.

| Mode | throwOnError | autoRegisterEssential | executionTimeoutMs | maxMiddleware | maxPlugins | Default |
|------|--------------|----------------------|--------------------|---------------|------------|---------|
| easy | true | true | 5000 | 50 | 50 | No |
| advanced | false | false | 5000 | 50 | 50 | Yes |
| strict | true | false | 2000 | 20 | 20 | No |

- **easy** — safest for development. Errors are thrown immediately and essential middleware is registered automatically.
- **advanced** — default mode. Errors are reported in results rather than thrown. No automatic registration.
- **strict** — production hardening. Errors are thrown, execution is time-boxed to 2000 ms, and registration caps are lowered to 20 middleware and 20 plugins.

## LifecycleManager Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| mode | `"easy" \| "advanced" \| "strict"` | `"advanced"` | Operational mode. See Lifecycle Modes. |
| executionTimeoutMs | `number` | `5000` | Maximum milliseconds a middleware or hook may execute before timing out. |
| throwOnError | `boolean` | mode-dependent | When true, registration and execution errors are thrown instead of returned in results. |
| maxMiddleware | `number` | `50` | Maximum number of middleware registrations allowed. |
| maxPlugins | `number` | `50` | Maximum number of plugin registrations allowed. |
| allowedMiddlewareTypes | `string[]` | `[]` | When non-empty, only middleware types in this list may be registered. |
| autoRegisterEssential | `boolean` | mode-dependent | When true, essential built-in middleware is registered on initialize. |

Example:

```js
const lifecycle = createLifecycle({
  mode: 'strict',
  executionTimeoutMs: 2000,
  maxMiddleware: 20,
  maxPlugins: 20,
  allowedMiddlewareTypes: ['cors', 'helmet', 'compression'],
});
```

## Lifecycle API

Lifecycle is accessed via `app.lifecycle()` or by creating an isolated instance with `createLifecycle(options?)`.

| Method | Signature | Parameters | Returns |
|--------|-----------|------------|---------|
| mode | `mode(): LifecycleMode` | — | Current mode string. |
| setMode | `setMode(mode): { success, conflicts, error? }` | `mode: LifecycleMode` | Result object; `conflicts` lists type conflicts introduced by the mode change. |
| initialize | `initialize(): { success, conflicts, error? }` | — | Initializes the lifecycle and auto-registers essential middleware when enabled. |
| registerMiddleware | `registerMiddleware(name, type, middleware, options?): { success, conflicts, headerConflicts, error? }` | `name: string`, `type: string`, `middleware: MiddlewareFn`, `options?: MiddlewareOptions` | Registration result. `conflicts` lists conflicting types; `headerConflicts` lists tracked-header overlaps. |
| unregisterMiddleware | `unregisterMiddleware(name): boolean` | `name: string` | `true` if removed, `false` if not found. |
| registerPlugin | `registerPlugin(name, namespace, hooks, options?): { success, conflicts, error? }` | `name: string`, `namespace: string`, `hooks: Record<string, HookFn>`, `options?: object` | Registration result. `conflicts` lists hook conflicts within the namespace. |
| unregisterPlugin | `unregisterPlugin(name, namespace): boolean` | `name: string`, `namespace: string` | `true` if removed, `false` if not found. |
| executeMiddleware | `executeMiddleware(name, req, res, phase): Promise<MiddlewareResult>` | `name: string`, `req`, `res`, `phase: string` | Promise resolving to a single `MiddlewareResult`. |
| executeMiddlewareChain | `executeMiddlewareChain(req, res, phase): Promise<MiddlewareResult[]>` | `req`, `res`, `phase: string` | Promise resolving to results for every registered middleware in priority order. |
| executeHook | `executeHook(hookName, context): Promise<PluginResult[]>` | `hookName: string`, `context: object` | Promise resolving to results for every plugin hook matching `hookName`. |
| executeHookIsolated | `executeHookIsolated(hookName, context, namespace): Promise<PluginResult>` | `hookName: string`, `context: object`, `namespace: string` | Promise resolving to the single plugin result in the given namespace. |
| getState | `getState(): LifecycleState` | — | Snapshot of current lifecycle state. |
| getMiddlewareList | `getMiddlewareList(): MiddlewareRegistration[]` | — | Array of all registered middleware. |
| getPluginList | `getPluginList(): PluginRegistration[]` | — | Array of all registered plugins. |
| getNamespaces | `getNamespaces(): string[]` | — | List of plugin namespaces in use. |
| hasMiddleware | `hasMiddleware(name): boolean` | `name: string` | `true` if middleware with `name` is registered. |
| hasPlugin | `hasPlugin(name, namespace): boolean` | `name: string`, `namespace: string` | `true` if plugin exists in `namespace`. |
| clear | `clear(): void` | — | Removes all middleware and plugin registrations. |
| isSafe | `isSafe(): boolean` | — | `true` when there are no active conflicts or errors. |
| getValidationReport | `getValidationReport(): { safe, conflicts, headerConflicts, warnings, errors }` | — | Full validation report of the current lifecycle state. |
| createPluginContext | `createPluginContext(name, namespace): PluginContext` | `name: string`, `namespace: string` | A `PluginContext` with `emit` and `on` event methods. |
| createLifecycleMiddleware | `createLifecycleMiddleware(framework): function` | `framework: 'express' \| 'fastify' \| 'koa' \| 'http'` | Framework-specific middleware function. |

## Registering Middleware

`registerMiddleware(name, type, middleware, options?)` registers a middleware function under a name and type. The type participates in conflict detection.

Middleware registration options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| priority | `number` | `0` | Execution order; higher priority runs first. |
| conflictTypes | `string[]` | `[]` | Additional types this middleware conflicts with. |
| version | `string` | `"1.0.0"` | Middleware version for reporting. |
| trackHeaders | `string[]` | `[]` | HTTP headers this middleware reads or sets; overlaps are reported as header conflicts. |
| terminal | `boolean` | `false` | When true, stops chain execution after this middleware completes. |

Example:

```js
lifecycle.registerMiddleware('cors', 'cors', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, {
  priority: 100,
  conflictTypes: [],
  version: '2.0.0',
  trackHeaders: ['access-control-allow-origin'],
  terminal: false,
});

lifecycle.registerMiddleware('helmet', 'helmet', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, { priority: 50 });
```

Middleware functions receive `(req, res, next)`. Calling `next()` continues the chain; omitting it aborts the chain.

## Unregistering Middleware

`unregisterMiddleware(name)` removes a middleware registration by name.

```js
const removed = lifecycle.unregisterMiddleware('cors');
// removed === true

const missing = lifecycle.unregisterMiddleware('nonexistent');
// missing === false
```

Unregistering middleware also clears any conflicts and header conflicts associated with that registration.

## Executing Middleware

`executeMiddleware(name, req, res, phase)` runs a single named middleware.

```js
const result = await lifecycle.executeMiddleware('cors', req, res, 'request');

// result: { success: true, aborted: false, durationMs: 2 }
```

`executeMiddlewareChain(req, res, phase)` runs every registered middleware in priority order.

```js
const results = await lifecycle.executeMiddlewareChain(req, res, 'request');

// results: [
//   { success: true, aborted: false, durationMs: 2 },
//   { success: true, aborted: false, durationMs: 1 },
// ]
```

`MiddlewareResult` shape:

```ts
{ success: boolean, aborted: boolean, error?: Error, durationMs: number }
```

If a middleware is terminal and completes successfully, subsequent middleware in the chain are not executed and their results are omitted.

## Registering Plugins

`registerPlugin(name, namespace, hooks, options?)` registers a plugin under a namespace. Plugin hooks are isolated by namespace so plugins in different namespaces do not interfere.

```js
lifecycle.registerPlugin('auth', 'security', {
  onRequest: (ctx) => {
    ctx.emit('authenticated', { user: 'alice' });
  },
  onResponse: (ctx) => {
    // hook logic
  },
});

lifecycle.registerPlugin('logging', 'observability', {
  onRequest: (ctx) => {
    console.log('request received');
  },
});
```

Plugins in different namespaces can both define `onRequest` without conflict. Plugins in the same namespace that define the same hook are reported as conflicts.

## Unregistering Plugins

`unregisterPlugin(name, namespace)` removes a plugin registration.

```js
const removed = lifecycle.unregisterPlugin('auth', 'security');
// removed === true

const missing = lifecycle.unregisterPlugin('auth', 'security');
// missing === false (already removed)
```

## Executing Hooks

`executeHook(hookName, context)` runs every plugin hook matching `hookName` across all namespaces.

```js
const results = await lifecycle.executeHook('onRequest', { req, res });

// results: [
//   { success: true, durationMs: 1 },  // auth plugin
//   { success: true, durationMs: 1 },  // logging plugin
// ]
```

`executeHookIsolated(hookName, context, namespace)` runs the hook for the single plugin in the given namespace.

```js
const result = await lifecycle.executeHookIsolated('onRequest', { req, res }, 'security');

// result: { success: true, durationMs: 1 }
```

`PluginResult` shape:

```ts
{ success: boolean, error?: Error, durationMs: number }
```

## Plugin Context

`createPluginContext(name, namespace)` creates a `PluginContext` with event emission and listening.

```js
const ctx = lifecycle.createPluginContext('auth', 'security');

ctx.on('authenticated', (data) => {
  console.log('user authenticated:', data.user);
});

ctx.emit('authenticated', { user: 'alice' });
```

`PluginContext` shape:

```ts
{ name: string, namespace: string, emit(event: string, data: any): void, on(event: string, listener: (data: any) => void): void }
```

## State & Validation

`getState()` returns a snapshot of the current lifecycle state.

```js
const state = lifecycle.getState();

// state: {
//   mode: 'advanced',
//   middlewareCount: 2,
//   pluginCount: 1,
//   namespaces: ['security', 'observability'],
//   conflicts: [],
//   headerConflicts: [],
//   safe: true,
// }
```

`isSafe()` returns `true` when there are no active conflicts or errors.

```js
const safe = lifecycle.isSafe();
// safe === true
```

`getValidationReport()` returns a full validation report.

```js
const report = lifecycle.getValidationReport();

// report: {
//   safe: true,
//   conflicts: [],
//   headerConflicts: [],
//   warnings: [],
//   errors: [],
// }
```

## Isolated Instances

`createLifecycle(options?)` returns an isolated `LifecycleManager` instance separate from the default lifecycle attached to an app.

```js
import { createLifecycle } from '@oneunit/core';

const apiLifecycle = createLifecycle({ mode: 'strict' });
const adminLifecycle = createLifecycle({ mode: 'easy' });

apiLifecycle.registerMiddleware('cors', 'cors', corsHandler);
adminLifecycle.registerMiddleware('auth', 'auth', authHandler);

// Changes in one instance do not affect the other.
apiLifecycle.clear();
// adminLifecycle still has its auth middleware registered.
```

Use isolated instances when different parts of an application need independent middleware and plugin sets, or when testing lifecycle behavior in isolation.

## Framework Middleware Adapter

`createLifecycleMiddleware(framework)` returns a framework-specific middleware function that executes the lifecycle chain on each request.

Supported frameworks: `express`, `fastify`, `koa`, `http`.

Express:

```js
import { createLifecycle, createLifecycleMiddleware } from '@oneunit/core';
import express from 'express';

const lifecycle = createLifecycle();
const app = express();

app.use(createLifecycleMiddleware('express'));

lifecycle.registerMiddleware('logger', 'logging', (req, res, next) => {
  console.log(req.method, req.url);
  next();
});

app.listen(3000);
```

Fastify:

```js
import { createLifecycle, createLifecycleMiddleware } from '@oneunit/core';
import fastify from 'fastify';

const lifecycle = createLifecycle();
const app = fastify();

app.use(createLifecycleMiddleware('fastify'));

lifecycle.registerMiddleware('logger', 'logging', (req, res, next) => {
  console.log(req.method, req.url);
  next();
});

app.listen({ port: 3000 });
```

Koa:

```js
import { createLifecycle, createLifecycleMiddleware } from '@oneunit/core';
import Koa from 'koa';

const lifecycle = createLifecycle();
const app = new Koa();

app.use(createLifecycleMiddleware('koa'));

lifecycle.registerMiddleware('logger', 'logging', (ctx, next) => {
  console.log(ctx.method, ctx.url);
  next();
});

app.listen(3000);
```

Node http:

```js
import { createLifecycle, createLifecycleMiddleware } from '@oneunit/core';
import http from 'http';

const lifecycle = createLifecycle();
const server = http.createServer(createLifecycleMiddleware('http'));

lifecycle.registerMiddleware('logger', 'logging', (req, res, next) => {
  console.log(req.method, req.url);
  next();
});

server.listen(3000);
```

## Middleware Conflict Matrix

The following middleware types conflict with themselves — the same type cannot be registered more than once:

| Type | Conflicts With |
|------|----------------|
| cors | cors |
| csrf | csrf |
| helmet | helmet |
| compression | compression |
| sanitize | sanitize |
| multipart | multipart |

Additional conflicts can be declared per registration using the `conflictTypes` option. Header conflicts arise when two middleware track the same header via `trackHeaders`.

Example of conflict detection:

```js
const first = lifecycle.registerMiddleware('cors-a', 'cors', handlerA);
// first.success === true

const second = lifecycle.registerMiddleware('cors-b', 'cors', handlerB);
// second.success === false
// second.conflicts includes 'cors'
```

When `throwOnError` is true (easy and strict modes), attempting to register a conflicting type throws an error instead of returning a failure result.

## Best Practices

Do:

- Use `advanced` mode for general application development.
- Use `strict` mode in production to enforce execution timeouts and registration caps.
- Assign meaningful `priority` values so execution order is explicit and deterministic.
- Use `trackHeaders` on middleware that reads or sets response headers to catch header conflicts early.
- Use namespaces to isolate plugins that own different concerns (auth, logging, metrics).
- Prefer `executeHookIsolated` when you need a single namespace's hook result.
- Call `getValidationReport()` during startup to catch conflicts before serving traffic.

Don't:

- Register the same middleware type twice unless you intentionally want conflict errors.
- Rely on auto-registered essential middleware in `advanced` mode; it is disabled by default.
- Register middleware with `terminal: true` unless you are certain later middleware should not run.
- Mix framework adapters on the same server instance; choose one framework per lifecycle.
- Ignore `headerConflicts` in registration results; they indicate overlapping header handling that can cause unpredictable response output.

## Error Handling

Lifecycle errors occur in two phases: registration and execution.

Registration errors are thrown when:

- `throwOnError` is true and a middleware type conflicts with an existing registration.
- `throwOnError` is true and a plugin hook conflicts within the same namespace.
- `allowedMiddlewareTypes` is configured and the middleware type is not in the list.
- Registration exceeds `maxMiddleware` or `maxPlugins`.

Execution errors are thrown when:

- `throwOnError` is true and a middleware or hook throws during execution.
- A middleware or hook exceeds `executionTimeoutMs`.

When `throwOnError` is false (advanced mode default), errors are captured in result objects (`error` field) rather than thrown, and `success` is `false`.

Example of error handling:

```js
try {
  lifecycle.registerMiddleware('cors-duplicate', 'cors', handler);
} catch (err) {
  // thrown only in easy or strict mode
  console.error(err.message);
}
```

In advanced mode, use the result object instead:

```js
const result = lifecycle.registerMiddleware('cors-duplicate', 'cors', handler);

if (!result.success) {
  console.error(result.error?.message);
  console.log('conflicts:', result.conflicts);
}
```
