# Adapters — Usage Guide

@oneunit/core v1.0.0

## Overview

The Adapters component implements the Adapter Pattern, placing framework-specific I/O behind unified interfaces so the core library remains transport-agnostic. Instead of coupling your application logic directly to Express, Fastify, Koa, or Node http, you register adapters through a common `AdapterRegistry` and interact with them through framework-neutral contracts.

Four categories of adapters are supported:

- **Cookie adapters** — read, set, and delete cookies across frameworks.
- **Response adapters** — send JSON responses with headers, status codes, and content-type handling.
- **Middleware adapters** — normalize and execute middleware handlers uniformly.
- **Health adapters** — expose health-check registries and provider registration.

An `AdapterRegistry` manages the full adapter lifecycle: registration, lookup, initialization, and disposal.

## Quick Start

Install the package:

```bash
npm install @oneunit/core
```

Import the registry and an adapter, register it, then look it up:

```javascript
import { AdapterRegistry, ExpressCookieAdapter } from '@oneunit/core';

const registry = new AdapterRegistry();

const result = registry.register(new ExpressCookieAdapter());
console.log(result.success);      // true
console.log(result.adapterName);  // 'ExpressCookieAdapter'
console.log(result.framework);    // 'express'

const adapter = registry.get('ExpressCookieAdapter', 'express');
```

## AdapterRegistry

The `AdapterRegistry` is the central manager for adapter lifecycle. It supports Express, Fastify, Koa, and Node http frameworks.

| Method | Signature | Parameters | Returns |
|--------|-----------|------------|---------|
| register | `register(adapter)` | `adapter`: Adapter instance | `{ success: boolean, adapterName: string, framework: string, error?: string }` |
| get | `get(name, framework)` | `name`: string, `framework`: string | `Adapter \| undefined` |
| getAll | `getAll()` | none | `Adapter[]` |
| getByFramework | `getByFramework(framework)` | `framework`: string | `Adapter[]` |
| has | `has(name, framework)` | `name`: string, `framework`: string | `boolean` |
| remove | `remove(name, framework)` | `name`: string, `framework`: string | `boolean` |
| initializeAll | `initializeAll()` | none | `Promise<void>` |
| disposeAll | `disposeAll()` | none | `Promise<void>` |
| count | `count` (read-only) | none | `number` |

Usage examples:

```javascript
import { AdapterRegistry, FastifyCookieAdapter, KoaCookieAdapter } from '@oneunit/core';

const registry = new AdapterRegistry();

// Register adapters
registry.register(new FastifyCookieAdapter());
registry.register(new KoaCookieAdapter());

// Lookup by name and framework
const adapter = registry.get('FastifyCookieAdapter', 'fastify');

// Check existence
if (registry.has('KoaCookieAdapter', 'koa')) {
  // adapter is registered
}

// Get all adapters for a framework
const expressAdapters = registry.getByFramework('express');

// Total registered count
console.log(registry.count); // 2

// Remove an adapter
registry.remove('FastifyCookieAdapter', 'fastify');
```

## Cookie Adapters

Cookie adapters provide a unified contract for reading, setting, and deleting cookies across frameworks.

| Adapter | Framework | I/O mechanism |
|---------|-----------|---------------|
| ExpressCookieAdapter | Express | `req.cookies` / `res.cookie` / `res.clearCookie` |
| FastifyCookieAdapter | Fastify | `req.cookies` / `reply.setCookie` / `reply.clearCookie` |
| KoaCookieAdapter | Koa | `ctx.cookies.get` / `ctx.cookies.set` |
| HttpCookieAdapter | Node http | `req.headers.cookie` / `res.setHeader('Set-Cookie', ...)` |

Base contract:

- `get(name)` — returns the cookie value string, or `undefined` if absent.
- `set(name, value, options?)` — sets a cookie with optional options (e.g. `httpOnly`, `secure`, `path`, `domain`, `maxAge`, `sameSite`).
- `delete(name, options?)` — clears a cookie.
- `getAll()` — returns all cookies as a record of name to value.

Examples:

```javascript
import { ExpressCookieAdapter } from '@oneunit/core';

const adapter = new ExpressCookieAdapter();

// Get a cookie
const sessionId = adapter.get('sessionId');

// Set a cookie
adapter.set('sessionId', 'abc123', { httpOnly: true, secure: true, path: '/' });

// Delete a cookie
adapter.delete('sessionId', { path: '/' });

// Get all cookies
const allCookies = adapter.getAll(); // { sessionId: 'abc123', theme: 'dark' }
```

## Response Adapters

Response adapters standardize sending JSON responses across frameworks.

| Adapter | Framework |
|---------|-----------|
| ExpressResponseAdapter | Express |
| FastifyResponseAdapter | Fastify |
| KoaResponseAdapter | Koa |
| HttpResponseAdapter | Node http |

Base `send()` contract:

- Sets response headers.
- Sets HTTP status code.
- Sets `content-type` to `application/json`.
- Omits the body for bodyless statuses (`204`, `205`, `304`).
- Throws `ResponseAlreadySentError` if the response has already been committed.

Example:

```javascript
import { ExpressResponseAdapter } from '@oneunit/core';

const adapter = new ExpressResponseAdapter();

adapter.send(res, {
  status: 200,
  headers: { 'x-custom': 'value' },
  body: { message: 'Hello, world' },
});

// Bodyless status omits the body
adapter.send(res, { status: 204 });
```

## Middleware Adapters

Middleware adapters normalize a framework-specific middleware handler into a common form and execute it.

| Adapter | Framework |
|---------|-----------|
| ExpressMiddlewareAdapter | Express |
| FastifyMiddlewareAdapter | Fastify |
| KoaMiddlewareAdapter | Koa |
| HttpMiddlewareAdapter | Node http |

Base contract:

- `adapt(middleware)` — normalizes a handler into the adapter's internal representation.
- `execute(req, res, next)` — runs the normalized handler.

Example:

```javascript
import { ExpressMiddlewareAdapter } from '@oneunit/core';

const adapter = new ExpressMiddlewareAdapter();

const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};

adapter.adapt(logger);
adapter.execute(req, res, next);
```

## Health Adapters

Health adapters expose health-check provider registries across frameworks.

| Adapter | Framework |
|---------|-----------|
| ExpressHealthAdapter | Express |
| FastifyHealthAdapter | Fastify |
| KoaHealthAdapter | Koa |
| HttpHealthAdapter | Node http |

Base contract:

- `getRegistry()` — returns the health provider registry.
- `registerProvider(provider)` — registers a health check provider.

Example:

```javascript
import { ExpressHealthAdapter } from '@oneunit/core';

const adapter = new ExpressHealthAdapter();

const registry = adapter.getRegistry();

adapter.registerProvider({
  name: 'database',
  check: async () => ({ status: 'up' }),
});
```

## Adapter Registration Lifecycle

The standard lifecycle for an adapter is:

1. **register** — create an adapter instance and register it with the `AdapterRegistry`.
2. **initializeAll** — asynchronously initialize all registered adapters (e.g. open connections, bind listeners).
3. **use** — look up adapters via `get`, `getByFramework`, or `getAll` and interact with them through their base contracts.
4. **disposeAll** — asynchronously dispose all registered adapters (e.g. close connections, release resources).

Example:

```javascript
import { AdapterRegistry, ExpressCookieAdapter } from '@oneunit/core';

const registry = new AdapterRegistry();

registry.register(new ExpressCookieAdapter());

await registry.initializeAll();

// Use adapters
const adapter = registry.get('ExpressCookieAdapter', 'express');
adapter.set('sessionId', 'abc123');

await registry.disposeAll();
```

## Error Handling

The `AdapterError` hierarchy provides structured error reporting for adapter operations.

| Error | Constructor | Thrown when |
|-------|-------------|-------------|
| AdapterError | `AdapterError(adapterName, framework, code)` | Base adapter operation failure |
| AdapterNotFoundError | `AdapterNotFoundError(name, framework)` | An adapter lookup by name and framework returns no match |
| AdapterAlreadyRegisteredError | `AdapterAlreadyRegisteredError(name, framework)` | Registering an adapter with a name already present for the framework |
| AdapterNotInitializedError | `AdapterNotInitializedError(adapterName, framework)` | An operation requires an initialized adapter that has not been initialized |

Each error carries `adapterName`, `framework`, and `code` properties for programmatic handling.

Example:

```javascript
import {
  AdapterRegistry,
  AdapterNotFoundError,
  AdapterAlreadyRegisteredError,
  ExpressCookieAdapter,
} from '@oneunit/core';

const registry = new AdapterRegistry();

registry.register(new ExpressCookieAdapter());

try {
  registry.register(new ExpressCookieAdapter()); // duplicate name
} catch (err) {
  if (err instanceof AdapterAlreadyRegisteredError) {
    console.error(`Adapter ${err.adapterName} already registered for ${err.framework}`);
  }
}

try {
  const missing = registry.get('NonexistentAdapter', 'express');
  if (!missing) throw new AdapterNotFoundError('NonexistentAdapter', 'express');
} catch (err) {
  if (err instanceof AdapterNotFoundError) {
    console.error(`Adapter ${err.name} not found for ${err.framework}`);
  }
}
```

## Best Practices

**Do:**

- Register one adapter instance per framework and reuse it via the registry.
- Call `initializeAll()` before using adapters that require asynchronous setup.
- Call `disposeAll()` during application shutdown to release resources.
- Check `has()` before calling `get()` when you need to distinguish "not registered" from "registered but undefined".
- Handle `ResponseAlreadySentError` when sending responses to avoid double-commit errors.
- Use `getByFramework()` to bulk-operate on all adapters for a specific framework.

**Don't:**

- Register the same adapter name twice for the same framework; it throws `AdapterAlreadyRegisteredError`.
- Assume an adapter is initialized without calling `initializeAll()` first.
- Send a body with bodyless statuses (`204`, `205`, `304`); the body will be omitted.
- Rely on adapter instances created outside the registry; always look them up through `get()` or `getAll()`.
- Ignore the `error` field in the `register()` return value when `success` is `false`.
