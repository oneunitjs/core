# Usage Guidelines — @oneunit/core v1.0.0

Production-ready operational documentation for the `@oneunit/core` package. This section covers deployment, security, configuration, operations, integration patterns, and migration.

## Table of Contents

1. [Deployment Best Practices](#1-deployment-best-practices)
2. [Security Protocols and Considerations](#2-security-protocols-and-considerations)
3. [System-wide Configuration Requirements](#3-system-wide-configuration-requirements)
4. [Operational Standards](#4-operational-standards)
5. [Common Integration Patterns](#5-common-integration-patterns)
6. [Migration and Compatibility](#6-migration-and-compatibility)

---

## 1. Deployment Best Practices

### 1.1 Node.js Version Requirements

`@oneunit/core` requires **Node.js >= 18.0.0**. The package uses modern JavaScript features including `AsyncLocalStorage`, `Node.js` crypto/webcrypto APIs, and ESM.

**package.json engines field:**

```json
{
  "name": "my-api",
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "@oneunit/core": "^1.0.0"
  }
}
```

**Verify runtime in CI:**

```bash
node --version | awk -F. '{print $1}' | xargs -I{} test {} -ge 18
```

### 1.2 Environment Variable Configuration

Configure the application via environment variables. All variables are optional with sensible defaults.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | number | `3000` | HTTP server listen port |
| `HOST` | string | `"localhost"` | Bind address |
| `SERVICE_NAME` | string | `"app"` | Service identifier for logging/monitoring |
| `NODE_ENV` | string | `"development"` | Environment mode (`development`, `production`, `test`) |
| `SECRET` | string | *(optional)* | Application-level signing/encryption secret |

**Example `.env` file:**

```
PORT=3000
HOST=localhost
SERVICE_NAME=my-api
NODE_ENV=production
SECRET=super-secret-key-32-chars-minimum
```

**Loading environment variables:**

```ts
import { createApp } from '@oneunit/core';
import dotenv from 'dotenv';

dotenv.config();

const app = createApp({
    serviceName: process.env.SERVICE_NAME || 'app',
    port: parseInt(process.env.PORT ?? '3000', 10),
    secret: process.env.SECRET,
    // ...
});
```

> **Warning:** Never commit `.env` files to version control. Add `.env`, `.env.local`, `.env.production` to `.gitignore`.

### 1.3 Production vs Development Configuration Differences

| Setting | Development | Production |
|---------|-------------|------------|
| `cookie.secure` | `false` (auto) | `true` (auto when `NODE_ENV=production`) |
| `security.helmet.hsts` | typically omitted | `maxAge: 31536000` (1 year) |
| `security.compression.threshold` | `1024` bytes | tune higher for large payloads |
| `security.csrf.cookieOptions.secure` | `false` | `true` |
| `response.tryCatchEnabled` | `true` (default) | `true` (default) |
| `lifecycle.mode` | `advanced` (default) | `strict` |

**Production config example:**

```ts
const app = createApp({
    serviceName: "my-api",
    port: parseInt(process.env.PORT ?? "3000", 10),
    host: "0.0.0.0",
    secret: process.env.SECRET,
    security: {
        cors: {
            origin: process.env.CORS_ORIGIN ?? "https://example.com",
            credentials: true,
        },
        csrf: {
            cookieName: "my-csrf",
            ignoreMethods: ["GET", "HEAD", "OPTIONS"],
        },
        helmet: {
            hidePoweredBy: true,
            hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
        },
        compression: { threshold: 1024 },
    },
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 86400,
    },
    multipart: {
        maxFileSize: 10 * 1024 * 1024,
        maxFiles: 5,
        allowedMimeTypes: ["image/jpeg", "image/png"],
    },
    health: { path: "/health" },
    lifecycle: { mode: "strict" },
});
```

### 1.4 Secret Management

#### App-level Secret

The `secret` option is the root secret used for signed and encrypted cookies, CSRF tokens, and other cryptographic operations. It must be at least 32 characters for adequate security.

```ts
const app = createApp({
    secret: process.env.SECRET, // required in production
});
```

#### Per-call Overrides

Signed and encrypted cookie operations accept a per-call `secret` override:

```ts
const cookies = app.cookies(req, res);

// Override the signing secret for a single cookie
cookies.setSigned("token", "signed-value", { secret: "override-signing-key" });

// Override the encryption secret for a single cookie
cookies.setEncrypted("secret", "encrypted-value", { secret: "override-encryption-key" });
```

#### Secret Rotation

Support fallback secrets during rotation periods:

```ts
// Primary secret (current)
const app = createApp({
    secret: process.env.SECRET_CURRENT,
});

// For signed cookies, verify against multiple secrets during rotation
cookies.setSigned("session", value, {
    secret: process.env.SECRET_CURRENT,
    // validation can check SECRET_PREVIOUS as fallback in your verifier
});

// getSigned and getEncrypted automatically try config_.secrets fallbacks
const app2 = createApp({
    secret: process.env.SECRET_CURRENT,
    cookie: { secrets: [process.env.SECRET_PREVIOUS ?? ''] },
});
```

Rotate secrets on a schedule (e.g., every 90 days) and deploy both old and new secrets simultaneously during the transition window.

### 1.5 Framework Selection Guidance

`@oneunit/core` is framework-agnostic and auto-detects the underlying HTTP framework when `req`/`res` objects are passed.

| Framework | Use Case | Auto-detection |
|-----------|----------|----------------|
| `express` | Traditional middleware-heavy apps, large ecosystem | Detected from `res.status` / `res.json` / `res.send` |
| `fastify` | High-performance, schema-first, async/await | Detected from `res.raw.send` / `res.code` |
| `koa` | Async middleware, composable context | Detected from `ctx.cookies` |
| `node:http` | Raw Node.js HTTP, minimal dependencies | Fallback when `res.setHeader` present |

**Framework selection recommendation:**

- **Express**: Use when you need extensive middleware ecosystem or are migrating an existing Express app.
- **Fastify**: Use for new high-performance services with JSON schemas and async handlers.
- **Koa**: Use when you prefer async middleware composition and a smaller core.
- **node:http**: Use for lightweight services, edge functions, or when avoiding framework dependencies.

```ts
// Framework-agnostic — works with any of the above
const response = app.response(req, res);
response.ok({ data: { id: 1 }, message: "OK" });
```

### 1.6 Process Management

#### PM2

```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: "my-api",
    script: "dist/index.js",
    instances: "max",
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
    },
  }],
};

pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### systemd

Create `/etc/systemd/system/my-api.service`:

```ini
[Unit]
Description=My API Service
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/opt/my-api
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/opt/my-api/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable my-api
sudo systemctl start my-api
```

#### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER node
CMD ["node", "dist/index.js"]
```

```bash
docker build -t my-api:1.0.0 .
docker run -d -p 3000:3000 --env-file .env --name my-api my-api:1.0.0
```

**Docker health check:**

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

### 1.7 Health Check Endpoint Configuration and Monitoring

Configure the health check path in app options:

```ts
const app = createApp({
    serviceName: "my-api",
    health: { path: "/health" },
});

const health = app.health();

// Register dependency checks
health.register({
    name: "db",
    check: async () => {
        const ping = await db.ping();
        return { status: ping ? "healthy" : "unhealthy" };
    },
});

health.register({
    name: "cache",
    check: async () => {
        const pong = await cache.ping();
        return { status: pong ? "healthy" : "unhealthy" };
    },
});

// Mount on your HTTP server
await health.route(server);
```

**Health response format:**

```json
{
  "service": "my-api",
  "status": "healthy",
  "timestamp": "2026-01-15T10:30:00Z",
  "checks": {
    "db": { "status": "healthy", "latency": 12 },
    "cache": { "status": "healthy", "latency": 5 }
  }
}
```

**Kubernetes liveness/readiness probes:**

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30
  timeoutSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### 1.8 Graceful Shutdown Considerations

Handle `SIGTERM` and `SIGINT` to stop the HTTP server and clean up resources:

```ts
import { createApp } from '@oneunit/core';

const app = createApp({
    serviceName: "my-api",
    port: parseInt(process.env.PORT ?? "3000", 10),
    secret: process.env.SECRET,
});

// Create your HTTP server separately (createApp does not start a server)
import http from 'node:http';
const server = http.createServer((req, res) => {
    const response = app.response(req, res);
    response.ok({ message: "Hello" });
});

server.listen(app.config().port, () => {
    console.log(`${app.config().serviceName} listening on port ${app.config().port}`);
});

const signals = ["SIGTERM", "SIGINT"];

async function shutdown(signal: string) {
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    server.close((err) => {
        if (err) {
            console.error("Error closing server:", err);
            process.exit(1);
        }

        console.log("HTTP server closed. Process exiting.");
        process.exit(0);
    });

    setTimeout(() => {
        console.error("Forced exit after timeout");
        process.exit(1);
    }, 30000).unref();
}

for (const signal of signals) {
    process.on(signal, () => shutdown(signal));
}
```

---

## 2. Security Protocols and Considerations

### 2.1 CORS Configuration

#### Origin Allowlist vs Wildcard

**Recommended: explicit origin allowlist**

```ts
security: {
    cors: {
        origin: ["https://app.example.com", "https://admin.example.com"],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
        exposedHeaders: ["X-Total-Count"],
        maxAge: 86400,
    },
}
```

**Wildcard (development only / public APIs):**

```ts
security: {
    cors: {
        origin: "*",
        credentials: false,
    },
}
```

> **Security Warning:** Never use `origin: "*"` with `credentials: true`. This is a critical vulnerability that allows any site to make authenticated requests.

#### Dynamic Origin Validation

For multiple subdomains or SaaS tenants, validate origins dynamically:

```ts
const allowedOrigins = ["https://app.example.com", "https://admin.example.com"];

security: {
    cors: {
        origin: (origin: string | undefined) => {
            if (!origin) return true;
            if (allowedOrigins.includes(origin)) return origin;
            return false;
        },
        credentials: true,
    },
}
```

Note: The `origin` option accepts `string | string[] | boolean`. A function is resolved by the caller before passing to `createCors`.

### 2.2 CSRF Protection

#### Double-Submit Cookie Pattern

`@oneunit/core` uses the double-submit cookie pattern: a CSRF token is stored in a cookie and must be submitted as a custom header or request body field on state-changing requests.

```ts
security: {
    csrf: {
        cookieName: "my-csrf",
        ignoreMethods: ["GET", "HEAD", "OPTIONS"],
    },
}
```

#### Token Rotation

Rotate CSRF tokens on authentication events (login, logout, password change):

```ts
const cookies = app.cookies(req, res);
cookies.set("csrf-token", generateSecureToken(), {
    httpOnly: false,
    secure: true,
    sameSite: "strict",
});
```

#### ignoreMethods

Configure which HTTP methods skip CSRF validation:

```ts
security: {
    csrf: {
        cookieName: "my-csrf",
        ignoreMethods: ["GET", "HEAD", "OPTIONS", "POST"],
    },
}
```

> **Warning:** Only add non-safe methods to `ignoreMethods` for endpoints that are publicly accessible and do not mutate user state.

### 2.3 Helmet Headers

Production hardening with Helmet security headers:

```ts
security: {
    helmet: {
        hidePoweredBy: true,
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "https://api.example.com"],
                frameAncestors: ["'none'"],
            },
        },
        frameOptions: "DENY",
        noSniff: true,
        referrerPolicy: "strict-origin-when-cross-origin",
    },
}
```

**Key headers explained:**

| Header | Purpose | Production Value |
|--------|---------|------------------|
| `X-Powered-By` | Reveals framework | Removed (`hidePoweredBy: true`) |
| `Strict-Transport-Security` | Forces HTTPS | `max-age=31536000; includeSubDomains; preload` |
| `Content-Security-Policy` | Prevents XSS, data injection | Restrictive directives |
| `X-Frame-Options` | Prevents clickjacking | `DENY` or `SAMEORIGIN` |
| `X-Content-Type-Options` | Prevents MIME sniffing | `nosniff` |
| `Referrer-Policy` | Controls referrer info | `strict-origin-when-cross-origin` |

### 2.4 Cookie Security

| Attribute | Recommendation | Rationale |
|-----------|---------------|-----------|
| `Secure` | `true` in production | Cookie only sent over HTTPS |
| `HttpOnly` | `true` for session/auth | Prevents JavaScript XSS access |
| `SameSite` | `"lax"` or `"strict"` | CSRF mitigation |
| `__Secure-` prefix | Sensitive cookies | Requires Secure attribute |
| `__Host-` prefix | Highest security | Requires Secure, Path=/, no Domain |

**Cookie config:**

```ts
cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 86400,
    domain: undefined,
    path: "/",
},
```

**Named stores with different security profiles:**

```ts
const sessionCookies = app.cookies().createStore("session", {
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 86400,
});

const authCookies = app.cookies().createStore("auth", {
    secure: true,
    httpOnly: true,
    sameSite: "strict",
    maxAge: 3600,
});

const prefCookies = app.cookies().createStore("prefs", {
    secure: false,
    httpOnly: false,
    sameSite: "lax",
    maxAge: 30 * 86400,
});
```

### 2.5 Secret Rotation: Fallback Secrets

```ts
const cookies = app.cookies(req, res);

cookies.setSigned("session", value, {
    secret: process.env.COOKIE_SECRET_CURRENT,
});

function verifySignedCookie(cookies, name) {
    const secrets = [
        process.env.COOKIE_SECRET_CURRENT,
        process.env.COOKIE_SECRET_PREVIOUS,
    ].filter(Boolean);

    for (const secret of secrets) {
        try {
            return cookies.getSigned(name, { secret });
        } catch {
            continue;
        }
    }
    return null;
}
```

Alternatively, configure fallback secrets at app creation so `getSigned`/`getEncrypted` try them automatically:

```ts
const app = createApp({
    secret: process.env.COOKIE_SECRET_CURRENT,
    cookie: { secrets: [process.env.COOKIE_SECRET_PREVIOUS ?? ''] },
});
```

### 2.6 Compression

Tune the compression threshold based on payload sizes:

```ts
security: {
    compression: {
        threshold: 1024,
    },
}
```

**Threshold guidelines:**

| Payload Type | Recommended Threshold |
|--------------|----------------------|
| JSON API responses | `1024` bytes |
| HTML pages | `512` bytes |
| Large file downloads | disable (already compressed) |

> **Note:** Compression removes `Content-Length` header automatically since the compressed size differs from the original.

### 2.7 Rate Limiting

`@oneunit/core` provides its own rate limiter via `security().rateLimit()`:

```ts
import { createApp } from '@oneunit/core';

const app = createApp({
    security: {
        rateLimit: {
            windowMs: 15 * 60 * 1000,
            maxRequests: 100,
        },
    },
});

app.use(app.security().rateLimit().middleware());
```

**Per-endpoint rate limiting:**

```ts
const authLimiter = createRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    keyGenerator: (req) => (req as any)?.body?.email ?? 'unknown',
});

app.use("/auth/login", authLimiter.middleware());
```

### 2.8 Input Sanitization

#### HTML Sanitization

Sanitize user-provided HTML to prevent XSS:

```ts
import { createSanitizer } from '@oneunit/core';

const sanitize = createSanitizer({
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    allowedAttributes: {
        a: ['href', 'title'],
    },
    allowedSchemes: ['http', 'https'],
});

const clean = sanitize.sanitize('<p>Hello</p><script>alert("xss")</script>');
console.log(clean); // '<p>Hello</p>'
```

#### Object Sanitization

```ts
const dirty = {
    bio: '<b>hi</b><img src="x" onerror="alert(1)">',
    links: ['https://example.com', 'javascript:alert(1)'],
};

const clean = sanitize.sanitizeObject(dirty);
// { bio: '<b>hi</b>', links: ['https://example.com'] }
```

#### XSS Prevention

- Set `Content-Security-Policy` header via Helmet
- Use `HttpOnly` cookies to prevent JS access to tokens
- Escape output in templates
- Validate all user input against schemas

### 2.9 Error Handling

`tryCatchEnabled` defaults to `true` in `ResponseFrameworkManager`, wrapping middleware execution in try/catch to prevent unhandled exceptions from crashing the process.

**Error response format:**

```json
{
  "success": false,
  "code": "500",
  "msg": "Internal Server Error",
  "data": null,
  "metadata": null
}
```

**Custom error handler:**

```ts
app.use((err, req, res, next) => {
    const status = (err as any).statusCode ?? 500;
    const response = app.response(req, res);

    response.status(status).error({
        code: (err as any).code ?? "INTERNAL_SERVER_ERROR",
        message: process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message,
    });
});
```

---

## 3. System-wide Configuration Requirements

### 3.1 AppOptions Interface Specification

```ts
interface AppOptions {
    serviceName?: string;      // default: "app"
    port?: number;             // default: 3000 (from PORT env or 3000)
    host?: string;             // default: "localhost" (from HOST env or localhost)
    nodeEnv?: string;          // default: "development" (from NODE_ENV env)
    secret?: string;           // signing/encryption secret
    framework?: "express" | "fastify" | "koa" | "http";

    security?: {
        cors?: { origin?: string | string[] | boolean; credentials?: boolean; methods?: string[]; allowedHeaders?: string[]; exposedHeaders?: string[]; maxAge?: number; preflightContinue?: boolean; optionsSuccessStatus?: number };
        csrf?: { secret?: string; cookieName?: string; headerName?: string; cookieOptions?: { path?: string; domain?: string; secure?: boolean; httpOnly?: boolean; sameSite?: "strict" | "lax" | "none"; maxAge?: number }; ignoreMethods?: string[] };
        helmet?: { contentSecurityPolicy?: boolean | Record<string, string[]>; referrerPolicy?: string; xssProtection?: string; frameOptions?: string; hidePoweredBy?: boolean; hsts?: boolean | { maxAge?: number; includeSubDomains?: boolean; preload?: boolean }; noSniff?: boolean; ieNoOpen?: boolean; dnsPrefetchControl?: boolean };
        compression?: { threshold?: number; level?: number; memLevel?: number; strategy?: number; windowBits?: number; filter?: (req, res) => boolean };
        sanitize?: { allowedTags?: string[]; allowedAttributes?: Record<string, string[]>; allowedSchemes?: string[] };
        rateLimit?: { windowMs?: number; maxRequests?: number; keyGenerator?: (req) => string; message?: string; statusCode?: number; includeRetryAfter?: boolean; skipFailedRequests?: boolean; skipSuccessfulRequests?: boolean };
    };
    cookie?: { path?: string; domain?: string; secure?: boolean; httpOnly?: boolean; sameSite?: "strict" | "lax" | "none" | boolean; maxAge?: number; signed?: boolean; encrypted?: boolean; secret?: string; secrets?: string[]; encode?: (value: string) => string; decode?: (value: string) => string };
    multipart?: { maxFileSize?: number; maxFieldsSize?: number; maxFiles?: number; maxFields?: number; allowedMimeTypes?: string[]; uploadDir?: string; fileFilter?: (file) => boolean; tmpdir?: string; headersLimit?: number; timeoutMs?: number };
    health?: { path?: string };
    lifecycle?: { mode?: "easy" | "advanced" | "strict"; executionTimeoutMs?: number; throwOnError?: boolean; maxMiddleware?: number; maxPlugins?: number; allowedMiddlewareTypes?: string[]; autoRegisterEssential?: boolean };
}
```

### 3.2 Environment Variable Mapping

| Environment Variable | AppOptions Field | Default |
|---------------------|-----------------|---------|
| `PORT` | `port` | `3000` |
| `HOST` | `host` | `"localhost"` |
| `SERVICE_NAME` | `serviceName` | `"app"` |
| `NODE_ENV` | `nodeEnv` | `"development"` |
| `SECRET` | `secret` | *(optional)* |

### 3.3 Configuration Precedence

Configuration is resolved in the following order (highest to lowest priority):

1. **Per-call overrides** — arguments passed to individual method calls
2. **Named store defaults** — defaults set when creating a named cookie store
3. **Global app options** — values set in `createApp({ ... })`
4. **Built-in defaults** — package defaults for each option

**Example:**

```ts
const app = createApp({
    cookie: { secure: true, sameSite: "lax" },
});

const store = app.cookies().createStore("auth", { sameSite: "strict" });

store.set("token", value, { secure: false }); // overrides global secure=true
```

### 3.4 Config Validation

| Field | Validation Rule | Error if Invalid |
|-------|----------------|------------------|
| `port` | 1-65535 | `Error` (thrown by createConfig) |
| `secret` | min 32 characters (recommended) | No enforced error |
| `cookie.maxAge` | positive integer | No enforced error |
| `multipart.maxFileSize` | positive integer | No enforced error |

```ts
const config = app.config();
config.set("port", 4000);
console.log(config.get("port")); // 4000
console.log(config.port);        // 4000
```

> Note: `config.set()` and `config.get()` throw `Error` for unknown keys (only `port`, `host`, `serviceName`, `nodeEnv`, `isDevelopment`, `isProduction`, `isTest` are allowed).

### 3.5 Lifecycle Mode Selection Guide

| Mode | Description | Use Case |
|------|-------------|----------|
| `easy` | Auto-wiring, minimal configuration, permissive, throws on errors | Development, prototyping, simple services |
| `advanced` | Explicit registration, conflict warnings, standard validation | Production services with complex middleware (default) |
| `strict` | Strict validation, conflicts throw, 2s execution timeout, max 20 middleware/plugins | High-security, compliance-required environments |

**Mode configuration:**

```ts
const lifecycle = app.lifecycle();
lifecycle.setMode("easy");
lifecycle.initialize();
```

**Example — advanced mode:**

```ts
lifecycle.setMode("advanced");
lifecycle.initialize();

lifecycle.registerMiddleware("cors", "http", corsMw, {
    priority: 10,
    trackHeaders: ["authorization", "content-type"],
});

lifecycle.registerPlugin("auth", "security", {
    beforeAuth: [(ctx) => { /* load user */ }],
    afterAuth: [(ctx) => { /* log */ }],
});

const result = await lifecycle.executeMiddleware("cors", req, res, "request");
```

---

## 4. Operational Standards

### 4.1 Error Handling Patterns

#### OneUnitError Hierarchy

```
OneUnitError
├── CookieError
├── LifecycleError
├── MultipartError
├── ResponseManagementError
├── HooksError
├── LibError
└── CoreError
```

**Error categories:**

| Category | Description |
|----------|-------------|
| `response` | Response management failures |
| `cookie` | Cookie signing/encryption/validation |
| `lifecycle` | Lifecycle/middleware/plugin management |
| `multipart` | Multipart parsing/upload failures |
| `hooks` | Event hook registration/invocation |
| `lib` | Low-level bytes/time/date validation |
| `core` | Core app bootstrap errors |
| `security` | Security/crypto failures |
| `health` | Health check failures |
| `config` | Configuration validation failures |
| `msgpack` | MessagePack encode/decode failures |

**Throwing typed errors:**

```ts
import { OneUnitError, CookieError, MultipartFileTooLargeError } from '@oneunit/core';

throw new CookieError("Invalid cookie", { category: 'cookie', code: 'INVALID_COOKIE_NAME' });
throw new MultipartFileTooLargeError(1048576);
```

**Catching and responding:**

```ts
app.use(async (req, res, next) => {
    try {
        await handler(req, res);
    } catch (err) {
        if (err instanceof OneUnitError) {
            const response = app.response(req, res);
            response.status(500).error({
                code: err.code,
                message: err.message,
                metadata: err.details,
            });
        } else {
            const response = app.response(req, res);
            response.status(500).error({
                code: "INTERNAL_SERVER_ERROR",
                message: err instanceof Error ? err.message : String(err),
            });
        }
    }
});
```

### 4.2 Logging and Monitoring Integration

**Structured logging:**

```ts
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        logger.info({
            service: app.config().get('serviceName'),
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime: Date.now() - start,
            ip: req.ip,
        });
    });
    next();
});
```

**Distributed tracing:**

```ts
app.use((req, res, next) => {
    const traceId = (req as any)?.headers?.['x-trace-id'] ?? crypto.randomUUID();
    (res as any)?.setHeader?.('x-trace-id', traceId);
    logger.child({ traceId }).info('request started');
    next();
});
```

### 4.3 Testing Strategies

#### Unit Tests

```ts
import { describe, it, expect } from 'vitest';
import { createApp } from '@oneunit/core';

describe('config', () => {
    it('should get and set config values', () => {
        const app = createApp({ serviceName: 'test', port: 3000, secret: 'x'.repeat(32) });
        const config = app.config();
        config.set('port', 4000);
        expect(config.get('port')).toBe(4000);
        expect(config.port).toBe(4000);
    });
});
```

#### Integration Tests with Real Servers

```ts
import { describe, it, expect, afterAll } from 'vitest';
import http from 'node:http';
import { createApp } from '@oneunit/core';

describe('health endpoint', () => {
    let server: http.Server;

    beforeAll(async () => {
        const app = createApp({
            serviceName: 'test',
            port: 0,
            secret: 'x'.repeat(32),
            health: { path: '/health' },
        });
        const health = app.health();
        health.register({
            name: 'db',
            check: async () => ({ status: 'healthy' }),
        });
        server = http.createServer((req, res) => {
            const response = app.response(req, res);
            response.ok({ status: 'ok' });
        });
        await health.route(server);
        await new Promise<void>((resolve) => server.listen(0, resolve));
    });

    afterAll(() => server.close());

    it('should return ok status', async () => {
        const addr = server.address() as { port: number };
        const res = await fetch(`http://localhost:${addr.port}/`);
        const body = await res.json();
        expect(body.success).toBe(true);
    });
});
```

#### Cached API Instances

```ts
const health1 = app.health();
const health2 = app.health();
console.log(health1 === health2); // true (same reference)
```

### 4.4 Performance Considerations

| Consideration | Recommendation |
|--------------|----------------|
| Parallel health checks | Register independent dependency checks; they execute concurrently via `Promise.all` |
| Middleware chain overhead | Minimize middleware count; each adds overhead |
| Cookie store reuse | Reuse `app.cookies()` instances; they are cached when no req/res |
| Compression threshold | Set above typical payload size to avoid compressing tiny responses |
| CORS preflight | Cache preflight responses with `maxAge` to reduce OPTIONS requests |

### 4.5 Memory Management

#### Cookie Store Cleanup

Cookie stores hold named configurations in memory. Named stores are cached by name:

```ts
const cookieApi = app.cookies();
const tempStore = cookieApi.createStore("temp", { secure: true });
const sameStore = cookieApi.getStore("temp"); // returns the same store
```

#### Lifecycle Clear

Clear lifecycle registrations during shutdown or testing:

```ts
const lifecycle = app.lifecycle();
lifecycle.clear();
```

### 4.6 Middleware Ordering and Conflict Resolution

Middleware executes in registration order. Order matters for:

1. **CORS** — must run early to handle preflight OPTIONS
2. **Compression** — should run after route handlers that set Content-Type
3. **CSRF** — must run after cookie parsing but before state-changing handlers
4. **Error handling** — must be last to catch all errors

**Recommended order:**

```ts
app
    .use(corsMw)
    .use(helmetMw)
    .use(compressionMw)
    .use(cookieParserMw)
    .use(csrfMw)
    .use(rateLimiterMw)
    .use(routeMw)
    .use(errorMw);
```

**Conflict resolution:** When two middleware modify the same header, the last one wins. Set security headers (CSP, HSTS) after other middleware that might override them.

### 4.7 Plugin Namespace Isolation Best Practices

Register plugins under unique namespaces to avoid collisions:

```ts
lifecycle.registerPlugin("auth", "security", { ... });
lifecycle.registerPlugin("auth", "logging", { ... });
lifecycle.registerPlugin("payments", "security", { ... });
```

**Namespace naming convention:** `<domain>.<concern>` (e.g., `auth.security`, `payments.validation`, `users.audit`).

---

## 5. Common Integration Patterns

### 5.1 Express.js Integration Example (Complete)

```ts
import express from 'express';
import { createApp } from '@oneunit/core';

const core = createApp({
    serviceName: "express-api",
    port: parseInt(process.env.PORT ?? "3000", 10),
    secret: process.env.SECRET,
    security: {
        cors: { origin: process.env.CORS_ORIGIN ?? "*", credentials: true },
        csrf: { cookieName: "csrf", ignoreMethods: ["GET", "HEAD", "OPTIONS"] },
        helmet: { hidePoweredBy: true, hsts: { maxAge: 31536000 } },
    },
    cookie: { secure: true, httpOnly: true, sameSite: "lax" },
});

const expressApp = express();
expressApp.use(express.json());

const health = core.health();
health.register({
    name: "db",
    check: async () => ({ status: "healthy" }),
});

expressApp.get("/health", async (req, res) => {
    const response = core.response(req, res);
    response.ok({ status: "ok" });
});

expressApp.post("/users", async (req, res) => {
    const response = core.response(req, res);
    response.created({ data: { id: 1 }, message: "User created" });
});

const server = expressApp.listen(core.config().port, () => {
    console.log(`Express server listening on port ${core.config().port}`);
});

await health.route(server);
```

### 5.2 Fastify Integration Example (Complete)

```ts
import Fastify from 'fastify';
import { createApp } from '@oneunit/core';

const core = createApp({
    serviceName: "fastify-api",
    port: parseInt(process.env.PORT ?? "3000", 10),
    secret: process.env.SECRET,
});

const fastify = Fastify({
    logger: true,
});

fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try { done(null, JSON.parse(body)); } catch (err) { done(err); }
});

fastify.get('/health', async (req, res) => {
    const response = core.response(req.raw, res.raw);
    response.ok({ status: "ok" });
});

fastify.post('/users', async (req, res) => {
    const response = core.response(req.raw, res.raw);
    response.created({ data: req.body, message: "User created" });
});

const server = fastify.server;
await fastify.listen({ port: core.config().port, host: "0.0.0.0" });
console.log(`Fastify listening on port ${core.config().port}`);
```

### 5.3 Koa Integration Example (Complete)

```ts
import Koa from 'koa';
import { createApp } from '@oneunit/core';

const core = createApp({
    serviceName: "koa-api",
    port: parseInt(process.env.PORT ?? "3000", 10),
    secret: process.env.SECRET,
});

const koaApp = new Koa();

koaApp.use(async (ctx, next) => {
    const response = core.response(ctx.req, ctx.res);
    try {
        await next();
        if (!ctx.res.writableEnded) {
            response.ok({ data: ctx.body, message: "OK" });
        }
    } catch (err) {
        response.status(500).error({ code: "INTERNAL_ERROR", message: (err as Error).message });
    }
});

koaApp.use(async (ctx) => {
    ctx.body = { users: [] };
});

const server = koaApp.listen(core.config().port, () => {
    console.log(`Koa listening on port ${core.config().port}`);
});
```

### 5.4 node:http Integration Example (Complete)

```ts
import http from 'node:http';
import { createApp } from '@oneunit/core';

const core = createApp({
    serviceName: "http-api",
    port: parseInt(process.env.PORT ?? "3000", 10),
    secret: process.env.SECRET,
    health: { path: "/health" },
});

const health = core.health();
health.register({
    name: "db",
    check: async () => ({ status: "healthy" }),
});

const server = http.createServer(async (req, res) => {
    if (req.url === "/health") {
        const response = core.response(req, res);
        response.ok({ status: "ok", checks: { db: "healthy" } });
        return;
    }

    const response = core.response(req, res);
    response.ok({ message: "Hello from node:http" });
});

await health.route(server);

server.listen(core.config().port, () => {
    console.log(`HTTP server listening on port ${core.config().port}`);
});
```

### 5.5 Multi-framework Deployment with Isolated Lifecycle Instances

```ts
import { createApp } from '@oneunit/core';

const publicApp = createApp({
    serviceName: "public-api",
    port: 3000,
    secret: process.env.SECRET,
    security: { cors: { origin: "*", credentials: false } },
});

const internalApp = createApp({
    serviceName: "internal-api",
    port: 3001,
    secret: process.env.SECRET,
    security: { cors: { origin: "https://internal.example.com", credentials: true } },
});

const publicLifecycle = publicApp.lifecycle();
const internalLifecycle = internalApp.lifecycle();

publicLifecycle.setMode("advanced");
internalLifecycle.setMode("strict");

await publicLifecycle.executeMiddlewareChain(req, res, "request");
await internalLifecycle.executeMiddlewareChain(req2, res2, "request");
```

### 5.6 Health Check with Docker/Kubernetes Providers

**Kubernetes probe configuration:**

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 20

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

**Docker Compose health check:**

```yaml
services:
  my-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - SECRET=${SECRET}
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

### 5.7 File Upload Handling with Validation

```ts
import { createApp } from '@oneunit/core';

const core = createApp({
    serviceName: "upload-api",
    secret: process.env.SECRET,
    multipart: {
        maxFileSize: 10 * 1024 * 1024,
        maxFiles: 5,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    },
});

const mp = core.multipart().multipart({
    maxFileSize: 5 * 1024 * 1024,
});

app.post("/upload", mp.middleware(), async (req, res) => {
    const response = core.response(req, res);

    const multipart = (req as any).multipart;
    for (const file of multipart.files) {
        if (!file.mimetype.includes("image/")) {
            return response.status(400).error({ code: "INVALID_FILE_TYPE", message: "Only images allowed" });
        }
    }

    response.ok({ data: { uploaded: multipart.files.length }, message: "Files uploaded" });
});
```

### 5.8 Authentication with Signed Cookies

```ts
const core = createApp({
    serviceName: "auth-api",
    secret: process.env.SESSION_SECRET,
    cookie: { secure: true, httpOnly: true, sameSite: "lax", maxAge: 86400 },
});

app.post("/login", async (req, res) => {
    const cookieApi = core.cookies(req, res);
    cookieApi.setSigned("session", JSON.stringify({ userId: 123, role: "admin" }), {
        secret: process.env.SESSION_SECRET,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
    });

    const response = core.response(req, res);
    response.ok({ message: "Logged in" });
});

function authMiddleware(req, res, next) {
    const cookieApi = core.cookies(req, res);
    const session = cookieApi.getSigned("session", { secret: process.env.SESSION_SECRET });

    if (!session) {
        const response = core.response(req, res);
        return response.status(401).error({ code: "UNAUTHENTICATED", message: "Session required" });
    }

    (req as any).user = JSON.parse(session);
    next();
}

app.post("/logout", (req, res) => {
    const cookieApi = core.cookies(req, res);
    cookieApi.delete("session");

    const response = core.response(req, res);
    response.ok({ message: "Logged out" });
});
```

### 5.9 Encrypted Sensitive Data in Cookies

```ts
const core = createApp({
    serviceName: "vault-api",
    secret: process.env.ENCRYPTION_SECRET,
    cookie: { secure: true, httpOnly: true, sameSite: "strict" },
});

app.post("/store-token", (req, res) => {
    const cookieApi = core.cookies(req, res);
    cookieApi.setEncrypted("oauth_token", "encrypted-access-token-value", {
        secret: process.env.ENCRYPTION_SECRET,
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 3600,
    });

    const response = core.response(req, res);
    response.ok({ message: "Token stored securely" });
});

app.get("/get-token", (req, res) => {
    const cookieApi = core.cookies(req, res);
    const token = cookieApi.getEncrypted("oauth_token", {
        secret: process.env.ENCRYPTION_SECRET,
    });

    if (!token) {
        const response = core.response(req, res);
        return response.status(404).error({ code: "TOKEN_NOT_FOUND", message: "No token found" });
    }

    const response = core.response(req, res);
    response.ok({ data: { token } });
});
```

---

## 6. Migration and Compatibility

### 6.1 Backward Compatibility Guarantees

`@oneunit/core` follows [Semantic Versioning](https://semver.org/):

| Version Segment | Change Type | Compatibility |
|----------------|-------------|---------------|
| Major (1.x.0) | Breaking changes | Not guaranteed |
| Minor (1.1.x) | New features | Backward compatible |
| Patch (1.0.1) | Bug fixes | Fully backward compatible |

**v1.0.0 guarantees:**
- All public APIs documented in USAGE.md are stable
- `createApp`, `app.cookies()`, `app.health()`, `app.response()`, `app.msgpack()`, `app.lib()`, `app.lifecycle()`, `app.config()` signatures are stable
- Cached instance behavior (`app.health() === app.health()`) is guaranteed
- Config get/set behavior is stable

### 6.2 Breaking Change Policy

Breaking changes are only introduced in major version releases. Examples of breaking changes:

- Removing or renaming public methods
- Changing method signatures (parameter order, required vs optional)
- Changing return types of public APIs
- Removing configuration options
- Changing default values of security-sensitive options

**Deprecation process:**
1. Deprecation announced in minor release changelog
2. Deprecated APIs continue to work with deprecation warnings
3. Removal in the next major release

### 6.3 Versioning Strategy

| Release Type | Frequency | Change Scope | Example |
|-------------|-----------|--------------|---------|
| Major | As needed (12-24 months) | Breaking changes | 1.0.0 → 2.0.0 |
| Minor | Monthly | New features, non-breaking | 1.0.0 → 1.1.0 |
| Patch | Weekly/as needed | Bug fixes, security patches | 1.0.0 → 1.0.1 |

**Upgrade recommendations:**

```json
"@oneunit/core": "^1.0.0"
```

**Before upgrading:**
1. Review the changelog for breaking changes
2. Run the test suite against the new version
3. Test in a staging environment first
4. Verify security defaults haven't changed

---

## Appendix: Quick Reference

| API | Method | Purpose |
|-----|--------|---------|
| `createApp(options)` | — | Create application instance |
| `app.config()` | `.get(key)` / `.set(key, val)` | Configuration access |
| `app.cookies(req?, res?)` | `.set()`, `.setSigned()`, `.setEncrypted()`, `.get()`, `.getSigned()`, `.getEncrypted()`, `.delete()`, `.clear()`, `.createStore(name, config)`, `.getStore(name)`, `.serialize()`, `.parse()`, `.all()`, `.has()` | Cookie management |
| `app.health()` | `.register(provider)`, `.check()`, `.route(server)`, `.registerSystem()`, `.registerDocker()`, `.registerKubernetes()`, `.detectEnvironment()` | Health checks |
| `app.response(req, res)` | `.ok()`, `.created()`, `.accepted()`, `.noContent()`, `.badRequest()`, `.unauthorized()`, `.forbidden()`, `.notFound()`, `.conflict()`, `.unprocessable()`, `.internalServerError()`, `.respond()` | Response helpers |
| `app.msgpack()` | `.encode(value)`, `.decode<T>(data)`, `.encodeSync(value)`, `.decodeSync<T>(data)` | MessagePack serialization |
| `app.lib()` | `.formatBytes(bytes, decimals?)`, `.formatTime(ms)`, `.timestamp(date)`, `.getSystemInfo()`, `.getSystemStatus(system, checks, thresholds?)` | System info |
| `app.lifecycle()` | `.getMode()`, `.setMode(mode)`, `.initialize()`, `.registerMiddleware(name, type, mw, opts)`, `.registerPlugin(name, ns, hooks, opts)`, `.executeMiddleware(name, req, res, phase?)`, `.executeMiddlewareChain(req, res, phase?)`, `.executeHook(name, ctx)`, `.clear()` | Lifecycle management |
| `app.multipart()` | `.multipart(options)` | File upload middleware |
| `app.hooks()` | `.on(name, listener)`, `.emit(name, ctx)`, `.emitSync(name, ctx)`, `.off(name, listener)`, `.once(name, listener)`, `.clear()`, `.toJSON()` | Event hooks |
| `app.use(mw)` | — | Express-style middleware registration |
