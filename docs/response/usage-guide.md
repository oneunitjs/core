# Response Management — Usage Guide

@oneunit/core v1.0.0

## Overview

Response Management is a unified, type-safe response layer for building REST APIs. It separates the construction of response payloads (ResponseManager) from the framework-bound act of sending them over HTTP (ResponseFrameworkManager).

The component solves three problems:

1. **Inconsistent payloads.** Different endpoints return responses in different shapes. Response Management enforces one canonical structure: `{ success, code, msg, data?, metadata?, errors? }`.
2. **Framework coupling.** Handlers should not call `res.status(...).json(...)` directly. ResponseFrameworkManager abstracts Express, Fastify, Koa, and node:http behind a single API.
3. **Status-code mistakes.** Status validation prevents bodyless responses (204, 205, 304) from carrying a body, rejects 3xx redirection via `respond()`, and restricts field errors to 4xx/5xx.

Who it is for: API authors using @oneunit/core who want predictable JSON responses, automatic status validation, and optional async handler wrapping via `wrapHandler`.

## Quick Start

Create a success payload:

```ts
import { ResponseManager } from '@oneunit/core';

const response = ResponseManager.success({
  message: 'User created',
  data: { id: 1, name: 'Alice' },
  code: 201,
});
// { success: true, code: 201, msg: 'User created', data: { id: 1, name: 'Alice' } }
```

Send it through an Express handler:

```ts
import { ResponseFrameworkManager } from '@oneunit/core';

app.post('/users', (req, res) => {
  const rfm = app.response(req, res);
  const payload = ResponseManager.success({
    message: 'User created',
    data: { id: 1 },
    code: 201,
  });
  rfm.created({ message: 'User created', data: { id: 1 } });
});
```

## ResponseManager

ResponseManager is stateless. It builds response payloads without knowing about HTTP frameworks.

| Method | Signature | Returns |
|--------|-----------|---------|
| `success` | `success<T>(options: ResponseOptions<T>): SuccessResponse<T>` | `SuccessResponse<T>` |
| `error` | `error<T>(options: ErrorOptions<T>): ErrorResponse<T>` | `ErrorResponse<T>` |
| `paginated` | `paginated<T>(options: PaginatedOptions<T>): SuccessResponse<T>` | `SuccessResponse<T>` |
| `pagination` | `static pagination(total, page, pageSize): PaginationMeta` | `PaginationMeta` |

### success(options)

Builds a success response.

Parameters:
- `message?`: string — human-readable message.
- `data?`: T — optional payload data.
- `code?`: number — HTTP status code (defaults to 200).
- `metadata?`: Record<string, unknown> — optional metadata.
- `headers?`: Record<string, string> — optional response headers.

Returns: `{ success: true, code, msg, data?, metadata? }`.

Example:

```ts
const res = ResponseManager.success({
  message: 'Profile updated',
  data: { id: 42, email: 'alice@example.com' },
  code: 200,
  metadata: { requestId: 'req_123' },
});
```

### error(options)

Builds an error response.

Parameters (extends ResponseOptions):
- `errors?`: FieldError[] — field-level validation errors (only valid on 4xx/5xx).

Returns: `{ success: false, code, msg, data?, metadata?, errors? }`.

Example:

```ts
const res = ResponseManager.error({
  message: 'Validation failed',
  code: 400,
  errors: [
    { field: 'email', message: 'Invalid email format' },
    { field: 'age', message: 'Must be a positive number' },
  ],
});
```

### paginated(options)

Builds a success response with pagination metadata attached.

Parameters:
- `message?`: string
- `data?`: T[] — the page of items.
- `code?`: number (defaults to 200).
- `total`: number — total number of items.
- `page`: number — current page (1-based).
- `pageSize`: number — items per page.
- `metadata?`: Record<string, unknown>
- `headers?`: Record<string, string>

Returns: `SuccessResponse<T>` with `metadata.pagination` populated.

Example:

```ts
const res = ResponseManager.paginated({
  message: 'Users retrieved',
  data: users,
  total: 100,
  page: 2,
  pageSize: 10,
});
// metadata.pagination => { total: 100, page: 2, pageSize: 10, totalPages: 10, hasNext: true, hasPrev: true }
```

### pagination(total, page, pageSize)

Static helper that computes pagination metadata.

Parameters:
- `total`: number — total item count.
- `page`: number — current page (1-based).
- `pageSize`: number — items per page.

Returns: `PaginationMeta { total, page, pageSize, totalPages, hasNext, hasPrev }`.

Example:

```ts
const meta = ResponseManager.pagination(100, 2, 10);
// { total: 100, page: 2, pageSize: 10, totalPages: 10, hasNext: true, hasPrev: true }
```

## ResponseFrameworkManager

ResponseFrameworkManager is obtained from `app.response(req, res)`. It binds payload construction to framework-specific HTTP sending. It auto-detects Express, Fastify, Koa, and node:http.

| Method | Status | Description |
|--------|--------|-------------|
| `ok` | 200 | Success response. |
| `created` | 201 | Resource created. |
| `accepted` | 202 | Request accepted for processing. |
| `noContent` | 204 | No content (bodyless). |
| `badRequest` | 400 | Client error. |
| `unauthorized` | 401 | Authentication required. |
| `forbidden` | 403 | Access denied. |
| `notFound` | 404 | Resource not found. |
| `conflict` | 409 | Request conflicts with current state. |
| `unprocessable` | 422 | Validation error. |
| `internalServerError` | 500 | Server error. |
| `notImplemented` | 501 | Not implemented. |
| `badGateway` | 502 | Bad gateway. |
| `serviceUnavailable` | 503 | Service unavailable. |
| `gatewayTimeout` | 504 | Gateway timeout. |
| `respond` | generic | Send a response at any valid status (200-599). |

All status methods except `noContent` accept `ResponseOptions<T>` (or `ErrorOptions<T>` for errors). `noContent()` takes no options and sends a bodyless 204.

Example:

```ts
const rfm = app.response(req, res);

rfm.ok({ message: 'Retrieved', data: user });
rfm.created({ message: 'Created', data: newUser });
rfm.noContent();
rfm.badRequest({ message: 'Invalid input', errors: [...] });
rfm.notFound({ message: 'User not found' });
rfm.internalServerError({ message: 'Something went wrong' });
```

Generic `respond`:

```ts
rfm.respond({
  status: 202,
  response: { message: 'Accepted', data: job },
});
```

## Options

### ResponseOptions<T>

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | No | Human-readable message. |
| `data` | T | No | Payload data. |
| `code` | number | No | HTTP status code. |
| `metadata` | Record<string, unknown> | No | Arbitrary metadata. |
| `headers` | Record<string, string> | No | Response headers. |

### ErrorOptions<T> extends ResponseOptions<T>

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `errors` | FieldError[] | No | Field-level errors (4xx/5xx only). |

### FieldError

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `field` | string | Yes | Field name. |
| `message` | string | Yes | Error message for the field. |

### RespondOptions<T>

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | number | Yes | HTTP status (200-599). |
| `response` | ResponseOptions<T> | No | Response payload. |
| `errors` | FieldError[] | No | Field errors (4xx/5xx only). |

### PaginationMeta

| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Total items. |
| `page` | number | Current page (1-based). |
| `pageSize` | number | Items per page. |
| `totalPages` | number | Total pages. |
| `hasNext` | boolean | Whether a next page exists. |
| `hasPrev` | boolean | Whether a previous page exists. |

## Status Codes

### Valid status range

`validateStatus(status, range)` accepts statuses from 200 to 599.

Statuses outside 200-599 throw `InvalidStatusCodeError`.

### Success range (2xx)

Valid success statuses are 2xx excluding bodyless statuses 204 and 205. A body cannot be sent with 204 or 205.

### Error range (4xx/5xx)

Valid error statuses are 4xx and 5xx. Field errors are only permitted on 4xx/5xx responses.

### Bodyless statuses

204, 205, and 304 carry no body. Attempting to send a body with any of these throws `BodylessStatusError`.

### 3xx redirection

3xx statuses are not supported via `respond()`. Attempting a 3xx status throws an error.

### Field errors

Field errors (`errors` array) are only valid on 4xx/5xx responses. Attaching them to a 2xx or 3xx status throws a validation error.

Status code table:

| Code | Name | Body | Field errors |
|------|------|------|--------------|
| 200 | OK | Yes | No |
| 201 | Created | Yes | No |
| 202 | Accepted | Yes | No |
| 204 | No Content | No | No |
| 304 | Not Modified | No | No |
| 400 | Bad Request | Yes | Yes |
| 401 | Unauthorized | Yes | Yes |
| 403 | Forbidden | Yes | Yes |
| 404 | Not Found | Yes | Yes |
| 409 | Conflict | Yes | Yes |
| 422 | Unprocessable Entity | Yes | Yes |
| 500 | Internal Server Error | Yes | Yes |
| 501 | Not Implemented | Yes | Yes |
| 502 | Bad Gateway | Yes | Yes |
| 503 | Service Unavailable | Yes | Yes |
| 504 | Gateway Timeout | Yes | Yes |

## Error Responses

Field errors describe per-field validation failures. They are only valid on 4xx/5xx responses.

Example with `ResponseManager.error`:

```ts
const res = ResponseManager.error({
  message: 'Validation failed',
  code: 422,
  errors: [
    { field: 'email', message: 'Email is required' },
    { field: 'password', message: 'Password must be at least 8 characters' },
  ],
});
```

Example with `ResponseFrameworkManager.badRequest`:

```ts
rfm.badRequest({
  message: 'Invalid input',
  errors: [{ field: 'username', message: 'Username already taken' }],
});
```

Resulting payload shape:

```json
{
  "success": false,
  "code": 400,
  "msg": "Invalid input",
  "errors": [
    { "field": "username", "message": "Username already taken" }
  ]
}
```

## wrapHandler

`tryCatchEnabled` defaults to `true`. When enabled, `wrapHandler(handler)` wraps an async request handler in try/catch. If the handler throws, the error is converted into a framework error response automatically.

### Example

```ts
import { wrapHandler } from '@oneunit/core';

app.get('/users/:id', wrapHandler(async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  rfm.ok({ message: 'User retrieved', data: user });
}));
```

If `db.users.findById` throws, `wrapHandler` catches it and sends an appropriate error response instead of crashing the process.

Manual error wrapping example:

```ts
try {
  const result = await riskyOperation();
  rfm.ok({ data: result });
} catch (err) {
  rfm.internalServerError({ message: err.message ?? 'Internal server error' });
}
```

## Framework Integration

ResponseFrameworkManager auto-detects the underlying framework from the request/response objects.

### Express

Express provides `res.status()` and `res.json()`.

```ts
app.get('/users/:id', (req, res) => {
  const rfm = app.response(req, res);
  rfm.ok({ message: 'User retrieved', data: user });
});
```

Internally this calls `res.status(200).json({ ... })`.

### Fastify

Fastify provides `res.raw.send` and `res.code()`.

```ts
app.get('/users/:id', async (req, res) => {
  const rfm = app.response(req, res);
  rfm.created({ message: 'User created', data: newUser });
});
```

Internally this sets the status code via `res.code(201)` and sends JSON via `res.raw.send(...)`.

### Koa

Koa provides `ctx.body` and `ctx.status`.

```ts
app.use(async (ctx) => {
  const rfm = app.response(ctx.req, ctx.res);
  rfm.ok({ message: 'Hello', data: { ok: true } });
});
```

Internally this sets `ctx.status = 200` and `ctx.body = { ... }`.

### node:http

Plain node:http provides `res.writeHead` and `res.end`.

```ts
const server = http.createServer((req, res) => {
  const rfm = app.response(req, res);
  rfm.ok({ message: 'Hello', data: { ok: true } });
});
```

Internally this calls `res.writeHead(200, { 'Content-Type': 'application/json', ...headers })` and `res.end(JSON.stringify(payload))`.

## Best Practices

### Do

- Use `ResponseManager` to build payloads in service layers; use `ResponseFrameworkManager` only in transport handlers.
- Use `paginated()` for list endpoints so clients always receive consistent pagination metadata.
- Attach `errors` only on 4xx/5xx responses.
- Use `noContent()` for deletions and other bodyless 204 responses.
- Rely on `wrapHandler` for async handlers to avoid unhandled promise rejections.
- Pass `metadata` for request IDs, trace IDs, or timestamps.

### Don't

- Do not send a body with 204, 205, or 304 (throws `BodylessStatusError`).
- Do not use 3xx statuses with `respond()` (not supported).
- Do not attach `errors` to 2xx responses.
- Do not mix framework-specific calls (`res.json`, `ctx.body`) inside handlers that use `ResponseFrameworkManager`; pick one style per handler.
- Do not ignore the return value of `ResponseManager` methods if you need to inspect the payload before sending.

## Error Handling

| Error type | When thrown |
|------------|-------------|
| `ResponseManagementError` | Base error for all response management failures. |
| `ResponseValidationError` | Options fail validation (e.g. field errors on a 2xx status, missing required fields). |
| `InvalidStatusCodeError(status)` | Status is outside the valid 200-599 range. |
| `ResponseAlreadySentError` | Attempting to send a response after one has already been sent. |
| `BodylessStatusError(status)` | Attempting to send a body with 204, 205, or 304. |

Example catching errors:

```ts
try {
  rfm.respond({ status: 999, response: { message: 'Bad' } });
} catch (err) {
  if (err instanceof InvalidStatusCodeError) {
    // handle invalid status
  }
}
```

`validateStatus(status, range)` returns `true` for valid statuses and throws `InvalidStatusCodeError` otherwise. Success range is 2xx minus bodyless (204, 205); error range is 4xx/5xx. Bodyless statuses are 204, 205, 304. 3xx redirection is not supported via `respond()`.
