# Response Management Feature Architecture

## Overview

The response-management feature provides a framework-agnostic HTTP response envelope system with consistent success/error response formatting, predefined HTTP status code helpers, and framework adapters for Express, Fastify, Koa, and native `node:http`.

## File layout

```
src/response-mangement/
├── index.ts              # Public barrel exports
├── types.ts              # TypeScript interfaces, HTTP status codes, response types
├── errors.ts             # Custom error classes
├── registry.ts           # Core ResponseManager, ResponseFrameworkManager, adapters, validation
└── adapters/
    ├── index.ts          # Adapter barrel exports
    ├── types.ts          # Framework adapter interfaces
    ├── express.ts        # Express res adapter
    ├── fastify.ts        # Fastify reply adapter
    ├── koa.ts            # Koa ctx adapter
    └── http.ts           # node:http res adapter
```

## Core concepts

### ResponseManager

`ResponseManager` is the central abstraction. It builds response envelope objects without writing to any framework response object. It owns default success/error messages and exposes:

- `success(options)` — builds a success `SuccessResponse` envelope. `options.status` is optional (defaults to 200).
- `error(options)` — builds an error `ErrorResponse` envelope. `options.status` is required (400–599).
- `paginated(options)` — builds a paginated success response with `metadata.pagination`
- `static pagination(total, page, pageSize)` — computes `PaginationMeta` with strict validation

`createResponseManager(options?)` creates a `ResponseManager` with optional `ResponseManagementOptions`:
- `defaultSuccessMessage` — overrides "Success"
- `defaultErrorMessage` — overrides "Error"

### Response envelope types (discriminated union)

```ts
export interface SuccessResponse<T = unknown> {
    success: true;
    code: string;
    msg: string;
    data?: T;
    metadata?: Record<string, unknown>;
    errors?: never;
}

export interface ErrorResponse {
    success: false;
    code: string;
    msg: string;
    data?: never;
    metadata?: Record<string, unknown>;
    errors?: FieldError[];
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;
```

Success envelope example:
```json
{ "success": true, "code": "201", "msg": "Resource created", "data": { "id": 42 } }
```

Error envelope example:
```json
{ "success": false, "code": "404", "msg": "Resource not found", "errors": [{ "field": "email", "message": "Email not found" }] }
```

TypeScript enforces:
- Success responses cannot contain `errors` (`errors?: never`)
- Error responses cannot contain `data` (`data?: never`)
- Consumers can narrow responses using `success`

### FieldError

```ts
export interface FieldError {
    field: string;
    message: string;
    code?: string;
}
```

### ResponseFrameworkManager

`ResponseFrameworkManager` bridges a `ResponseManager` with a framework-specific `ResponseFrameworkAdapter`. It calls `manager.success()`/`manager.error()` to build the envelope, then `adapter.send()` to write it to the framework response.

All convenience methods (`ok`, `created`, `accepted`, `badRequest`, `notFound`, etc.) delegate to `respond()`, ensuring identical validation, envelope construction, and adapter behavior.

Methods:
- `ok(options)` — 200
- `success(options)` — status from options (default 200)
- `created(options)` — 201
- `accepted(options)` — 202
- `noContent()` — 204 (no body, no envelope)
- `badRequest(options)` — 400
- `unauthorized(options)` — 401
- `forbidden(options)` — 403
- `notFound(options)` — 404
- `conflict(options)` — 409
- `unprocessable(options)` — 422
- `internalServerError(options)` — 500
- `notImplemented(options)` — 501
- `badGateway(options)` — 502
- `serviceUnavailable(options)` — 503
- `gatewayTimeout(options)` — 504
- `respond(options)` — arbitrary status code with full validation
- `paginated(options)` — 200 with pagination metadata
- `error(options)` — arbitrary error status

### ResponseOptions and headers

```ts
export type ResponseHeaders = Record<string, string | string[]>;

export interface ResponseOptions<T = unknown> {
    message?: string;
    data?: T;
    code?: string;
    metadata?: Record<string, unknown>;
    headers?: ResponseHeaders;
}

export interface SuccessOptions<T = unknown> extends ResponseOptions<T> {
    status?: number;
}

export interface ErrorOptions<T = unknown> extends ResponseOptions<T> {
    errors?: FieldError[];
}

export interface ErrorResponseOptions extends ErrorOptions {
    status: number;
}
```

Custom headers are merged with `content-type: application/json`. User-provided headers cannot override `content-type`. Multiple header values are supported via string arrays.

### ResponseFrameworkAdapter

`ResponseFrameworkAdapter` bridges the manager to a web framework:

```ts
export interface ResponseFrameworkAdapter {
    readonly name: string;
    send(response: {
        status: number;
        body?: unknown;
        headers?: ResponseHeaders;
    }): void;
    getRequestId?(request: unknown): string | undefined;
}
```

| Adapter | Constructor arg | Framework |
|---------|----------------|-----------|
| `createExpressAdapter(res)` | Express `res` | Express |
| `createFastifyAdapter(reply)` | Fastify `reply` | Fastify |
| `createKoaAdapter(ctx)` | Koa `ctx` | Koa |
| `createHttpAdapter(res)` | node:http `res` | node:http |

All adapters:
- Check `headersSent`/`writableEnded` to prevent double-sending
- Omit body and `Content-Type` for bodyless statuses (204, 205, 304)
- Support multiple header values via string arrays
- Set `content-type: application/json` only when a body is present

### Standalone helper functions

`respondTo()`, `ok()`, `created()`, `notFound()`, `error()` are thin wrappers that create a `ResponseFrameworkManager` internally per call.

### HTTP status codes

`HTTP_STATUS` is a const object with named constants for all standard HTTP status codes (100–511). `HttpStatusCode` is a union type of all valid codes.

Helper predicates:
- `isSuccess(status)` — 200–299
- `isClientError(status)` — 400–499
- `isServerError(status)` — 500–599
- `isRedirection(status)` — 300–399
- `isBodylessStatus(status)` — true for 204, 205, 304

`BODYLESS_STATUSES` = `[204, 205, 304]` — these statuses must not include a response body or envelope.

Centralized validation via `validateStatus(status, allowedRange)`:
- `"success"` — accepts 200–299, excludes bodyless statuses
- `"error"` — accepts 400–599
- `"any"` — accepts 200–599

### Predefined responses

`ERROR_RESPONSES` and `SUCCESS_RESPONSES` are const objects mapping semantic names to `{ status, message }` for common API cases:

```ts
ERROR_RESPONSES.badRequest        // { status: 400, message: "Bad request" }
ERROR_RESPONSES.unauthorized      // { status: 401, message: "Authentication required" }
ERROR_RESPONSES.forbidden         // { status: 403, message: "Access forbidden" }
ERROR_RESPONSES.notFound          // { status: 404, message: "Resource not found" }
ERROR_RESPONSES.conflict          // { status: 409, message: "Resource conflict" }
ERROR_RESPONSES.validationError   // { status: 422, message: "Validation failed" }
ERROR_RESPONSES.tooManyRequests   // { status: 429, message: "Too many requests" }
ERROR_RESPONSES.serverError       // { status: 500, message: "Internal server error" }
ERROR_RESPONSES.badGateway        // { status: 502, message: "Bad gateway" }
ERROR_RESPONSES.serviceUnavailable // { status: 503, message: "Service unavailable" }
ERROR_RESPONSES.gatewayTimeout    // { status: 504, message: "Gateway timeout" }

SUCCESS_RESPONSES.ok              // { status: 200, message: "Success" }
SUCCESS_RESPONSES.created         // { status: 201, message: "Resource created successfully" }
SUCCESS_RESPONSES.accepted        // { status: 202, message: "Request accepted" }
```

`ErrorResponseName = keyof typeof ERROR_RESPONSES` and `SuccessResponseName = keyof typeof SUCCESS_RESPONSES`.

### Pagination

```ts
export interface PaginationMeta {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface PaginatedOptions<T> extends ResponseOptions<T[]> {
    data: T[];
    pagination: PaginationMeta;
}
```

`ResponseManager.pagination(total, page, pageSize)` validates:
- `total` must be a non-negative safe integer
- `page` must be a positive safe integer (>= 1)
- `pageSize` must be a positive safe integer (>= 1)
- Rejects `NaN`, `Infinity`, and unsafe integers

### Custom errors

`errors.ts` defines:
- `ResponseManagementError` — base error
- `ResponseValidationError` — invalid response options
- `InvalidStatusCodeError` — invalid HTTP status code
- `ResponseAlreadySentError` — response already sent (adapters)
- `BodylessStatusError` — body included for bodyless status

### Framework detection

`detectResponseFramework(req, res, ctx)` auto-detects the web framework:

| Framework | Detection characteristics |
|-----------|--------------------------|
| Koa | Context with `cookies` |
| Fastify | Reply with `code`, `send`, `type` methods |
| Express | Response with `status`, `json`, `send`, `type` methods |
| node:http | Response with `setHeader`, `writeHead`, `end` |

Returns `{ framework, confidence }` where `framework` is `"express" \| "fastify" \| "koa" \| "http" \| "unknown"`.

Detection is heuristic — explicit adapter construction remains the primary API.

## Usage examples

### Direct manager usage (no framework)

```ts
import { createResponseManager, HTTP_STATUS } from "./response-mangement/index.js";

const manager = createResponseManager({
    defaultSuccessMessage: "Operation completed",
    defaultErrorMessage: "Something went wrong",
});

// Success with status in options
const res = manager.success({ status: 201, data: { id: 1 }, message: "Created" });
// { success: true, code: "201", msg: "Created", data: { id: 1 } }

// Default message
const res2 = manager.success({ data: { id: 1 } });
// { success: true, code: "200", msg: "Operation completed", data: { id: 1 } }

// Error
const err = manager.error({
    status: 404,
    message: "Not found",
    errors: [{ field: "email", message: "Email not found" }],
});
// { success: false, code: "404", msg: "Not found", errors: [...] }

// Paginated
const page = manager.paginated({
    data: [{ id: 1 }],
    pagination: ResponseManager.pagination(10, 1, 10),
});
// { success: true, code: "200", msg: "Operation completed", data: [...], metadata: { pagination: {...} } }
```

### With Express

```ts
import { createResponseManager, createExpressAdapter, createResponseFrameworkManager } from "./response-mangement/index.js";

const manager = createResponseManager();

app.get("/users/:id", (req, res) => {
    const adapter = createExpressAdapter(res);
    const rfm = createResponseFrameworkManager(manager, adapter);
    rfm.ok({ data: { id: req.params.id }, message: "User retrieved" });
});

app.post("/users", (req, res) => {
    const adapter = createExpressAdapter(res);
    const rfm = createResponseFrameworkManager(manager, adapter);
    rfm.created({ data: { id: 42 }, message: "User created" });
});

app.get("/missing", (_req, res) => {
    const adapter = createExpressAdapter(res);
    const rfm = createResponseFrameworkManager(manager, adapter);
    rfm.notFound({ message: "User not found" });
});

// With custom headers
rfm.ok({
    data: users,
    headers: { "Cache-Control": "no-store", "X-Request-Id": "req-123" },
});
```

### With Fastify

```ts
import { createResponseManager, createFastifyAdapter, createResponseFrameworkManager } from "./response-mangement/index.js";

const manager = createResponseManager();

fastify.get("/ok", async (_req, reply) => {
    const adapter = createFastifyAdapter(reply);
    const rfm = createResponseFrameworkManager(manager, adapter);
    rfm.ok({ data: { id: 1 }, message: "OK" });
});

fastify.get("/error", async (_req, reply) => {
    const adapter = createFastifyAdapter(reply);
    const rfm = createResponseFrameworkManager(manager, adapter);
    rfm.internalServerError({ message: "Something went wrong" });
});
```

### With Koa

```ts
import { createResponseManager, createKoaAdapter, createResponseFrameworkManager } from "./response-mangement/index.js";

const manager = createResponseManager();

app.use(async (ctx) => {
    const adapter = createKoaAdapter(ctx);
    const rfm = createResponseFrameworkManager(manager, adapter);
    rfm.ok({ data: { id: 1 }, message: "OK" });
});
```

### With node:http

```ts
import { createResponseManager, createHttpAdapter, createResponseFrameworkManager } from "./response-mangement/index.js";

const manager = createResponseManager();

const server = http.createServer((req, res) => {
    const adapter = createHttpAdapter(res);
    const rfm = createResponseFrameworkManager(manager, adapter);
    rfm.ok({ data: { id: 1 }, message: "OK" });
});
```

### Standalone helper functions

```ts
import { respondTo, ok, created, notFound, error, createResponseManager, createExpressAdapter } from "./response-mangement/index.js";

const manager = createResponseManager();
const adapter = createExpressAdapter(res);

// Arbitrary status
respondTo(manager, adapter, { status: 202, response: { message: "Accepted" } });

// Convenience
ok(manager, adapter, { data: { id: 1 } });
created(manager, adapter, { data: { id: 42 } });
notFound(manager, adapter, { message: "Not found" });
error(manager, adapter, { status: 400, message: "Bad request" });
```

## Type exports

Runtime values:
- `ResponseManager`, `createResponseManager`
- `ResponseFrameworkManager`, `createResponseFrameworkManager`
- `createExpressAdapter`, `createFastifyAdapter`, `createKoaAdapter`, `createHttpAdapter`
- `detectResponseFramework`, `validateStatus`
- `respondTo`, `ok`, `created`, `notFound`, `error`
- `HTTP_STATUS`, `ERROR_RESPONSES`, `SUCCESS_RESPONSES`, `BODYLESS_STATUSES`, `DEFAULT_RESPONSE_CONFIG`
- `isBodylessStatus`, `isClientError`, `isServerError`, `isSuccess`, `isRedirection`
- `ResponseManagementError`, `ResponseValidationError`, `InvalidStatusCodeError`, `ResponseAlreadySentError`, `BodylessStatusError`

Types:
- `ApiResponse<T>`, `SuccessResponse<T>`, `ErrorResponse`, `FieldError`
- `ResponseOptions<T>`, `SuccessOptions<T>`, `ErrorOptions<T>`, `ErrorResponseOptions`
- `PaginationMeta`, `PaginatedOptions<T>`, `RespondOptions<T>`
- `ResponseManagementOptions`, `ResponseManagementPluginOptions`
- `ResponseHeaders`
- `HttpStatusCode`, `HttpStatusCodeValue`, `ErrorResponseName`, `SuccessResponseName`
- `ResponseFrameworkAdapter`, `FastifyLikeReply`, `ExpressLikeResponse`, `KoaLikeContext`, `HttpLikeServerResponse`
- `DetectedResponseFramework`

## Design notes

- **Framework agnostic**: `ResponseManager` knows nothing about HTTP frameworks; it only builds plain objects. Framework-specific writing is delegated to adapters.
- **Consistent envelope**: Every response uses the same `{ success, code, msg, data?, metadata?, errors? }` shape.
- **Discriminated types**: `SuccessResponse` has `errors?: never` and `ErrorResponse` has `data?: never`, preventing invalid type combinations at compile time.
- **Status code safety**: All status codes are validated centrally via `validateStatus()`. Bodyless statuses (204, 205, 304) reject bodies. 3xx responses (except 304) redirect to dedicated redirect handling.
- **Default messages**: `ResponseManagementOptions` lets applications set global default success/error messages.
- **No double-sending**: Adapters check `headersSent`/`writableEnded` before writing.
- **Pagination**: `ResponseManager.pagination()` is a static utility with strict validation; `paginated()` attaches it under `metadata.pagination`.
