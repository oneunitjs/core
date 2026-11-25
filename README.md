# `@oneunit/core`

A unified, framework-agnostic Node.js & TypeScript core library for building production backend services. It consolidates cross-cutting infrastructure—configuration management, security middleware, cookie management, response envelopes, health checks, request context, lifecycle/plugin orchestration, multipart parsing, MessagePack serialization, and structured errors—behind a cohesive API with adapters for **Express**, **Fastify**, **Koa**, and **`node:http`**.

---

## Requirements

- **Node.js** `>= 18.0.0`
- **ESM** (`"type": "module"`)

---

## Installation

```bash
npm install @oneunit/core
```

`@oneunit/core` ships framework adapters as optional dependencies for **Express 5**, **Fastify 5**, **Koa 3**, and native **`node:http`**. Install your preferred framework alongside it if not already present:

```bash
# Example: with Express
npm install express
```

---

## Quickstart

### Unified App Facade (`createApp`)

`createApp()` provides a single entry point to initialize and access all core capabilities:

```ts
import { createApp } from "@oneunit/core";

const app = createApp({
  serviceName: "my-api",
  port: 3000,
  secret: process.env.APP_SECRET,
  security: {
    cors: { origin: "https://example.com" },
    helmet: { enabled: true },
  },
  cookie: { secure: true, sameSite: "lax" },
  multipart: { maxFileSize: 10 * 1024 * 1024 },
});

// Register security middleware
app.use(app.helmet());
app.use(app.cors({ origin: "https://example.com" }));
app.use(app.rateLimit({ maxRequests: 100 }));

// Register health checks
app.health().register("db", async () => ({ status: "healthy" }));

// Request-scoped cookies & responses (auto-detects Express, Fastify, Koa, or node:http)
function handler(req: unknown, res: unknown) {
  app.cookies(req, res).set("session", "abc123", { httpOnly: true });
  app.response(req, res).ok({ data: { status: "ok" } });
}
```

### Configuration Engine (`@oneunit/core/config`)

Load, interpolate, map, validate with Zod, and freeze your application configuration into an immutable record:

```ts
import { z } from "zod";
import {
  loadConfigSimple,
  zodValidator,
  parseInteger,
} from "@oneunit/core/config";

const AppSchema = z.object({
  app: z.object({
    name: z.string().default("my-api"),
    port: z.number().int().min(1).max(65535).default(3000),
  }),
  database: z.object({
    url: z.string().min(1),
  }),
});

const config = await loadConfigSimple(zodValidator(AppSchema), {
  env: process.env.NODE_ENV ?? "development",
  envMapping: {
    APP_PORT: { path: ["app", "port"], parse: parseInteger },
    DATABASE_URL: { path: ["database", "url"] },
  },
});

// `config` is fully typed and deeply frozen
console.log(config.app.port);
```

See the [Configuration Quickstart](docs/config/quickstart.md) for YAML conventions, custom `ConfigSource` implementations, and pipeline details.

---

## Subpath Exports

Import everything from `@oneunit/core`, or target individual modules via subpath exports:

| Subpath | Purpose |
|---|---|
| `@oneunit/core` | Full barrel export including `createApp()` and all modules |
| `@oneunit/core/config` | Configuration engine (`loadConfig`, `loadConfigSimple`, `loadConfigSync`, `zodValidator`, `runPipeline`, `parseInteger`, `parseBoolean`, legacy `createConfig`) |
| `@oneunit/core/context` | Request-scoped storage (`createRequestContext`) powered by `AsyncLocalStorage` |
| `@oneunit/core/cookie` | Signed & encrypted cookie store with framework auto-detection |
| `@oneunit/core/health` | Health check registry, route handlers, and system/Docker/Kubernetes providers |
| `@oneunit/core/security` | CORS, CSRF, Helmet, compression, HTML sanitization, and rate limiting |
| `@oneunit/core/errors` | `OneUnitError` base class and category-specific typed error classes |

---

## Capabilities & Modules

| Module | Description |
|---|---|
| **Config** | Multi-source YAML & custom async source loader, `${VAR}` interpolation, `envMapping` with strict parsers, Zod validation, and recursive `deepFreeze` |
| **Security** | Middleware factories for CORS, CSRF (`csrf-csrf`), Helmet headers, compression, HTML sanitization (`sanitize-html`), and rate limiting (`rate-limiter-flexible`) |
| **Cookies** | Cookie serialization, parsing, HMAC signing, encryption, and per-request framework adapters |
| **Response Management** | Standardized response envelopes (`ok`, `created`, `badRequest`, `notFound`, etc.) with framework adapters |
| **Health** | Dependency health check registry, HTTP health endpoint, and system/Docker/Kubernetes probes |
| **Context** | `AsyncLocalStorage`-backed request-scoped context (`createRequestContext`) |
| **Lifecycle & Hooks** | Middleware & plugin registration with conflict detection (`easy`, `advanced`, `strict` modes) and typed event hooks |
| **Multipart** | `busboy`-based multipart form/file parsing middleware with size, count, and MIME controls |
| **MsgPack** | Binary encoding and decoding via `@msgpack/msgpack` |
| **Errors** | Structured `OneUnitError` hierarchy across config, cookie, lifecycle, multipart, response, hooks, lib, and core |
| **Lib** | Byte/time/date formatting and system metrics helpers |

---

## Supported Frameworks

| Framework | Support |
|---|---|
| **Express** (`^5.3.0`) | Middleware, cookies, responses, health route |
| **Fastify** (`^5.12.8`) | Plugin/hook integration, cookies, responses, health route |
| **Koa** (`^3.3.0`) | Context middleware, cookies, responses, health route |
| **`node:http`** | Native `IncomingMessage` / `ServerResponse` adapters |

---

## Scripts

```bash
npm run build       # Compile TypeScript to dist/
npm test            # Run Vitest test suite
npm run typecheck   # Run tsc --noEmit
npm run lint        # Run ESLint across src/ and test/
```

---

## Documentation

- [Architectural Overview](ARCHITECTURAL_OVERVIEW.md)
- [Configuration Quickstart](docs/config/quickstart.md)
- [Configuration Architecture](docs/config/ARCHITECTURE.md)
- [Usage Guidelines](docs/USAGE-GUIDELINES.md)
- Module specifications & usage guides under [`docs/`](docs/)

---

## License

[MIT](package.json)
