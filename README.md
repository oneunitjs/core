# `@oneunit/core`

A unified, framework-agnostic Node.js & TypeScript core library for building production backend services. It consolidates cross-cutting infrastructure—configuration management, security middleware, cookie management, response envelopes, health checks, request-scoped context, lifecycle/plugin orchestration, multipart parsing, MessagePack serialization, structured errors, and system utilities—behind a cohesive API with adapters for **Express 5**, **Fastify 5**, **Koa 3**, and native **`node:http`**.

## Table of Contents

1. [What is `@oneunit/core`?](#what-is-oneunitcore)
2. [Key Capabilities](#key-capabilities)
3. [Architecture at a Glance](#architecture-at-a-glance)
4. [Requirements](#requirements)
5. [Installation](#installation)
6. [Quickstart](#quickstart)
7. [Subpath Exports](#subpath-exports)
8. [Supported Frameworks](#supported-frameworks)
9. [Technology Stack](#technology-stack)
10. [Developer Onboarding](#developer-onboarding)
11. [Local Development Workflow](#local-development-workflow)
12. [Project Structure](#project-structure)
13. [Documentation & Further Reading](#documentation--further-reading)
14. [License](#license)

---

## What is `@oneunit/core`?

`@oneunit/core` is a single dependency that bundles the infrastructure every backend service needs, so you do not have to assemble, configure, and maintain a dozen small libraries yourself. It is **framework-agnostic at its core** and framework-integrated at its edges: the same `createApp()` factory works with Express, Fastify, Koa, or plain `node:http`, with framework-specific adapters handling request/response binding, middleware mounting, and error normalization.

The library is written in strict TypeScript, targets ES2022, runs on Node.js `>= 18.0.0`, and is published as ESM (`"type": "module"`).

---

## Key Capabilities

| Module | Purpose |
|---|---|
| **Config** | Multi-source YAML & env loading, `${VAR}` interpolation, `envMapping` with strict parsers, Zod validation, recursive `deepFreeze` |
| **Security** | CORS, CSRF (`csrf-csrf`), Helmet headers, compression, HTML sanitization (`sanitize-html`), rate limiting (`rate-limiter-flexible`) |
| **Cookies** | Signed & encrypted cookie store with HMAC, framework auto-detection, per-request caching |
| **Response Management** | Standardized `ApiResponse` envelopes (`ok`, `created`, `badRequest`, `notFound`, …) with framework adapters |
| **Health** | Dependency health registry, HTTP health endpoint, system/Docker/Kubernetes probes |
| **Context** | `AsyncLocalStorage`-backed request-scoped storage (`createRequestContext`) |
| **Lifecycle & Hooks** | Middleware/plugin manager (`easy`, `advanced`, `strict` modes) with conflict detection and typed event hooks |
| **Multipart** | `busboy`-based multipart form/file parsing with size, count, MIME, and timeout controls |
| **MsgPack** | Binary encoding/decoding via `@msgpack/msgpack` |
| **Errors** | `OneUnitError` hierarchy across 11 domain categories |
| **Lib** | Byte/time/date formatting, system metrics, Docker & Kubernetes health clients |

---

## Architecture at a Glance

`@oneunit/core` follows a **facade + layered adapter** architecture:

- **Composition root:** `createApp(options?)` instantiates and wires every subsystem once, returning a cached `App` / `CoreApp` interface.
- **Facade pattern:** Subsystem APIs (`health()`, `hooks()`, `config()`, `security()`, `msgpack()`, `multipart()`, `lifecycle()`, `lib()`) are instantiated once per `createApp()` call and reused. Request-scoped APIs (`cookies(req, res)` and `response(req, res)`) bind to the current request/response and are cached per `req` via a `WeakMap`.
- **Framework-organized adapters:** Framework-specific integration lives under `src/adapters/<framework>/` (Express, Fastify, Koa, Universal/`node:http`), isolating framework detection, request/response binding, and error boundaries.
- **Option override:** Per-call options shallow-merge over application-level `AppOptions` defaults (`{ ...global, ...perCall }`).
- **Lifecycle safety:** Three modes (`easy`, `advanced`, `strict`) with configurable execution timeouts, middleware/plugin limits, type-conflict detection, and duplicate response-header collision detection.

Full architectural details live in [ARCHITECTURAL_OVERVIEW.md](ARCHITECTURAL_OVERVIEW.md).

---

## Requirements

| Requirement | Value |
|---|---|
| **Node.js** | `>= 18.0.0` |
| **Module system** | ES Modules (`"type": "module"`) |
| **TypeScript** | `^6.0.3` (strict mode recommended) |

---

## Installation

```bash
npm install @oneunit/core
```

`@oneunit/core` ships framework adapters as optional dependencies. Install your preferred framework alongside it if not already present:

```bash
# Example: with Express
npm install express

# Example: with Fastify
npm install fastify

# Example: with Koa
npm install koa
```

---

## Quickstart

### Unified App Facade (`createApp`)

`createApp()` is the single entry point. It initializes every subsystem and returns an `App` (or `CoreApp` for the simplified DX wrapper) with cached API accessors.

```ts
import { createApp } from "@oneunit/core";

const app = createApp({
  serviceName: "my-api",
  port: 3000,
  host: "localhost",
  nodeEnv: process.env.NODE_ENV ?? "development",
  secret: process.env.APP_SECRET,
  security: {
    cors: { origin: "https://example.com" },
    csrf: { enabled: true },
    helmet: { enabled: true },
    compression: { enabled: true },
    sanitize: { enabled: true },
  },
  cookie: { secure: true, sameSite: "lax" },
  multipart: { maxFileSize: 10 * 1024 * 1024 },
  lifecycle: { mode: "advanced" },
});

// Cached subsystem APIs (same instance on every call)
app.health().register("db", async () => ({ status: "healthy" }));
app.health().registerSystem({ critical: true });

app.hooks().on("request.start", (ctx) => console.log("request started", ctx));

// Security middleware factories (return framework middleware)
app.use(app.cors({ origin: "https://example.com" }));
app.use(app.csrf({ secret: process.env.APP_SECRET }));
app.use(app.helmet());
app.use(app.compression());
app.use(app.sanitize());
app.use(app.rateLimit({ maxRequests: 100 }));

// Request-scoped cookies & responses (auto-detect Express, Fastify, Koa, or node:http)
function handler(req: unknown, res: unknown) {
  app.cookies(req, res).set("session", "abc123", { httpOnly: true, secure: true });
  app.response(req, res).ok({ data: { status: "ok" } });
}
```

### Configuration Engine (`@oneunit/core/config`)

Load, interpolate, map, validate with Zod, and freeze configuration into an immutable, typed record:

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

See [docs/config/quickstart.md](docs/config/quickstart.md) for YAML conventions, custom `ConfigSource` implementations, and pipeline details.

---

## Subpath Exports

Import everything from `@oneunit/core`, or target individual modules via subpath exports to keep bundle size small:

| Subpath | Source Entry | Scope |
|---|---|---|
| `@oneunit/core` | `src/index.ts` | Full barrel export including `createApp()` and all modules |
| `@oneunit/core/config` | `src/config/index.ts` | Config engine (`loadConfig`, `loadConfigSimple`, `loadConfigSync`, `zodValidator`, `parseInteger`, `parseBoolean`) + legacy `createConfig` |
| `@oneunit/core/context` | `src/context/index.ts` | Request-scoped storage (`createRequestContext`) powered by `AsyncLocalStorage` |
| `@oneunit/core/cookie` | `src/cookie/index.ts` | Signed & encrypted cookie store with framework auto-detection |
| `@oneunit/core/health` | `src/health/index.ts` | Health registry, route builder, system/Docker/Kubernetes providers |
| `@oneunit/core/security` | `src/security/index.ts` | CORS, CSRF, Helmet, compression, HTML sanitization, rate limiting |
| `@oneunit/core/errors` | `src/errors/index.ts` | `OneUnitError` base class and category-specific typed error classes |

---

## Supported Frameworks

| Framework | Version | Integration |
|---|---|---|
| **Express** | `^5.3.0` | Middleware, cookies, responses, health route, error handler |
| **Fastify** | `^5.12.8` | Plugin/hook integration, cookies, responses, health route, error handler |
| **Koa** | `^3.3.0` | Context middleware, cookies, responses, health route, onion-model error middleware |
| **`node:http`** | Native | `IncomingMessage` / `ServerResponse` adapters via the Universal adapter |

Framework adapters live under `src/adapters/{express,fastify,koa,universal}/`.

---

## Technology Stack

### Language & Runtime

| Attribute | Value | Rationale |
|---|---|---|
| Language | TypeScript `^6.0.3` | Static types catch infrastructure errors at compile time |
| Runtime | Node.js `>= 18.0.0` | Broad LTS coverage, native `AsyncLocalStorage` and `Web Streams` |
| Module system | ES Modules (`"type": "module"`) | Standard JS module syntax, tree-shakable exports |
| Compiler target | ES2022 | Modern syntax with wide Node 18+ support |
| Module resolution | `NodeNext` | Aligns TS resolution with Node ESM semantics |
| Strict mode | `strict: true` | Maximum type safety for infrastructure code |
| Verbative module syntax | `verbatimModuleSyntax: true` | Enforces explicit `import type` / `import value` boundaries |
| Isolated modules | `isolatedModules: true` | Safe transpilation with bundlers and `tsx` |

### Runtime Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `zod` | `^4.6.7` | Schema validation and static type inference |
| `@asteasolutions/zod-to-openapi` | `^9.1.0` | OpenAPI schema generation from Zod schemas |
| `@msgpack/msgpack` | `^3.1.3` | Compact binary serialization |
| `busboy` | `^1.6.0` | Streaming `multipart/form-data` parsing |
| `cookie` | `^2.0.2` | Cookie parsing and serialization |
| `cors` | `^2.8.6` | Cross-Origin Resource Sharing |
| `csrf-csrf` | `^4.1.0` | Double-submit CSRF protection |
| `helmet` | `^8.3.0` | Security HTTP headers |
| `compression` | `^1.8.2` | HTTP response compression |
| `rate-limiter-flexible` | `^11.4.1` | Flexible rate limiting |
| `sanitize-html` | `^2.18.2` | HTML sanitization |
| `prom-client` | `^15.1.3` | Prometheus metrics exposition |
| `swagger-ui-dist` | `^5.34.1` | Swagger UI static assets |
| `dotenv` | `^18.0.10` | `.env` file loading |
| `yaml` | `^2.9.1` | YAML configuration parsing |

### Optional Framework Dependencies

Installed by the consumer as needed:

| Framework | Version |
|---|---|
| `express` | `^5.3.0` |
| `fastify` | `^5.12.8` |
| `koa` | `^3.3.0` |

### Development Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `vitest` | `^5.1.0` | Unit test runner (78 test files under `test/`) |
| `typescript` | `^6.0.3` | Compiler and type checker |
| `tsx` | `^4.23.15` | TypeScript execution for local dev |
| `eslint` | `^10.14.0` | Linting |
| `@typescript-eslint/eslint-plugin` | `^8.72.2` | TypeScript-aware ESLint rules |
| `@typescript-eslint/parser` | `^8.72.2` | TypeScript parser for ESLint |
| `@types/node` | `^22.0.0` | Node.js type definitions |
| `@types/busboy`, `@types/express`, `@types/koa`, `@types/sanitize-html` | — | Framework type stubs |

---

## Developer Onboarding

This section walks a new developer through cloning, configuring, and running the project locally for the first time.

### Step 1: Clone the repository

```bash
git clone <repository-url>
cd core
```

### Step 2: Verify the runtime

Ensure Node.js `>= 18.0.0` is installed:

```bash
node --version
# Expected: v18.x.x or higher
```

### Step 3: Install dependencies

```bash
npm install
```

This installs production, optional framework, and development dependencies. Optional frameworks (Express, Fastify, Koa) are not installed by default; add them when you want to test a specific adapter:

```bash
npm install express   # or fastify, or koa
```

### Step 4: Configure the environment

`@oneunit/core` reads configuration from environment variables and YAML files. Create a `.env` at the project root for local development:

```bash
# .env
NODE_ENV=development
APP_SECRET=change-me-in-production
APP_PORT=3000
APP_HOST=localhost
DATABASE_URL=postgres://localhost:5432/mydb
```

YAML configuration (when using the config engine) lives under `src/config/yaml/` by default, or `./config/` for `loadConfigSimple`. See [docs/config/quickstart.md](docs/config/quickstart.md) for the YAML schema and interpolation rules (`${VAR}`, `${VAR:fallback}`).

### Step 5: Typecheck the codebase

```bash
npm run typecheck
```

This runs `tsc --noEmit` against `tsconfig.json` and should complete with no errors. It validates that your local TypeScript version matches the project's strict settings.

### Step 6: Run the test suite

```bash
npm test
```

This runs `vitest run` across the `test/` directory. All tests should pass on a clean checkout.

### Step 7: Lint the source

```bash
npm run lint
```

This runs ESLint across `src/` and `test/`. Fix any reported issues before opening a pull request.

### Step 8: Build the package

```bash
npm run build
```

This compiles TypeScript from `src/` to `dist/` using `tsc`. The `dist/` directory is what is published to npm.

---

## Local Development Workflow

| Command | Purpose |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run the Vitest test suite |
| `npm run typecheck` | Run `tsc --noEmit` (no emit) |
| `npm run lint` | Run ESLint across `src/` and `test/` |
| `npx tsx src/index.ts` | Execute TypeScript directly (for quick experiments) |

### Recommended iteration loop

1. Make changes under `src/`.
2. Run `npm run typecheck` to catch type errors.
3. Run `npm test` to verify behavior.
4. Run `npm run lint` to enforce style.
5. Run `npm run build` to confirm the package compiles cleanly.

### Adding a new subsystem

1. Create a new directory under `src/` (e.g., `src/myfeature/`).
2. Implement the feature with an `index.ts` barrel export and typed public API.
3. Add error classes to `src/errors/` following the `OneUnitError` pattern.
4. Export the new module from `src/index.ts`.
5. Add unit tests under `test/` matching the existing naming conventions.
6. Document the module under `docs/<module>/` (architecture-spec.md + usage-guide.md).
7. Update this README and `ARCHITECTURAL_OVERVIEW.md`.

---

## Project Structure

```
core/
├── src/
│   ├── index.ts                  # Top-level barrel export (all modules + createApp)
│   ├── core.ts                   # Composition root: createApp() -> App
│   ├── core/core.ts              # Simplified DX wrapper: createApp() -> CoreApp
│   ├── adapters/                 # Framework integrations (by framework)
│   │   ├── express/              # Express 5 adapter
│   │   ├── fastify/              # Fastify 5 plugin adapter
│   │   ├── koa/                  # Koa 3 middleware adapter
│   │   └── universal/            # Auto-detecting adapter (all four runtimes)
│   ├── config/                   # YAML/env config engine + legacy createConfig
│   ├── context/                  # AsyncLocalStorage request context
│   ├── cookie/                   # Signed/encrypted cookie store
│   ├── errors/                   # OneUnitError hierarchy (11 categories)
│   ├── health/                   # Health registry + system/Docker/K8s providers
│   ├── hooks/                    # Typed event hooks registry
│   ├── lib/                      # Formatters, system metrics, Docker/K8s clients
│   ├── lifecycle/                # LifecycleManager (easy/advanced/strict)
│   ├── msgpack/                  # MessagePack encoder/decoder
│   ├── multipart/                # Busboy multipart parser + middlewares
│   ├── response-mangement/       # ResponseManager + ApiResponse envelopes
│   └── security/                 # CORS, CSRF, Helmet, compression, sanitize, rate-limit
├── test/                         # Vitest test suite (78 test files)
├── docs/                         # Per-module architecture specs & usage guides
├── plan/                         # Implementation plans
├── ARCHITECTURAL_OVERVIEW.md     # Detailed architecture specification
├── CONFIG_MANAGEMENT_ARCHITECTURE.md
├── README.md                     # This file
├── package.json                  # Manifest, scripts, exports map
├── tsconfig.json                 # TypeScript compiler options
├── eslint.config.js              # ESLint flat config
└── vitest.config.ts              # Vitest configuration
```

---

## Documentation & Further Reading

| Document | Purpose |
|---|---|
| [ARCHITECTURAL_OVERVIEW.md](ARCHITECTURAL_OVERVIEW.md) | Detailed system design, components, data flow, technology stack, error model |
| [CONFIG_MANAGEMENT_ARCHITECTURE.md](CONFIG_MANAGEMENT_ARCHITECTURE.md) | Configuration engine internals |
| [docs/config/quickstart.md](docs/config/quickstart.md) | Configuration quickstart (YAML, envMapping, pipeline) |
| [docs/USAGE-GUIDELINES.md](docs/USAGE-GUIDELINES.md) | General usage guidelines |
| `docs/<module>/architecture-spec.md` | Per-module architecture specifications |
| `docs/<module>/usage-guide.md` | Per-module usage guides |

Per-module docs are available for: `adapters`, `config`, `context`, `cookie`, `core`, `errors`, `health`, `hooks`, `lib`, `lifecycle`, `msgpack`, `multipart`, `response`, `security`.

---

## License

[MIT](package.json)