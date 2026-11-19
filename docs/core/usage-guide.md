# Core — Usage Guide

@oneunit/core v1.0.0

## Overview

Core is the application bootstrap layer for the @oneunit/core package. It provides a single entry point, `createApp()`, that wires together all sub-systems (health, hooks, config, cookies, security, msgpack, multipart, lifecycle, response, and lib) into a cohesive `App` instance.

Core is for application authors who need a consistent, framework-agnostic way to bootstrap a server, register middleware, manage configuration, and access shared API singletons without manually instantiating each subsystem.

The problem Core solves is fragmented initialization: instead of constructing health checkers, hook registries, config stores, security middleware, and response builders separately and passing them around, Core creates and caches them behind a single `App` interface. Repeated calls to the same accessor return the same instance, so subsystems stay synchronized across the application.

## Installation

```bash
npm install @oneunit/core
```

## Quick Start

Minimal bootstrap with default options:

```ts
import { createApp } from "@oneunit/core";

const app = createApp();

// Access cached API singletons
const health = app.health();
const config = app.config();
const hooks = app.hooks();

// Start listening (framework-dependent)
app.listen(3000);
```

## Application Bootstrap

`createApp()` accepts an optional `AppOptions` object. All options are optional.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serviceName` | `string` | `"app"` | Logical name of the service, used in health and logging. |
| `port` | `number` | `3000` | TCP port the application listens on. |
| `host` | `string` | `"localhost"` | Hostname or IP the application binds to. |
| `nodeEnv` | `string` | `process.env.NODE_ENV` | Runtime environment (e.g. `"development"`, `"production"`). |
| `secret` | `string` | `undefined` | Secret key used for signing/encryption by security subsystems. |
| `framework` | `"express" \| "fastify" \| "koa" \| "http"` | `"http"` | Underlying HTTP framework adapter. |
| `security` | `{ cors?, csrf?, helmet?, compression?, sanitize? }` | `{}` | Security middleware configuration. |
| `cookie` | `CookieConfig` | `{}` | Cookie store configuration. |
| `multipart` | `MultipartOptions` | `{}` | Multipart form/upload handling options. |
| `health` | `{ path? }` | `{ path: "/health" }` | Health check endpoint configuration. |
| `lifecycle` | `LifecycleOptions` | `{}` | Application startup/shutdown lifecycle hooks. |

Example with all options:

```ts
import { createApp } from "@oneunit/core";

const app = createApp({
  serviceName: "billing-service",
  port: 4000,
  host: "0.0.0.0",
  nodeEnv: "production",
  secret: process.env.APP_SECRET,
  framework: "express",
  security: {
    cors: { origin: "*" },
    csrf: true,
    helmet: true,
    compression: true,
    sanitize: true,
  },
  cookie: {
    secure: true,
    sameSite: "lax",
    httpOnly: true,
  },
  multipart: {
    maxFileSize: 10 * 1024 * 1024,
  },
  health: {
    path: "/healthz",
  },
  lifecycle: {
    onStartup: [() => console.log("started")],
    onShutdown: [() => console.log("stopped")],
  },
});
```

Per-call options override global defaults via shallow merge where supported.

## The App Interface

The `App` interface exposes cached API singletons for all sub-systems:

| Method | Return Type | Provides | Cached |
|--------|-------------|----------|--------|
| `health()` | `HealthAPI` | Health check endpoints and status reporting | Yes |
| `hooks()` | `HooksAPI` | Event hook registration and emission | Yes |
| `config()` | `ConfigAPI` | Application configuration get/set | Yes |
| `cookies(_req?, _res?)` | `CookieStoreAPI` | Cookie read/write store | No (per-request) |
| `security()` | `SecurityAPI` | CORS, CSRF, helmet, compression, sanitize middleware | Yes |
| `msgpack()` | `MsgPackAPI` | MessagePack serialization helpers | Yes |
| `multipart()` | `MultipartAPI` | Multipart form-data parsing | Yes |
| `lifecycle()` | `LifecycleAPI` | Startup/shutdown lifecycle management | Yes |
| `createLifecycle(_options?)` | `LifecycleAPI` | Isolated lifecycle instance | No |
| `response(_req?, _res?)` | `ResponseAPI` | HTTP response building helpers | No (per-request) |
| `lib()` | `LibAPI` | Shared utility library | Yes |
| `use(_middleware)` | `App` | Middleware registration (chainable) | N/A |

## Cached API Instances

Most App accessors return cached singletons. Calling the same method repeatedly returns the identical instance reference:

```ts
import { createApp } from "@oneunit/core";

const app = createApp();

app.health() === app.health();        // true
app.hooks() === app.hooks();          // true
app.config() === app.config();        // true
app.security() === app.security();    // true
app.msgpack() === app.msgpack();      // true
app.multipart() === app.multipart();  // true
app.lifecycle() === app.lifecycle();  // true
app.lib() === app.lib();              // true
```

This guarantees that configuration changes, hook registrations, and state mutations made through one accessor are visible through every other accessor of the same method.

## Per-Request APIs

Two App methods create fresh instances on every call because they are tied to an incoming HTTP request and response:

- `cookies(req, res)` → `CookieStoreAPI`
- `response(req, res)` → `ResponseAPI`

Calling either without arguments returns a default instance; passing request/response objects binds the instance to that specific transaction:

```ts
import { createApp } from "@oneunit/core";

const app = createApp();

// Per-request instances — NOT cached
const cookies1 = app.cookies(req1, res1);
const cookies2 = app.cookies(req2, res2);
cookies1 === cookies2; // false (different requests)

const response1 = app.response(req1, res1);
const response2 = app.response(req2, res2);
response1 === response2; // false (different requests)
```

## Configuration Get/Set

The `ConfigAPI` returned by `app.config()` manages application configuration:

```ts
import { createApp } from "@oneunit/core";

const app = createApp({ port: 3000, serviceName: "my-app" });
const config = app.config();

// Get a value
const port = config.get("port");        // 3000
const name = config.get("serviceName"); // "my-app"

// Set a value
config.set("port", 4000);
config.get("port");                     // 4000

// Convenience getter
config.port;                            // 4000

// Serialize all configuration to a plain object
config.toJSON();                        // { port: 4000, serviceName: "my-app", ... }
```

### Rules

- Keys must be known config properties. Setting or getting an unknown key throws an error.
- `config.set()` validates the value type against the property's expected type.
- `config.toJSON()` returns a plain object snapshot safe for logging or serialization.

## Middleware Registration

`app.use()` registers middleware and returns the `App` instance for chaining:

```ts
import { createApp } from "@oneunit/core";

const app = createApp();

app
  .use((req, res, next) => {
    console.log("request started");
    next();
  })
  .use((req, res, next) => {
    console.log("second middleware");
    next();
  });
```

Middleware executes in registration order. Return the `App` from `use()` to build fluent pipelines.

## DX Wrapper Shortcuts

The `createApp` factory from `src/core/core.ts` provides direct shortcut methods on the `App` instance, so you do not need to reach into each sub-API separately:

| Shortcut | Equivalent To |
|----------|---------------|
| `app.cors()` | `app.security().cors()` |
| `app.csrf()` | `app.security().csrf()` |
| `app.helmet()` | `app.security().helmet()` |
| `app.compression()` | `app.security().compression()` |
| `app.sanitize()` | `app.security().sanitize()` |
| `app.rateLimit()` | `app.security().rateLimit()` |
| `app.cookies()` | `app.cookies()` |
| `app.response()` | `app.response()` |
| `app.multipart()` | `app.multipart()` |
| `app.use()` | `app.use()` |
| `app.apply()` | Apply a configuration or middleware bundle |
| `app.health()` | `app.health()` |
| `app.hooks()` | `app.hooks()` |
| `app.config()` | `app.config()` |
| `app.lib()` | `app.lib()` |
| `app.msgpack()` | `app.msgpack()` |
| `app.lifecycle()` | `app.lifecycle()` |

Example:

```ts
import { createApp } from "@oneunit/core";

const app = createApp();

app
  .cors({ origin: "*" })
  .csrf()
  .helmet()
  .compression()
  .use((req, res, next) => next());
```

## Cross-Framework Examples

### Express

```ts
import express from "express";
import { createApp } from "@oneunit/core";

const app = createApp({ framework: "express", port: 3000 });

const server = express();

// Wire Core middleware into Express
app.use((req, res, next) => {
  const cookies = app.cookies(req, res);
  const response = app.response(req, res);
  next();
});

server.listen(app.config().get("port"), () => {
  console.log(`Express listening on port ${app.config().get("port")}`);
});
```

### Fastify

```ts
import Fastify from "fastify";
import { createApp } from "@oneunit/core";

const app = createApp({ framework: "fastify", port: 3000 });

const fastify = Fastify({ logger: true });

fastify.addHook("onRequest", (request, reply, done) => {
  const cookies = app.cookies(request.raw, reply.raw);
  done();
});

fastify.listen({ port: app.config().get("port") }, (err) => {
  if (err) throw err;
});
```

### Koa

```ts
import Koa from "koa";
import { createApp } from "@oneunit/core";

const app = createApp({ framework: "koa", port: 3000 });

const koa = new Koa();

koa.use(async (ctx, next) => {
  const cookies = app.cookies(ctx.req, ctx.res);
  await next();
});

koa.listen(app.config().get("port"), () => {
  console.log(`Koa listening on port ${app.config().get("port")}`);
});
```

### node:http

```ts
import http from "node:http";
import { createApp } from "@oneunit/core";

const app = createApp({ framework: "http", port: 3000 });

const server = http.createServer((req, res) => {
  const cookies = app.cookies(req, res);
  const response = app.response(req, res);

  response.status(200).json({ ok: true });
});

server.listen(app.config().get("port"), () => {
  console.log(`HTTP listening on port ${app.config().get("port")}`);
});
```

## Error Handling

Core can throw errors in the following situations:

| Error | When |
|-------|------|
| `Unknown config key` | Calling `config.get()` or `config.set()` with a key that is not a registered config property. |
| `Invalid config value` | Calling `config.set()` with a value whose type does not match the property's expected type. |
| `Missing secret` | Initializing security features (csrf, cookie signing) without providing a `secret` in `AppOptions`. |
| `Unsupported framework` | Passing a `framework` value other than `"express"`, `"fastify"`, `"koa"`, or `"http"`. |
| `Lifecycle hook error` | A registered startup or shutdown hook throws; Core propagates the error. |

Example of handling an unknown config key:

```ts
import { createApp } from "@oneunit/core";

const app = createApp();

try {
  app.config().get("nonexistentKey");
} catch (error) {
  console.error("Config error:", error.message);
}
```

## Best Practices

### Do

- Create one `App` instance per process and reuse it; do not call `createApp()` per request.
- Rely on cached singletons: `app.config() === app.config()`.
- Pass `req`/`res` to `app.cookies()` and `app.response()` in request handlers.
- Use `config.set()` to override configuration at runtime rather than mutating internal state directly.
- Register all middleware through `app.use()` before starting the server.
- Provide a `secret` when using CSRF or signed cookies.

### Don't

- Do not call `createApp()` inside a middleware or request handler.
- Do not assume `app.cookies()` or `app.response()` are cached — they create per-request instances.
- Do not pass unknown keys to `config.get()` or `config.set()`.
- Do not mix framework adapters; pick one `framework` per `App` instance.
- Do not ignore errors thrown by lifecycle hooks during startup/shutdown.
