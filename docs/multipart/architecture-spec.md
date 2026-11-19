# Multipart — Architecture Specification

@oneunit/core v1.0.0

## Component Overview

**Purpose:** Provide streaming multipart/form-data request parsing for the @oneunit/core package, supporting file uploads and form fields with configurable size limits, MIME type filtering, file filtering, and timeout enforcement.

**Scope:** The Multipart feature covers the parsing of incoming HTTP multipart request bodies into structured results containing files and fields. It is framework-agnostic at its core (`parseMultipart`) and exposes framework-specific middleware factories for Express, Fastify, Koa, and Node.js native `http`.

**Responsibilities:**
- Stream-parse multipart/form-data request bodies using busboy.
- Enforce per-file and aggregate size limits, file count limits, and field count limits during streaming (not after full receipt).
- Filter files by allowed MIME types and an optional async file filter function.
- Enforce a configurable parse timeout as a safety net against hung uploads.
- Detect request abort/close events and reject parsing if the request terminates before completion.
- Provide a reusable `MultipartMiddleware` class with enable/disable/toggle control.
- Expose framework-specific middleware factories (Express, Fastify, Koa, native http) that wrap `parseMultipart`.
- Return a structured `MultipartResult` containing `MultipartFile[]` and `MultipartField[]`.
- Surface domain-specific errors, all extending a base `MultipartError`.

## Source File Map

| File Path | Responsibility | Key Exports |
|-----------|----------------|-------------|
| `src/multipart/index.ts` | Barrel exports and middleware factory entry point | `createMultipartMiddleware`, `expressMultipartMiddleware`, `fastifyMultipartMiddleware`, `koaMultipartMiddleware`, `httpMultipartMiddleware`, all types and errors |
| `src/multipart/types.ts` | TypeScript interfaces and types for the Multipart feature | `MultipartOptions`, `MultipartResult`, `MultipartFile`, `MultipartField`, `MultipartMiddleware` |
| `src/multipart/parser.ts` | Core streaming multipart parsing logic backed by busboy | `parseMultipart`, default options constants |
| `src/multipart/middleware.ts` | `MultipartMiddleware` class and framework middleware factories | `MultipartMiddleware`, `expressMultipartMiddleware`, `fastifyMultipartMiddleware`, `koaMultipartMiddleware`, `httpMultipartMiddleware` |

## Component Relationships Diagram (Mermaid)

```mermaid
graph TD
    req[Incoming HTTP Request]
    busboy[busboy streaming parser]
    parse[parseMultipart(req, options)]
    mm[MultipartMiddleware]
    mw[middleware() handler]
    exp[expressMultipartMiddleware]
    fst[fastifyMultipartMiddleware]
    koa[koaMultipartMiddleware]
    http[httpMultipartMiddleware]

    req -->|pipe| busboy
    busboy -->|events: file/field/finish/error| parse
    mm -->|delegates to| parse
    mw -->|calls| mm.parse
    exp -->|returns| mw
    fst -->|returns| mw
    koa -->|returns| mw
    http -->|returns| mw
    parse -->|result| result[MultipartResult]
```

## Data Flow Diagrams (Mermaid)

### 1. parseMultipart(req, options)

```mermaid
flowchart TD
    A[parseMultipart(req, options)] --> B[merge options with defaults]
    B --> C[create busboy instance]
    C --> D[setup busboy event handlers]
    D --> E[req.pipe(busboy)]
    E --> F[busboy.on("file") → collect file data]
    E --> G[busboy.on("field") → collect field data]
    F --> H{enforce limits: size, count, MIME, filter}
    G --> I{enforce limits: fields size, count}
    H -->|violation| J[reject with MultipartError]
    I -->|violation| J
    H -->|ok| K[accumulate file]
    I -->|ok| L[accumulate field]
    K --> M[busboy.on("finish")]
    L --> M
    M --> N{finished/errored flags}
    N -->|not set| O[set finished, resolve MultipartResult]
    N -->|already set| P[ignore, prevent double resolution]
    Q[busboy.on("error")] --> R[set errored, reject with error]
    S[req abort / close] --> T[set errored, reject]
    U[timeoutMs elapsed] --> V[set errored, reject MultipartParseTimeoutError]
```

### 2. middleware() → Express-style handler

```mermaid
flowchart TD
    A[middleware()] --> B[return (req, res, next)]
    B --> C{MultipartMiddleware.enabled?}
    C -->|false| D[next(MultipartDisabledError)]
    C -->|true| E[parse(req)]
    E -->|resolve result| F[res.json(result) / attach to req]
    E -->|reject error| G[next(err)]
```

### 3. Framework factory → MultipartMiddleware → middleware function

```mermaid
flowchart TD
    A[expressMultipartMiddleware(options)] --> B[new MultipartMiddleware(options)]
    C[fastifyMultipartMiddleware(options)] --> B
    D[koaMultipartMiddleware(options)] --> B
    E[httpMultipartMiddleware(options)] --> B
    B --> F[middleware() returns handler]
    F --> G[Express: (req, res, next)]
    F --> H[Fastify: uses req.raw]
    F --> I[Koa: uses ctx.req]
    F --> J[native http: 400 on error]
```

## Internal State Model

**MultipartMiddleware:**
- `name: "multipart"` — static identifier for the middleware.
- `enabled: boolean` — runtime toggle; when `false`, `parse()` rejects with `MultipartDisabledError`.
- `options: MultipartOptions` — parsed configuration (limits, MIME filter, file filter, timeout).

**parseMultipart:**
- No persistent state. Options are merged with defaults on every call. All accumulation (files, fields, counters) lives in local closures within the single parse invocation.

**busboy:**
- Streaming parser state maintained per request instance. Emits `file`, `field`, `finish`, and `error` events. Connected to the request via `req.pipe(busboy)`.

## Design Patterns

- **Strategy Pattern:** Framework-specific middleware factories (`expressMultipartMiddleware`, `fastifyMultipartMiddleware`, `koaMultipartMiddleware`, `httpMultipartMiddleware`) each return a framework-appropriate handler while delegating parsing to the same `MultipartMiddleware`.
- **Middleware Pattern:** Express-style handler signature `(req, res, next)`; on success attaches result / responds with JSON, on failure calls `next(err)`.
- **Builder Pattern:** Options merging with defaults (`maxFileSize`, `maxFieldsSize`, `maxFiles`, `maxFields`, `timeoutMs`, `allowedMimeTypes`, `fileFilter`) applied per `parseMultipart` call.
- **Observer Pattern:** busboy event handlers (`file`, `field`, `finish`, `error`) react to streaming parser events asynchronously.

## Technical Implementation Details

- **busboy library** for streaming multipart parsing; request is piped into busboy via `req.pipe(busboy)`.
- **Size limits enforced during streaming**, not after full receipt: per-file `maxFileSize`, aggregate `maxFieldsSize`, file count `maxFiles`, field count `maxFields`.
- **MIME type filtering** checked per file against `allowedMimeTypes`; disallowed types raise `MultipartInvalidMimeTypeError`.
- **File filter** can be async; returning `false` skips the file.
- **timeoutMs** safety net against hung uploads; exceeding it raises `MultipartParseTimeoutError`.
- **Request abort detection** via `req.aborted` and `close`/`abort` events; abort before completion rejects the parse promise.
- **finished/errored flags** prevent double promise resolution once the parser settles.

## Concurrency Considerations

- No shared state between `parse` calls; each invocation is independent.
- busboy streams are per-request and not reused across requests.
- `MultipartMiddleware` options are read-only after construction; toggling `enabled` is safe for sequential middleware use.

## Error Model

All errors extend `MultipartError`:

| Error | Trigger |
|-------|---------|
| `MultipartError` | Base error for all multipart errors. |
| `MultipartDisabledError` | `parse()` called while middleware is disabled. |
| `MultipartFileTooLargeError(maxFileSize)` | A single file exceeds `maxFileSize`. |
| `MultipartTooManyFilesError(maxFiles)` | File count exceeds `maxFiles`. |
| `MultipartTooManyFieldsError(maxFields)` | Field count exceeds `maxFields`. |
| `MultipartInvalidMimeTypeError(mimetype)` | File MIME type not in `allowedMimeTypes`. |
| `MultipartParseTimeoutError` | Parse exceeded `timeoutMs`. |

## Complexity Analysis

- **Time complexity:** O(n) where n is the total request body size; each byte is streamed through busboy exactly once.
- **Space complexity:** O(m + f) where m is the aggregate field data size and f is the total accepted file data size; files and fields are accumulated in memory until the promise resolves.
- Limit enforcement is O(1) per file/field event during streaming.
