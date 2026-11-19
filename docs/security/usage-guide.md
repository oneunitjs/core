# Security — Usage Guide

@oneunit/core v1.0.0

## Overview

The Security feature of `@oneunit/core` provides a suite of middleware for securing Node.js and web framework applications. It includes CORS, CSRF, Helmet, Compression, Sanitize, and Rate Limit middleware.

All middleware share a common interface called `SecurityMiddleware`:

- `name: string` — middleware identifier.
- `enabled: boolean` (getter) — whether the middleware is currently active.
- `options: Record<string, unknown>` (getter) — the configuration options.
- `enable()` — enable the middleware.
- `disable()` — disable the middleware.
- `toggle()` — flip the enabled state.
- `middleware()` → `(req, res, next) => void` — the framework middleware function.

Each middleware is created through a factory function exposed on the `app.security()` object:

```ts
import { createApp } from "@oneunit/core";

const app = createApp();
const security = app.security();

const cors = security.cors({ origin: "*" });
const csrf = security.csrf({ cookieName: "_csrf" });
const helmet = security.helmet();
const compression = security.compression({ threshold: 1024 });
const sanitize = security.sanitize();
const rateLimit = security.rateLimit({ maxRequests: 100 });
```

## Quick Start

The idiomatic pattern is to create middleware through `app.security()`, configure it with options, and register the `middleware()` return value with your HTTP framework:

```ts
import { createApp } from "@oneunit/core";

const app = createApp();
const security = app.security();

// Enable CORS with permissive origins
app.use(security.cors({ origin: "*" }).middleware());

// Enable security headers
app.use(security.helmet().middleware());

// Enable body compression
app.use(security.compression().middleware());

// Enable rate limiting
app.use(security.rateLimit({ maxRequests: 100 }).middleware());

app.listen(3000);
```

Middleware can be enabled or disabled after creation:

```ts
const cors = security.cors({ origin: "https://example.com" });
cors.disable(); // middleware becomes a no-op passthrough
cors.enable();  // middleware resumes enforcing headers
cors.toggle();  // flips enabled state
```

## CORS

`security.cors(options)` creates Cross-Origin Resource Sharing middleware. It sets `Access-Control-*` headers, handles `OPTIONS` preflight requests, and returns `403` for disallowed origins.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `origin` | `string \| string[] \| boolean` | `"*"` | Allowed origin(s). `true` reflects the request origin. `false` disables CORS. |
| `methods` | `string[]` | `["GET","HEAD","PUT","PATCH","POST","DELETE","OPTIONS"]` | Allowed HTTP methods. |
| `allowedHeaders` | `string[]` | — | Headers the client may send. |
| `exposedHeaders` | `string[]` | — | Headers the client may read. |
| `credentials` | `boolean` | `false` | Whether credentials (cookies, auth) are allowed. |
| `maxAge` | `number` | `86400` | How long preflight results may be cached (seconds). |
| `preflightContinue` | `boolean` | `false` | Pass the preflight to the next handler instead of responding. |
| `optionsSuccessStatus` | `number` | `204` | Status code for successful preflight responses. |

### Behavior

- Sets `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, `Access-Control-Expose-Headers`, `Access-Control-Allow-Credentials`, and `Access-Control-Max-Age` headers.
- For `OPTIONS` preflight requests with a disallowed origin, responds with `403 Forbidden`.
- When `credentials` is `true` and `origin` is `"*"`, the response reflects the request's `Origin` header instead of echoing `*`.

### Examples

Permissive CORS for public APIs:

```ts
app.use(security.cors({ origin: "*" }).middleware());
```

Restricted origin allowlist:

```ts
app.use(
  security.cors({
    origin: ["https://app.example.com", "https://admin.example.com"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    exposedHeaders: ["X-Total-Count"],
    maxAge: 3600,
  }).middleware()
);
```

Reflect request origin with credentials:

```ts
app.use(
  security.cors({
    origin: true,
    credentials: true,
  }).middleware()
);
```

Disable CORS entirely:

```ts
app.use(security.cors({ origin: false }).middleware());
```

## CSRF

`security.csrf(options)` implements the double-submit cookie pattern. A CSRF token is issued as a cookie and must be echoed back in a custom header on state-changing requests. The middleware compares the two values in constant time and rejects mismatches with `403`.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cookieName` | `string` | `"_csrf"` | Name of the CSRF cookie. |
| `headerName` | `string` | `"X-CSRF-Token"` | Header name clients send the token in. |
| `ignoreMethods` | `string[]` | `["GET","HEAD","OPTIONS"]` | HTTP methods that skip CSRF validation. |
| `cookieOptions` | `{ path, sameSite, httpOnly, secure }` | — | Cookie attributes. |

### Methods

- `generateToken()` → `string` — returns a 64-character hex string.
- `validateToken(token, cookieToken)` → `boolean` — constant-time comparison of token and cookie token.
- `getTokenFromRequest(req)` → `string \| undefined` — reads the token from the configured header.
- `middleware()` → `(req, res, next) => void` — skips ignored methods, requires token+cookie match, `403` on failure.
- `middlewareWithToken()` → `(req, res, next) => void` — validates like `middleware()` and re-issues the CSRF cookie on valid requests.

### Token Generation

```ts
const csrf = security.csrf();
const token = csrf.generateToken(); // 64-char hex string
```

### Middleware vs middlewareWithToken

Use `middleware()` for endpoints that validate an incoming token without issuing a new one. Use `middlewareWithToken()` for endpoints that validate and then rotate/re-issue the CSRF cookie (common after login or token refresh).

### Examples

Basic CSRF protection:

```ts
const csrf = security.csrf({
  cookieName: "_csrf",
  headerName: "X-CSRF-Token",
  cookieOptions: {
    path: "/",
    sameSite: "strict",
    httpOnly: true,
    secure: true, // require HTTPS in production
  },
});

// Issue a token cookie to the client
app.get("/csrf-token", (req, res) => {
  const token = csrf.generateToken();
  res.cookie(csrf.options.cookieName as string, token, csrf.options.cookieOptions as any);
  res.json({ csrfToken: token });
});

// Protect state-changing routes
app.post("/api/settings", csrf.middleware(), (req, res) => {
  res.json({ ok: true });
});

// Validate and re-issue the cookie
app.post("/api/login", csrf.middlewareWithToken(), (req, res) => {
  res.json({ ok: true });
});
```

Manual validation:

```ts
const token = csrf.getTokenFromRequest(req);
const cookieToken = req.cookies?._csrf;
if (!token || !csrf.validateToken(token, cookieToken)) {
  res.status(403).send("Forbidden");
  return;
}
```

## Helmet

`security.helmet(options)` sets HTTP response headers that harden the application against common web vulnerabilities. `headers()` returns the header map; `middleware()` applies them to the response.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `contentSecurityPolicy` | `object \| boolean` | `false` | Content-Security-Policy header. |
| `referrerPolicy` | `string` | `"no-referrer"` | Referrer-Policy header value. |
| `xssProtection` | `string` | `"1; mode=block"` | X-XSS-Protection header value. |
| `frameOptions` | `string` | `"SAMEORIGIN"` | X-Frame-Options header value. |
| `hidePoweredBy` | `boolean` | `true` | Remove X-Powered-By header. |
| `hsts` | `boolean \| object` | `false` | Strict-Transport-Security header. |
| `noSniff` | `boolean` | `true` | X-Content-Type-Options: nosniff. |
| `ieNoOpen` | `boolean` | `true` | X-Download-Options: noopen. |
| `dnsPrefetchControl` | `boolean` | `true` | X-DNS-Prefetch-Control: off. |
| `expectCt` | `object \| boolean` | — | Expect-CT header. |
| `featurePolicy` | `object \| boolean` | — | Feature-Policy header. |
| `crossOrigin*` | various | — | Cross-Origin-Embedder-Policy, Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy. |
| `originAgentCluster` | `boolean` | — | Origin-Agent-Cache header. |

### Default Headers

With default options, Helmet sets:

- `Referrer-Policy: no-referrer`
- `X-XSS-Protection: 1; mode=block`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-Download-Options: noopen`
- `X-DNS-Prefetch-Control: off`
- Removes `X-Powered-By`

### Examples

Default hardening:

```ts
app.use(security.helmet().middleware());
```

Custom CSP and HSTS:

```ts
app.use(
  security.helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://trusted.cdn.com"],
        imgSrc: ["'self'", "data:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    frameOptions: "DENY",
    hidePoweredBy: true,
  }).middleware()
);
```

Inspect headers without applying:

```ts
const helmet = security.helmet();
const headerMap = helmet.headers();
// { "referrer-policy": "no-referrer", ... }
```

Disable Helmet at runtime:

```ts
helmet.disable(); // middleware() becomes a no-op passthrough
helmet.enable();
```

## Compression

`security.compression(options)` compresses response bodies using gzip, deflate, or brotli based on the `Accept-Encoding` request header. It monkey-patches `res.write` and `res.end` once per response, removes `Content-Length` when compression occurs, and skips responses below the threshold.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `threshold` | `number` | `1024` | Minimum response body size (bytes) before compressing. |
| `level` | `number` | `6` | Compression level (1-9). |
| `memLevel` | `number` | — | zlib memLevel. |
| `strategy` | `number` | — | zlib compression strategy. |
| `windowBits` | `number` | — | zlib windowBits. |
| `filter` | `(req, res) => boolean` | — | Custom predicate to decide whether to compress. |

### Behavior

- Patches `res.write`/`res.end` exactly once per response.
- Removes `Content-Length` header once the body is compressed (size changes).
- Skips compression for bodies smaller than `threshold`.
- Respects `Accept-Encoding` for gzip, deflate, and br (brotli).

### Examples

Default compression:

```ts
app.use(security.compression().middleware());
```

Higher compression level with custom threshold:

```ts
app.use(
  security.compression({
    threshold: 512,
    level: 9,
  }).middleware()
);
```

Skip compression for specific endpoints:

```ts
app.use(
  security.compression({
    filter: (req, res) => req.path !== "/api/stream",
  }).middleware()
);
```

## Sanitize

`security.sanitize()` provides HTML and object sanitization to prevent XSS. It removes `<script>` tags, event handler attributes (`onclick`, `onerror`, etc.), and disallowed schemes (`javascript:`, `vbscript:`, `data:` where unsafe).

### Methods

- `sanitize(html, options)` → `string` — sanitizes an HTML string.
- `sanitizeObject(obj, options)` → `object` — recursively sanitizes strings inside objects and arrays.

### Defaults

Default allowed tags include common structural and formatting elements (e.g. `p`, `a`, `b`, `i`, `ul`, `ol`, `li`, `h1`–`h6`, `table`, `img`). Default allowed attributes include `href`, `src`, `alt`, `title`, `class`, `id`. Default allowed schemes are `http` and `https`.

### Examples

Sanitize HTML:

```ts
const sanitize = security.sanitize();

const clean = sanitize(
  "<p>Hello</p><script>alert('xss')</script><img src=x onerror=alert(1)>"
);
// "<p>Hello</p><img src=x>"
```

Sanitize an object recursively:

```ts
const userInput = {
  name: "<b>Alice</b>",
  bio: "<p>Hi</p><script>bad()</script>",
  tags: ["<i>tag1</i>", "<svg onload=alert(1)>tag2</svg>"],
};

const clean = sanitize.sanitizeObject(userInput);
// { name: "<b>Alice</b>", bio: "<p>Hi</p>", tags: ["<i>tag1</i>", "tag2"] }
```

### XSS Prevention

Never render unsanitized user input into HTML. Always pass user-generated content through `sanitize()` or `sanitizeObject()` before inserting it into the DOM or server-rendered templates.

## Rate Limit

`security.rateLimit(options)` implements a sliding-window rate limiter. It tracks requests per key and returns `429 Too Many Requests` when the limit is exceeded.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `windowMs` | `number` | `60000` | Sliding window size in milliseconds. |
| `maxRequests` | `number` | `100` | Maximum requests per window per key. |
| `keyGenerator` | `(req) => string` | IP address | Function to derive the rate-limit key from a request. |
| `message` | `string` | `"Too many requests"` | Body/message for 429 responses. |
| `statusCode` | `number` | `429` | HTTP status code for limited responses. |
| `includeRetryAfter` | `boolean` | `true` | Include `Retry-After` header on 429. |

### Response Headers

- `X-RateLimit-Limit` — maximum requests per window.
- `X-RateLimit-Remaining` — requests remaining in the current window.
- `X-RateLimit-Reset` — timestamp (ms) when the window resets.
- `Retry-After` — seconds until the window resets (when `includeRetryAfter` is true).

### Methods

- `getRateLimitInfo(key)` → `{ limit, remaining, reset }` — current usage for a key.
- `resetKey(key)` → `void` — clear the rate-limit record for a key.
- `resetAll()` → `void` — clear all rate-limit records.

### Examples

Default rate limiting by IP:

```ts
app.use(security.rateLimit().middleware());
```

Strict API rate limiting:

```ts
app.use(
  security.rateLimit({
    windowMs: 60000,
    maxRequests: 10,
    keyGenerator: (req) => req.headers["api-key"] || req.ip,
    message: "Rate limit exceeded. Try again later.",
    statusCode: 429,
    includeRetryAfter: true,
  }).middleware()
);
```

Inspect and reset usage:

```ts
const rateLimit = security.rateLimit();

const info = rateLimit.getRateLimitInfo("user:123");
// { limit: 100, remaining: 97, reset: 1700000000000 }

rateLimit.resetKey("user:123");
rateLimit.resetAll();
```

## Common Pattern

Every security middleware follows the same enable/disable/toggle contract:

```ts
const mw = security.cors({ origin: "*" });

mw.enabled;    // true
mw.options;    // { origin: "*", ... }

mw.disable();  // middleware() now calls next() immediately
mw.enabled;    // false

mw.enable();   // middleware() resumes enforcing policy
mw.enabled;    // true

mw.toggle();   // flips to false
```

When disabled, `middleware()` is a transparent passthrough that invokes `next()` without modifying the request or response. This lets you toggle security features at runtime without removing them from the middleware stack.

## Framework Examples

### Express

```ts
import express from "express";
import { createApp } from "@oneunit/core";

const app = createApp();
const expressApp = express();

const security = app.security();

expressApp.use(security.cors({ origin: "*" }).middleware());
expressApp.use(security.helmet().middleware());
expressApp.use(security.compression().middleware());
expressApp.use(security.rateLimit({ maxRequests: 100 }).middleware());

expressApp.post("/api/data", security.csrf().middleware(), (req, res) => {
  res.json({ ok: true });
});

expressApp.listen(3000);
```

### Fastify

```ts
import Fastify from "fastify";
import { createApp } from "@oneunit/core";

const app = createApp();
const fastify = Fastify();

const security = app.security();

fastify.addHook("onRequest", security.cors({ origin: "*" }).middleware());
fastify.addHook("onRequest", security.helmet().middleware());
fastify.addHook("onRequest", security.compression().middleware());
fastify.addHook("onRequest", security.rateLimit().middleware());

fastify.post("/api/data", {
  preHandler: security.csrf().middleware(),
}, async (req, reply) => {
  return { ok: true };
});

fastify.listen({ port: 3000 });
```

### Koa

```ts
import Koa from "koa";
import { createApp } from "@oneunit/core";

const app = createApp();
const koa = new Koa();

const security = app.security();

koa.use(security.cors({ origin: "*" }).middleware());
koa.use(security.helmet().middleware());
koa.use(security.compression().middleware());
koa.use(security.rateLimit().middleware());

koa.use(security.csrf().middleware());
koa.use(async (ctx) => {
  ctx.body = { ok: true };
});

koa.listen(3000);
```

### Node http

```ts
import http from "http";
import { createApp } from "@oneunit/core";

const app = createApp();
const security = app.security();

const cors = security.cors({ origin: "*" }).middleware();
const helmet = security.helmet().middleware();
const rateLimit = security.rateLimit().middleware();

const server = http.createServer((req, res) => {
  cors(req, res, () => {
    helmet(req, res, () => {
      rateLimit(req, res, () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
  });
});

server.listen(3000);
```

## Best Practices

### Production hardening

- Enable Helmet with `hidePoweredBy: true` and a restrictive `frameOptions` (`DENY` or `SAMEORIGIN`).
- Use HTTPS (`secure: true` on cookies) and set `sameSite: "strict"` or `"lax"` on CSRF and session cookies.
- Enable HSTS only after confirming HTTPS is reliable across your domain and subdomains.
- Set a `Content-Security-Policy` that limits script sources to `'self'` and trusted CDNs.

### CORS allowlist

- Avoid `origin: "*"` with `credentials: true` in production; reflect the request origin or use an explicit allowlist instead.
- Keep `allowedHeaders` and `exposedHeaders` minimal.
- Set `maxAge` to a reasonable value (e.g. 3600–86400) to cache preflight results.

### CSRF token handling

- Issue the CSRF token via a `HttpOnly`, `SameSite` cookie and read it from a custom header in JavaScript.
- Apply `middleware()` to all state-changing endpoints (`POST`, `PUT`, `PATCH`, `DELETE`).
- Use `middlewareWithToken()` after login or sensitive actions to rotate the token.
- Never log CSRF tokens or include them in URLs.

### Rate limiting

- Use `keyGenerator` to limit by API key or user ID rather than IP when clients share NAT gateways.
- Combine IP-based and account-based limits for defense in depth.
- Call `resetKey(key)` after a successful password change or MFA verification.
- Set `includeRetryAfter: true` so clients know when to retry.

### Sanitization

- Sanitize all user-generated HTML before storage or rendering.
- Prefer `sanitizeObject()` for request bodies containing rich text fields.
- Do not rely on sanitization alone; combine with CSP and output encoding.

## Error Handling

### 403 responses

CSRF validation failure and disallowed CORS origins both respond with `403 Forbidden`. Handle them consistently:

```ts
app.use((err, req, res, next) => {
  if (err.status === 403 || err.code === "ECSRF" || err.code === "ECORS") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next(err);
});
```

### Validation failures

- Missing CSRF token or cookie → `403`.
- Disallowed CORS origin → `403` on preflight.
- Rate limit exceeded → `429` with `Retry-After` header.
- Sanitization does not throw; it silently strips disallowed content.

### Disabled middleware

When a middleware is `disable()`d, it performs no validation and calls `next()` immediately. No errors are produced by disabled middleware.
