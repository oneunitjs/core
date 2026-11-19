# Feature-Level Documentation — Part 3

**Package:** `@oneunit/core`  
**Version:** `1.0.0`  
**Scope:** Multipart, Response Management, Context, Adapters, Errors  
**Status:** Production-ready

This document is Part 3 of the comprehensive technical documentation suite for `@oneunit/core`. It provides feature-level reference for five components: Multipart, Response Management, Context, Adapters, and Errors. Each feature includes a functional description, API reference, and implementation examples.

Each feature section follows this structure:

- **Functional Description** — purpose, business logic, operational workflow
- **API Reference** — signatures, parameters (mandatory/optional, types, defaults), return values, error codes
- **Implementation Examples** — basic, advanced, cross-framework

---

## 1. Multipart

The Multipart component (`src/multipart/`) parses `multipart/form-data` request bodies using a busboy-based streaming parser. It provides a unified `MultipartMiddleware` surface (`createMultipart`) with options for file size limits, field limits, MIME type allow-listing, upload directory, custom file filtering, timeouts, and framework-specific middleware factories for Express, Fastify, Koa, and Node `http`.

Operational workflow:
1. `createMultipart(options?)` returns a `MultipartMiddleware`.
2. Call `middleware.parse(req)` to parse a raw Node `req` stream into a `MultipartResult`.
3. Use `middleware.middleware()` to wire parsing into a route handler, attaching `req.multipart` with parsed fields and files.
4. Files are held in memory as `Buffer` (no disk streaming by default); fields are collected in `req.multipart.fields`.
5. Limits are enforced during parsing: `maxFileSize`, `maxFieldsSize`, `maxFiles`, `maxFields`, `allowedMimeTypes`, `timeoutMs`.

### 1.1 `createMultipart`

**File:** `src/multipart/middleware.ts`

#### Functional Description

`createMultipart` builds a multipart middleware with `enable`/`disable`/`toggle` lifecycle, a `parse(req)` method for raw stream parsing, and a `middleware()` factory that returns a Connect-style handler. Files are buffered in memory (no `uploadDir` disk writes are implemented). Fields are returned as an array of `{ fieldname, value }`.

#### API Reference

**Signature:**
```ts
function createMultipart(options?: MultipartOptions): MultipartMiddleware
```

**`MultipartOptions`:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `maxFileSize` | `number` | no | `10 * 1024 * 1024` (10 MB) | Max bytes per uploaded file |
| `maxFieldsSize` | `number` | no | `10 * 1024 * 1024` (10 MB) | Max bytes total for all non-file fields |
| `maxFiles` | `number` | no | `10` | Max number of files |
| `maxFields` | `number` | no | `20` | Max number of non-file fields |
| `allowedMimeTypes` | `string[]` | no | `[]` | Allow-list of MIME types; empty array allows all |
| `uploadDir` | `string` | no | `undefined` | Not implemented (files stay in memory) |
| `fileFilter` | `(file) => boolean` | no | `undefined` | Predicate to accept/reject each file |
| `tmpdir` | `string` | no | `undefined` | Temporary directory for busboy |
| `headersLimit` | `number` | no | `2000` | Max header pairs |
| `timeoutMs` | `number` | no | `10000` | Parse timeout in milliseconds |

**`MultipartMiddleware`:**

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `name` | `string` | — | `"multipart"` |
| `enabled` | `boolean` (getter) | — | Whether parsing is enabled |
| `options` | `MultipartOptions` (getter) | — | Resolved options |
| `enable()` | `()` | `void` | Enable parsing |
| `disable()` | `()` | `void` | Disable parsing |
| `toggle()` | `()` | `void` | Flip enabled state |
| `parse(req)` | `(req: unknown)` | `Promise<MultipartResult>` | Parse a raw `req` stream |
| `middleware()` | `()` | `(req, res, next?) => Promise<void>` | Connect-style middleware |

**`MultipartResult`:**

| Field | Type | Description |
|-------|------|-------------|
| `files` | `MultipartFile[]` | Parsed uploaded files |
| `fields` | `MultipartField[]` | Parsed non-file fields |

**`MultipartFile`:**

| Field | Type | Description |
|-------|------|-------------|
| `fieldname` | `string` | Form field name |
| `originalname` | `string` | Client file name |
| `encoding` | `string` | Transfer encoding |
| `mimetype` | `string` | Detected MIME type |
| `size` | `number` | File size in bytes |
| `buffer` | `Buffer` | In-memory file buffer |
| `destination?` | `string` | Not populated |
| `filename?` | `string` | Not populated |
| `path?` | `string` | Not populated |

**`MultipartField`:**

| Field | Type | Description |
|-------|------|-------------|
| `fieldname` | `string` | Field name |
| `value` | `string` | Field value |

**Error codes:**
| Code | Meaning |
|------|---------|
| `MULTIPART_DISABLED` | Multipart parsing is disabled |
| `MULTIPART_FILE_TOO_LARGE` | A file exceeds `maxFileSize` |
| `MULTIPART_TOO_MANY_FILES` | File count exceeds `maxFiles` |
| `MULTIPART_TOO_MANY_FIELDS` | Field count exceeds `maxFields` |
| `MULTIPART_INVALID_MIME_TYPE` | File MIME type not in `allowedMimeTypes` |
| `MULTIPART_PARSE_TIMEOUT` | Parsing exceeded `timeoutMs` |

#### Implementation Examples

**Basic usage (raw Node http):**
```ts
import { createApp } from '@oneunit/core';
import * as http from 'http';

const app = createApp({ serviceName: 'upload-service' });

const server = http.createServer(async (req, res) => {
  if (req.url === '/upload' && req.method === 'POST') {
    try {
      const mp = app.multipart().multipart({ maxFileSize: 5 * 1024 * 1024 });
      const result = await mp.parse(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ fields: result.fields, fileCount: result.files.length }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message, code: (err as any).code }));
    }
  }
});
```

**Advanced (fileFilter + middleware):**
```ts
const mp = app.multipart().multipart({
  maxFileSize: 5 * 1024 * 1024,
  fileFilter: (file) => file.mimetype.startsWith('image/'),
});

const mw = mp.middleware();
mw.enable();

app.use((req, res, next) => {
  if (req.url === '/upload' && req.method === 'POST') {
    mw(req, res, async () => {
      const multipart = (req as any).multipart;
      const saved = multipart.files.map(f => ({
        name: f.originalname,
        type: f.mimetype,
        size: f.size,
      }));
      res.json({ fields: multipart.fields, files: saved });
    });
  }
});
```

**Express:**
```ts
import express from 'express';
import { expressMultipartMiddleware } from '@oneunit/core';

const app = express();
app.use(expressMultipartMiddleware({ maxFileSize: 10 * 1024 * 1024 }));

app.post('/upload', (req, res) => {
  const { fields, files } = (req as any).multipart;
  res.json({ fields, files: files.map(f => f.originalname) });
});
```

**Fastify:**
```ts
import Fastify from 'fastify';
import { fastifyMultipartMiddleware } from '@oneunit/core';

const fastify = Fastify();
await fastify.register(fastifyMultipartMiddleware({ maxFileSize: 10 * 1024 * 1024 }));

fastify.post('/upload', async (req, reply) => {
  const multipart = (req as any).multipart;
  reply.send({ fields: multipart.fields, files: multipart.files.length });
});
```

**Koa:**
```ts
import Koa from 'koa';
import { koaMultipartMiddleware } from '@oneunit/core';

const app = new Koa();
app.use(koaMultipartMiddleware({ maxFileSize: 10 * 1024 * 1024 }));

app.use(async (ctx) => {
  if (ctx.path === '/upload' && ctx.method === 'POST') {
    const multipart = (ctx.req as any).multipart;
    ctx.body = { fields: multipart.fields, files: multipart.files.map(f => f.originalname) };
  }
});
```

**node:http:**
```ts
import http from 'http';
import { httpMultipartMiddleware } from '@oneunit/core';

const mw = httpMultipartMiddleware({ maxFileSize: 10 * 1024 * 1024 });

http.createServer((req, res) => {
  mw(req, res, (err) => {
    if (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
    const multipart = (req as any).multipart;
    res.end(JSON.stringify({ fields: multipart.fields, fileCount: multipart.files.length }));
  });
});
```

---

## 2. Response Management

The Response Management component (`src/response-mangement/`) provides a declarative API for sending HTTP responses: success payloads, error responses, paginated collections, and framework-agnostic status-code helpers. `ResponseManager` builds structured response envelopes. `ResponseFrameworkManager` maps HTTP statuses to named methods (`ok`, `created`, `accepted`, …, `gatewayTimeout`) plus a generic `respond`. `tryCatchEnabled` wraps route handlers to convert thrown errors into structured error responses. Framework adapters bind the manager to Express/Fastify/Koa/http request/response pairs.

### 2.1 `ResponseManager`

**File:** `src/response-mangement/registry.ts`

#### Functional Description

`ResponseManager` is the core response builder. It produces structured `SuccessResponse` / `ErrorResponse` envelopes (not sent directly to the network). `success()` builds a 200 envelope by default; `error()` requires a `status`; `paginated()` builds a paginated success envelope. Static `pagination()` validates and computes pagination metadata.

#### API Reference

**Constructor:**
```ts
new ResponseManager(options?: ResponseManagementOptions)
```

**`ResponseManagementOptions`:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `defaultSuccessMessage` | `string` | `"Success"` | Default success message |
| `defaultErrorMessage` | `string` | `"Error"` | Default error message |

**`ResponseManager` methods:**

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `success(options?)` | `(options?: SuccessOptions)` | `SuccessResponse` | Build success envelope |
| `error(options)` | `(options: ErrorResponseOptions)` | `ErrorResponse` | Build error envelope (status required) |
| `paginated(options)` | `(options: PaginatedOptions)` | `SuccessResponse<T[]>` | Build paginated envelope |
| `static pagination(total, page, pageSize)` | `(number, number, number)` | `PaginationMeta` | Validate + compute pagination |

**`ResponseOptions<T>`:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `message` | `string` | no | `undefined` | Human-readable message |
| `data` | `T` | no | `undefined` | Response data |
| `code` | `string` | no | `undefined` | Application code |
| `metadata` | `Record<string, unknown>` | no | `undefined` | Extra metadata |
| `headers` | `ResponseHeaders` | no | `{}` | Extra response headers |

**`SuccessOptions<T>`:** `ResponseOptions<T> & { status?: number }`

**`ErrorOptions<T>`:** `ResponseOptions<T> & { errors?: FieldError[] }`

**`ErrorResponseOptions`:** `ErrorOptions & { status: number }`

**`SuccessResponse<T>`:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | `true` | Always true |
| `code` | `string` | Status code as string |
| `msg` | `string` | Message |
| `data?` | `T` | Response data |
| `metadata?` | `Record<string, unknown>` | Metadata |

**`ErrorResponse`:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | `false` | Always false |
| `code` | `string` | Status code as string |
| `msg` | `string` | Message |
| `errors?` | `FieldError[]` | Field errors |
| `metadata?` | `Record<string, unknown>` | Metadata |

**`FieldError`:**

| Field | Type | Description |
|-------|------|-------------|
| `field` | `string` | Field name |
| `message` | `string` | Error message |
| `code?` | `string` | Error code |

**`PaginationMeta`:**

| Field | Type | Description |
|-------|------|-------------|
| `total` | `number` | Total items |
| `page` | `number` | Current page |
| `pageSize` | `number` | Items per page |
| `totalPages` | `number` | Computed total pages |

**Error codes:**
| Code | Meaning |
|------|---------|
| `RESPONSE_ERROR` | Generic response failure |
| `RESPONSE_VALIDATION_ERROR` | Response options invalid |
| `INVALID_STATUS_CODE` | Status outside 200–599 |

#### Implementation Examples

**Basic:**
```ts
import { createResponseManager } from '@oneunit/core';

const manager = createResponseManager();

const success = manager.success({ message: 'Created', data: { id: 1 }, status: 201 });
// { success: true, code: '201', msg: 'Created', data: { id: 1 } }

const error = manager.error({ status: 404, message: 'Not found', code: 'NOT_FOUND' });
// { success: false, code: '404', msg: 'Not found' }

const paginated = manager.paginated({
  data: [1, 2, 3],
  pagination: { total: 25, page: 1, pageSize: 10 },
});
// { success: true, code: '200', msg: 'Success', data: [1,2,3], metadata: { pagination: {...} } }

const meta = ResponseManager.pagination(25, 1, 10);
// { total: 25, page: 1, pageSize: 10, totalPages: 3 }
```

---

### 2.2 `ResponseFrameworkManager`

**File:** `src/response-mangement/registry.ts`

#### Functional Description

`ResponseFrameworkManager` wraps a `ResponseManager` and a `ResponseFrameworkAdapter` to send responses directly to the network. It provides named status-code methods (`ok`, `created`, `accepted`, `noContent`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `unprocessable`, `internalServerError`, `notImplemented`, `badGateway`, `serviceUnavailable`, `gatewayTimeout`) plus a generic `respond`. `wrapHandler` wraps route handlers with try/catch to convert thrown errors into error responses.

#### API Reference

**Signature:**
```ts
function createResponseFrameworkManager(
  manager: ResponseManager,
  adapter: ResponseFrameworkAdapter,
  options?: { tryCatchEnabled?: boolean; defaultErrorStatusCode?: number }
): ResponseFrameworkManager
```

**`ResponseFrameworkManager` methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `adapterName` | getter | `string` — adapter name |
| `ok(options?)` | `(options?: SuccessOptions)` | Send 200 |
| `success(options?)` | `(options?: SuccessOptions)` | Send success |
| `created(options?)` | `(options?: SuccessOptions)` | Send 201 |
| `accepted(options?)` | `(options?: SuccessOptions)` | Send 202 |
| `noContent()` | `()` | Send 204 |
| `badRequest(options?)` | `(options?: ErrorOptions)` | Send 400 |
| `unauthorized(options?)` | `(options?: ErrorOptions)` | Send 401 |
| `forbidden(options?)` | `(options?: ErrorOptions)` | Send 403 |
| `notFound(options?)` | `(options?: ErrorOptions)` | Send 404 |
| `conflict(options?)` | `(options?: ErrorOptions)` | Send 409 |
| `unprocessable(options?)` | `(options?: ErrorOptions)` | Send 422 |
| `internalServerError(options?)` | `(options?: ErrorOptions)` | Send 500 |
| `notImplemented(options?)` | `(options?: ErrorOptions)` | Send 501 |
| `badGateway(options?)` | `(options?: ErrorOptions)` | Send 502 |
| `serviceUnavailable(options?)` | `(options?: ErrorOptions)` | Send 503 |
| `gatewayTimeout(options?)` | `(options?: ErrorOptions)` | Send 504 |
| `respond(options)` | `(options: RespondOptions)` | Generic status + body |
| `wrapHandler(handler)` | `(handler) => wrapped` | Wrap handler with try/catch |

**`RespondOptions<T>`:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | `number` | yes | HTTP status code |
| `response?` | `ResponseOptions<T>` | no | Response options |
| `errors?` | `FieldError[]` | no | Field errors |

**`ResponseFrameworkAdapter`:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `name` | `string` | Adapter name |
| `send(payload)` | `(payload: { status, body?, headers? })` | Send response to network |

**Error codes:**
| Code | Meaning |
|------|---------|
| `RESPONSE_ALREADY_SENT` | Response was already sent |
| `BODYLESS_STATUS` | Body sent with a bodyless status (204, 205, 304) |

#### Implementation Examples

**Basic (framework manager):**
```ts
import { createResponseManager, createResponseFrameworkManager } from '@oneunit/core';
import { createExpressResponseAdapter } from '@oneunit/core';

const manager = createResponseManager();
const adapter = createExpressResponseAdapter(res);
const rfm = createResponseFrameworkManager(manager, adapter);

rfm.ok({ data: { id: 1 }, message: 'OK' });        // 200
rfm.created({ data: { id: 1 } });                   // 201
rfm.noContent();                                    // 204
rfm.notFound({ message: 'Not found' });             // 404
rfm.respond({ status: 202, response: { message: 'Accepted' } }); // 202
```

**Advanced (wrapHandler):**
```ts
const safeHandler = rfm.wrapHandler(async (req, res) => {
  throw new Error('boom'); // → 500 error response automatically
});
```

**Standalone helpers:**
```ts
import { ok, created, notFound, error } from '@oneunit/core';

ok(manager, adapter, { data: { id: 1 } });     // 200
created(manager, adapter, { data: { id: 1 } }); // 201
notFound(manager, adapter, { message: 'Missing' }); // 404
error(manager, adapter, { status: 500, message: 'Failed' }); // 500
```

---

### 2.3 `validateStatus`

**File:** `src/response-mangement/registry.ts`

#### Functional Description

`validateStatus` validates that an HTTP status code is an integer in the 200–599 range. With `allowedRange: "success"`, it also requires the status to be a success code (200–299) and not bodyless. With `allowedRange: "error"`, it requires a client or server error code (400–599).

#### API Reference

**Signature:**
```ts
function validateStatus(status: number, allowedRange: "success" | "error" | "any"): void
```

**Error codes:**
| Code | Meaning |
|------|---------|
| `INVALID_STATUS_CODE` | Status outside 200–599 |

#### Implementation Examples

```ts
import { validateStatus } from '@oneunit/core';

validateStatus(200, "success");   // OK
validateStatus(204, "success");   // throws INVALID_STATUS_CODE (bodyless)
validateStatus(404, "error");     // OK
validateStatus(200, "error");     // throws INVALID_STATUS_CODE
```

---

### 2.4 Constants

**File:** `src/response-mangement/types.ts`

| Constant | Description |
|----------|-------------|
| `HTTP_STATUS` | Map of status name → code (e.g. `HTTP_STATUS.OK = 200`) |
| `BODYLESS_STATUSES` | `[204, 205, 304]` |
| `SUCCESS_RESPONSES` | `{ ok: { status: 200 }, created: { status: 201 }, accepted: { status: 202 } }` |
| `ERROR_RESPONSES` | `{ badRequest: { status: 400 }, unauthorized: { status: 401 }, ... }` |
| `DEFAULT_RESPONSE_CONFIG` | `{ defaultSuccessMessage: "Success", defaultErrorMessage: "Error", tryCatchEnabled: true, defaultErrorStatusCode: 500 }` |

**Helper functions:** `isBodylessStatus(status)`, `isClientError(status)`, `isServerError(status)`, `isSuccess(status)`, `isRedirection(status)`.

---

### 2.5 Try/Catch Utilities

**File:** `src/response-mangement/trycatch.ts`

#### Functional Description

`withTryCatch` wraps an async route handler with try/catch. If the handler throws, the error is caught and sent as a standardized error response using the `ResponseManager` and adapter. `createTryCatchMiddleware` returns middleware that wraps subsequent handlers. `withTryCatchConditional` conditionally wraps based on an enabled flag.

#### API Reference

| Function | Signature | Description |
|----------|-----------|-------------|
| `withTryCatch` | `(handler, manager, adapter, options?)` | Wrap handler with try/catch |
| `createTryCatchMiddleware` | `(manager, adapter, options?)` | Return middleware wrapping next handler |
| `withTryCatchConditional` | `(handler, manager, adapter, enabled, options?)` | Conditionally wrap |

**`TryCatchOptions`:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `statusCode` | `number` | `500` | Status code for caught errors |
| `message` | `string` | `undefined` | Custom error message |
| `includeStack` | `boolean` | `false` | Include stack in response metadata |

#### Implementation Examples

```ts
import { withTryCatch } from '@oneunit/core';

const safeHandler = withTryCatch(
  async (req, res) => {
    const data = await riskyOperation();
    res.json(data);
  },
  manager,
  adapter,
  { statusCode: 500, includeStack: false }
);

app.get('/api/data', safeHandler);
```

---

## 3. Context

The Context component (`src/context/`) provides request-scoped state isolation using `AsyncLocalStorage`. `createRequestContext(options?)` returns a `RequestContext` whose `get`/`set`/`delete`/`has`/`getAll`/`clear`/`isActive`/`run` operations are scoped to the current async execution chain, so values set in one request do not leak into concurrent requests. It supports auto-timestamping on creation with configurable key and format (`iso`, `unix`, `unix-ms`).

### 3.1 `createRequestContext`

**File:** `src/context/registry.ts`

#### Functional Description

`createRequestContext` creates a context backed by an `AsyncLocalStorage` instance. Every call to `run()` creates an isolated `Map` store, so concurrent requests never share state and nested executions receive a fresh, non-inherited context. Values set inside a `run` callback are visible to nested async calls within that chain. Operations outside an active `run` boundary are no-ops (return defaults: `undefined`, `false`, `{}`).

#### API Reference

**Signature:**
```ts
function createRequestContext<T extends object = Record<string, unknown>>(options?: RequestContextOptions<T>): RequestContext<T>
```

**`RequestContextOptions<T>`:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `initialValues` | `Partial<T>` | no | `{}` | Seed values for the context store |
| `autoTimestamp` | `boolean` | no | `false` | Auto-set a timestamp on context creation |
| `timestampKey` | `string` | no | `"timestamp"` | Store key for the auto timestamp |
| `timestampFormat` | `"iso" \| "unix" \| "unix-ms"` | no | `"iso"` | Timestamp string format |

**`RequestContext<T>`:**

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `get` | `(key: keyof T)` | `T[keyof T] \| undefined` | Read a value by key |
| `set` | `(key: keyof T, value: T[keyof T])` | `boolean` | Write a value; `false` when no context active |
| `delete` | `(key: keyof T)` | `boolean` | Remove a key; `false` when no context active |
| `has` | `(key: keyof T)` | `boolean` | Check key presence; `false` when no context active |
| `getAll` | `()` | `Partial<T>` | Snapshot all entries; `{}` when no context active |
| `clear` | `()` | `void` | Remove all entries; no-op when no context active |
| `isActive` | `()` | `boolean` | Whether an active store exists |
| `run` | `(fn, values?)` | `Promise<R>` | Run `fn` within the context scope |

**Timestamp formats:**

| Format | Example |
|--------|---------|
| `iso` | `2026-11-19T13:43:06.123Z` |
| `unix` | `1795093386` |
| `unix-ms` | `1795093386123` |

**Isolation mechanism:**
`AsyncLocalStorage` from `node:async_hooks` guarantees that `get`/`set` operations resolve against the store of the nearest enclosing `run` callback, preventing cross-request leakage under concurrent load. Nested `run()` calls create fresh isolated stores; inner stores shadow outer ones.

#### Implementation Examples

**Basic:**
```ts
import { createRequestContext } from '@oneunit/core';

const ctx = createRequestContext();

await ctx.run(async () => {
  ctx.set('userId', 'u_123');
  console.log(ctx.get('userId')); // 'u_123'
  console.log(ctx.has('userId')); // true
  console.log(ctx.getAll());      // { userId: 'u_123' }
  ctx.delete('userId');
  console.log(ctx.has('userId')); // false
});
```

**Request scoping with run:**
```ts
const ctx = createRequestContext();

ctx.run(() => {
  ctx.set('requestId', 'req_abc');
  doAsyncWork(); // can read 'requestId' via ctx.get()
});

async function doAsyncWork() {
  console.log(ctx.get('requestId')); // 'req_abc'
}

console.log(ctx.isActive()); // false (no active run)
ctx.run(() => {
  console.log(ctx.isActive()); // true
});
```

**Auto-timestamp:**
```ts
const ctx = createRequestContext({
  autoTimestamp: true,
  timestampKey: 'createdAt',
  timestampFormat: 'unix-ms',
});

ctx.run(() => {
  console.log(ctx.get('createdAt')); // 1795093386123 (number)
});
```

**Type-safe generics:**
```ts
interface AppContext {
  requestId: string;
  userId: string;
}

const ctx = createRequestContext<AppContext>();

await ctx.run(async () => {
  ctx.set('requestId', 'req-123');    // OK
  ctx.set('userId', 123);             // TypeScript error: number not assignable to string
  const id = ctx.get('requestId');    // string
});
```

---

## 4. Adapters

The Adapters component (`src/adapters/`) centralizes framework bindings through an `AdapterRegistry`. Adapters are registered under a framework key (`express`, `fastify`, `koa`, `http`) and a name. The registry supports `register`, `get`, `getAll`, `getByFramework`, `has`, `remove`, `initializeAll`, `disposeAll`, and a `count` getter. Every adapter implements the `BaseAdapter` contract (`initialize`, `dispose`, `initialized`). Framework-specific cookie, response, middleware, and health adapters translate `@oneunit/core` primitives into native framework calls.

### 4.1 `AdapterRegistry`

**File:** `src/adapters/registry.ts`

#### Functional Description

`AdapterRegistry` stores adapter instances keyed by `${framework}:${name}`. Registration is one-time per key; duplicates are rejected. `initializeAll()` calls `initialize()` on every registered adapter; `disposeAll()` calls `dispose()` and clears the registry.

#### API Reference

**`AdapterRegistry` methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `register(adapter)` | `(adapter: BaseAdapter)` | `{ success, adapterName, framework, error? }` |
| `get(name, framework)` | `(name: string, framework: FrameworkName)` | `AdapterType \| undefined` |
| `getAll()` | `()` | `AdapterEntry[]` |
| `getByFramework(framework)` | `(framework: FrameworkName)` | `AdapterEntry[]` |
| `has(name, framework)` | `(name: string, framework: FrameworkName)` | `boolean` |
| `remove(name, framework)` | `(name: string, framework: FrameworkName)` | `boolean` |
| `initializeAll()` | `()` | `void` |
| `disposeAll()` | `()` | `void` |
| `count` | getter | `number` |

**`defaultAdapterRegistry`:** A shared singleton `AdapterRegistry` instance.

**`BaseAdapter` contract:**

| Member | Type | Description |
|--------|------|-------------|
| `framework` | `FrameworkName` | Target framework |
| `name` | `string` | Adapter name |
| `initialized` | `boolean` | Whether initialized |
| `initialize()` | `() => void` | One-time setup |
| `dispose()` | `() => void` | Teardown |

**`AdapterEntry`:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Adapter name |
| `framework` | `FrameworkName` | Target framework |
| `adapter` | `BaseAdapter` | Adapter instance |
| `registeredAt` | `number` | Registration timestamp |

#### Implementation Examples

**Basic registry usage:**
```ts
import { AdapterRegistry, ExpressCookieAdapter } from '@oneunit/core';

const registry = new AdapterRegistry();
const adapter = new ExpressCookieAdapter({ framework: 'express', request: req, response: res });
const result = registry.register(adapter);
console.log(result.success); // true

const got = registry.get('cookie-express', 'express');
console.log(registry.has('cookie-express', 'express')); // true
console.log(registry.count); // 1

await registry.initializeAll();
// ... use adapters ...
registry.disposeAll();
```

**Get by framework:**
```ts
const expressAdapters = registry.getByFramework('express');
console.log(expressAdapters.length);
```

---

### 4.2 Cookie Adapters

**File:** `src/adapters/cookie/`

| Adapter | Factory | Framework | Read | Write |
|---------|---------|-----------|------|-------|
| `ExpressCookieAdapter` | `createExpressCookieAdapter(req, res)` | Express | `req.headers.cookie` | `res.setHeader('Set-Cookie', ...)` |
| `FastifyCookieAdapter` | `createFastifyCookieAdapter(req, reply)` | Fastify | `req.cookies` | `reply.setCookie()` / `reply.unsetCookie()` |
| `KoaCookieAdapter` | `createKoaCookieAdapter(ctx)` | Koa | `ctx.cookies.get()` | `ctx.cookies.set()` |
| `HttpCookieAdapter` | `createHttpCookieAdapter(req, res)` | node:http | `req.headers.cookie` | `res.setHeader('Set-Cookie', ...)` |

**`BaseCookieAdapter`** implements `CookieAdapter` (`get`, `set`, `delete`, `getAll`) plus `BaseAdapter`. Factory functions call `initialize()` automatically.

---

### 4.3 Response Adapters

**File:** `src/adapters/response/`

| Adapter | Factory | Framework |
|---------|---------|-----------|
| `ExpressResponseAdapter` | `createExpressResponseAdapter(res)` | Express |
| `FastifyResponseAdapter` | `createFastifyResponseAdapter(reply)` | Fastify |
| `KoaResponseAdapter` | `createKoaResponseAdapter(ctx)` | Koa |
| `HttpResponseAdapter` | `createHttpResponseAdapter(res)` | node:http |

**`BaseResponseAdapter`** implements `ResponseFrameworkAdapter` (`send(payload)`) plus `BaseAdapter`. Handles bodyless status codes (204, 304), content-type JSON, and already-sent detection.

---

### 4.4 Middleware Adapters

**File:** `src/adapters/middleware/`

| Adapter | Factory | Framework |
|---------|---------|-----------|
| `ExpressMiddlewareAdapter` | `createExpressMiddlewareAdapter` | Express |
| `FastifyMiddlewareAdapter` | `createFastifyMiddlewareAdapter` | Fastify |
| `KoaMiddlewareAdapter` | `createKoaMiddlewareAdapter` | Koa |
| `HttpMiddlewareAdapter` | `createHttpMiddlewareAdapter` | node:http |

---

### 4.5 Health Adapters

**File:** `src/adapters/health/`

| Adapter | Factory | Framework |
|---------|---------|-----------|
| `ExpressHealthAdapter` | `createExpressHealthAdapter(app, options?)` | Express |
| `FastifyHealthAdapter` | `createFastifyHealthAdapter(server, options?)` | Fastify |
| `KoaHealthAdapter` | `createKoaHealthAdapter(app, options?)` | Koa |
| `HttpHealthAdapter` | `createHttpHealthAdapter(server, options?)` | node:http |

Health adapters register health routes via `createHealthRoute` and expose `registry`, `register`, and `getResult()`.

#### Implementation Examples

**Express cookie adapter:**
```ts
import { createExpressCookieAdapter } from '@oneunit/core';

const adapter = createExpressCookieAdapter(req, res);
// adapter.get('session'), adapter.set('session', 'abc', { httpOnly: true })
```

**Express health adapter:**
```ts
import { createExpressHealthAdapter } from '@oneunit/core';

const adapter = createExpressHealthAdapter(expressApp, { path: '/health' });
adapter.register({ name: 'db', check: async () => ({ status: 'healthy' }) });
adapter.registerRoutes();
```

---

## 5. Errors

The Errors component (`src/errors/`) defines a unified error model for `@oneunit/core`. `OneUnitError` is the base error carrying `message`, `category`, `code`, `details`, `timestamp`, `severity`, and `cause`. `toJSON()` serializes to a plain object safe for logging or response bodies. Errors are grouped into categories (`response`, `cookie`, `lifecycle`, `multipart`, `hooks`, `lib`, `core`, `security`, `health`, `config`, `msgpack`). Each category exposes its own error types, all extending `OneUnitError`.

### 5.1 `OneUnitError` Base

**File:** `src/errors/base.ts`

#### Functional Description

`OneUnitError` extends `Error` and adds structured metadata: `category`, `code`, `details`, `timestamp`, and `severity`. The `cause` option enables error chaining for root-cause analysis. `toJSON()` returns a serializable representation.

#### API Reference

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Human-readable message |
| `category` | `ErrorCategory` | Error category |
| `code` | `string` | Machine-readable error code |
| `details?` | `Record<string, unknown>` | Additional context |
| `timestamp` | `string` | ISO timestamp |
| `severity` | `"warning" \| "error" \| "critical"` | Severity level |
| `cause?` | `Error` | Chained cause |
| `stack` | `string` | Stack trace (from Error) |

**Signature:**
```ts
class OneUnitError extends Error {
  constructor(message: string, options?: {
    category?: ErrorCategory;
    code?: string;
    details?: Record<string, unknown>;
    cause?: Error;
  });
  toJSON(): ErrorInfo & { message: string; stack?: string };
}
```

**`ErrorCategory`:**
```ts
type ErrorCategory =
  | "response" | "cookie" | "lifecycle" | "multipart" | "hooks"
  | "lib" | "core" | "security" | "health" | "config" | "msgpack";
```

**Default values:** `category` defaults to `"core"`, `code` defaults to `"UNKNOWN_ERROR"`, `severity` defaults to `"error"` (or `"critical"` when a `cause` is provided).

#### Implementation Examples

**Basic OneUnitError:**
```ts
import { OneUnitError } from '@oneunit/core';

const err = new OneUnitError('something failed', {
  category: 'core',
  code: 'CORE_ERROR',
  severity: 'high',
  details: { attempt: 3 },
});

console.log(err.category); // 'core'
console.log(err.code);     // 'CORE_ERROR'
console.log(err.toJSON());
// { message, category, code, details, timestamp, severity, stack }
```

**Cookie error chaining:**
```ts
import { CookieDecryptionError } from '@oneunit/core';

try {
  decryptCookie(encryptedValue);
} catch (cause) {
  throw new CookieDecryptionError('failed to decrypt cookie', {
    category: 'cookie',
    code: 'COOKIE_DECRYPTION_ERROR',
    cause,
  });
}
```

---

### 5.2 Error Categories and Types

**Cookie errors** (`src/errors/cookie.ts`):

| Error | Code | Meaning |
|-------|------|---------|
| `CookieError` | `COOKIE_ERROR` | Generic cookie failure |
| `CookieSecretRequiredError` | `COOKIE_SECRET_REQUIRED` | Secret missing for signed/encrypted cookies |
| `InvalidCookieNameError` | `INVALID_COOKIE_NAME` | Cookie name violates naming rules |
| `CookieSecurePrefixError` | `COOKIE_SECURE_PREFIX_ERROR` | `__Secure-`/`__Host-` prefix requires Secure |
| `SameSiteNoneRequiresSecureError` | `SAMESITE_NONE_REQUIRES_SECURE` | SameSite=None requires Secure attribute |
| `CookieDecryptionError` | `COOKIE_DECRYPTION_ERROR` | Failed to decrypt cookie value |
| `CookieSignatureError` | `COOKIE_SIGNATURE_ERROR` | Cookie signature verification failed |

**Lifecycle errors** (`src/errors/lifecycle.ts`):

| Error | Code | Meaning |
|-------|------|---------|
| `LifecycleError` | `LIFECYCLE_ERROR` | Generic lifecycle failure |
| `LifecycleNotInitializedError` | `LIFECYCLE_NOT_INITIALIZED` | Lifecycle used before initialization |
| `MiddlewareLimitError` | `MIDDLEWARE_LIMIT_EXCEEDED` | Middleware count limit exceeded |
| `MiddlewareTypeNotAllowedError` | `MIDDLEWARE_TYPE_NOT_ALLOWED` | Middleware type disallowed at this phase |
| `MiddlewareNotFoundError` | `MIDDLEWARE_NOT_FOUND` | Registered middleware not found |
| `MiddlewareTimeoutError` | `MIDDLEWARE_TIMEOUT` | Middleware execution timed out |
| `PluginLimitError` | `PLUGIN_LIMIT_EXCEEDED` | Plugin count limit exceeded |
| `PluginAlreadyExistsError` | `PLUGIN_ALREADY_EXISTS` | Duplicate plugin registration |
| `MiddlewareConflictError` | `MIDDLEWARE_CONFLICT` | Conflicting middleware registrations |
| `MiddlewareTypeConflictError` | `MIDDLEWARE_TYPE_CONFLICT` | Conflicting middleware types |
| `HeaderConflictError` | `HEADER_CONFLICT` | Conflicting response headers |

**Multipart errors** (`src/errors/multipart.ts`):

| Error | Code | Meaning |
|-------|------|---------|
| `MultipartError` | `MULTIPART_ERROR` | Generic multipart failure |
| `MultipartDisabledError` | `MULTIPART_DISABLED` | Multipart parsing disabled |
| `MultipartFileTooLargeError` | `MULTIPART_FILE_TOO_LARGE` | File exceeds `maxFileSize` |
| `MultipartTooManyFilesError` | `MULTIPART_TOO_MANY_FILES` | File count exceeds `maxFiles` |
| `MultipartTooManyFieldsError` | `MULTIPART_TOO_MANY_FIELDS` | Field count exceeds `maxFields` |
| `MultipartInvalidMimeTypeError` | `MULTIPART_INVALID_MIME_TYPE` | MIME type not allowed |
| `MultipartParseTimeoutError` | `MULTIPART_PARSE_TIMEOUT` | Parse exceeded `timeoutMs` |

**Response errors** (`src/errors/response.ts`):

| Error | Code | Meaning |
|-------|------|---------|
| `ResponseManagementError` | `RESPONSE_ERROR` | Generic response failure |
| `ResponseValidationError` | `RESPONSE_VALIDATION_ERROR` | Response options invalid |
| `InvalidStatusCodeError` | `INVALID_STATUS_CODE` | Status outside 200–599 |
| `ResponseAlreadySentError` | `RESPONSE_ALREADY_SENT` | Response already sent |
| `BodylessStatusError` | `BODYLESS_STATUS` | Body with bodyless status |

**Hooks errors** (`src/errors/hooks.ts`):

| Error | Code | Meaning |
|-------|------|---------|
| `HooksError` | `HOOKS_ERROR` | Generic hooks failure |
| `HookNotAllowedError` | `HOOK_NOT_ALLOWED` | Hook type not permitted |

**Lib errors** (`src/errors/lib.ts`):

| Error | Code | Meaning |
|-------|------|---------|
| `LibError` | `LIB_ERROR` | Generic lib failure |
| `InvalidBytesError` | `INVALID_BYTES` | Invalid byte value |
| `NegativeBytesError` | `NEGATIVE_BYTES` | Negative byte value |
| `InvalidTimeError` | `INVALID_TIME` | Invalid time value |
| `NegativeTimeError` | `NEGATIVE_TIME` | Negative time value |
| `InvalidDateError` | `INVALID_DATE` | Invalid date value |

**Core errors** (`src/errors/core.ts`):

| Error | Code | Meaning |
|-------|------|---------|
| `CoreError` | `CORE_ERROR` | Generic core failure |
| `ResponseRequiresRequestResponseError` | `RESPONSE_REQUIRES_REQUEST_RESPONSE` | `response()` needs req/res pair on first call |

---

### 5.3 `ErrorInfo` Interface

**File:** `src/errors/types.ts`

| Field | Type | Description |
|-------|------|-------------|
| `category` | `ErrorCategory` | Error category |
| `code` | `string` | Machine-readable error code |
| `message` | `string` | Human-readable message |
| `severity` | `"warning" \| "error" \| "critical"` | Severity level |
| `details?` | `Record<string, unknown>` | Additional context |
| `timestamp` | `string` | ISO timestamp |

**`createErrorInfo(category, code, message, severity?, details?)`:** Factory function that creates an `ErrorInfo` object with a timestamp.

#### Implementation Examples

**Response error + toJSON for logging:**
```ts
import { ResponseValidationError } from '@oneunit/core';

const err = new ResponseValidationError('invalid status', {
  category: 'response',
  code: 'INVALID_STATUS_CODE',
  details: { status: 999 },
});

console.error(JSON.stringify(err.toJSON()));
```

---

## Error Code Summary (Part 3)

| Component | Code | Meaning |
|-----------|------|---------|
| Cookie | `COOKIE_ERROR` | Generic cookie failure |
| Cookie | `COOKIE_SECRET_REQUIRED` | Secret missing for signed/encrypted |
| Cookie | `INVALID_COOKIE_NAME` | Bad cookie name |
| Cookie | `COOKIE_SECURE_PREFIX_ERROR` | `__Secure-`/`__Host-` rules violated |
| Cookie | `SAMESITE_NONE_REQUIRES_SECURE` | SameSite=None without Secure |
| Cookie | `COOKIE_DECRYPTION_ERROR` | Encrypted cookie tampered |
| Cookie | `COOKIE_SIGNATURE_ERROR` | Signed cookie signature mismatch |
| Lifecycle | `LIFECYCLE_ERROR` | Generic lifecycle failure |
| Lifecycle | `LIFECYCLE_NOT_INITIALIZED` | Not initialized |
| Lifecycle | `MIDDLEWARE_LIMIT_EXCEEDED` | Middleware limit exceeded |
| Lifecycle | `MIDDLEWARE_TYPE_NOT_ALLOWED` | Middleware type not allowed |
| Lifecycle | `MIDDLEWARE_NOT_FOUND` | Middleware not found |
| Lifecycle | `MIDDLEWARE_TIMEOUT` | Middleware timed out |
| Lifecycle | `PLUGIN_LIMIT_EXCEEDED` | Plugin limit exceeded |
| Lifecycle | `PLUGIN_ALREADY_EXISTS` | Duplicate plugin |
| Lifecycle | `MIDDLEWARE_CONFLICT` | Conflicting middleware |
| Lifecycle | `MIDDLEWARE_TYPE_CONFLICT` | Conflicting middleware types |
| Lifecycle | `HEADER_CONFLICT` | Conflicting headers |
| Multipart | `MULTIPART_ERROR` | Generic multipart failure |
| Multipart | `MULTIPART_DISABLED` | Multipart disabled |
| Multipart | `MULTIPART_FILE_TOO_LARGE` | File too large |
| Multipart | `MULTIPART_TOO_MANY_FILES` | Too many files |
| Multipart | `MULTIPART_TOO_MANY_FIELDS` | Too many fields |
| Multipart | `MULTIPART_INVALID_MIME_TYPE` | Invalid MIME type |
| Multipart | `MULTIPART_PARSE_TIMEOUT` | Parse timeout |
| Response | `RESPONSE_ERROR` | Generic response failure |
| Response | `RESPONSE_VALIDATION_ERROR` | Response options invalid |
| Response | `INVALID_STATUS_CODE` | Status outside 200–599 |
| Response | `RESPONSE_ALREADY_SENT` | Response already sent |
| Response | `BODYLESS_STATUS` | Body with bodyless status |
| Hooks | `HOOKS_ERROR` | Generic hooks failure |
| Hooks | `HOOK_NOT_ALLOWED` | Hook not permitted |
| Lib | `LIB_ERROR` | Generic lib failure |
| Lib | `INVALID_BYTES` | Invalid byte value |
| Lib | `NEGATIVE_BYTES` | Negative byte value |
| Lib | `INVALID_TIME` | Invalid time value |
| Lib | `NEGATIVE_TIME` | Negative time value |
| Lib | `INVALID_DATE` | Invalid date value |
| Core | `CORE_ERROR` | Generic core failure |
| Core | `RESPONSE_REQUIRES_REQUEST_RESPONSE` | response() needs req/res |

---

*End of Part 3 — Feature-Level Documentation for @oneunit/core v1.0.0.*
