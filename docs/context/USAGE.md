# Request Context — Usage Guide

**Package:** `@oneunit/core`  
**Module:** `src/context`  
**Import path:** `@oneunit/core` or `@oneunit/core/context`  
**Runtime:** Node.js >= 18  
**Core technology:** `node:async_hooks` (`AsyncLocalStorage<Map<string, unknown>>`)

---

## Overview

Request Context provides asynchronous execution-scoped storage. It lets components share contextual data (request ID, user ID, trace ID, tenant ID, client IP, etc.) without threading that data through every function call.

Each `createRequestContext()` call produces an independent context instance that owns its own `AsyncLocalStorage`. Every `run()` call creates a fresh, isolated `Map` store, so concurrent requests never leak into each other and nested executions receive a fresh, non-inherited context.

```ts
import { createRequestContext } from "@oneunit/core";

const ctx = createRequestContext();

await ctx.run(async () => {
    ctx.set("requestId", "req-123");
    ctx.set("userId", "user-456");

    // Any async work started here sees the same context.
    await doWork();

    console.log(ctx.get("requestId")); // "req-123"
});
```

---

## Installation

`@oneunit/core` is the package containing this module. No additional dependencies are required; it uses only Node.js built-in `node:async_hooks`.

```bash
# If consuming the published package
npm install @oneunit/core
```

---

## Basic API

### Create a context instance

```ts
import { createRequestContext } from "@oneunit/core";

const ctx = createRequestContext<AppContext>({
    initialValues: { application: "api", environment: "production" },
    autoTimestamp: true,
    timestampKey: "timestamp",
    timestampFormat: "iso",
});
```

Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialValues` | `Partial<T>` | `{}` | Values copied into every new context store |
| `autoTimestamp` | `boolean` | `false` | Automatically add an initialization timestamp |
| `timestampKey` | `string` | `"timestamp"` | Key under which the timestamp is stored |
| `timestampFormat` | `"iso" \| "unix" \| "unix-ms"` | `"iso"` | Timestamp representation |

### Context instance methods

```ts
interface AppContext {
    requestId: string;
    userId?: string;
    traceId?: string;
}

const ctx = createRequestContext<AppContext>();
```

| Method | Signature | Active behavior | Inactive behavior |
|--------|-----------|-----------------|-------------------|
| `get` | `get<K extends keyof T>(key: K): T[K] \| undefined` | Returns the stored value | `undefined` |
| `set` | `set<K extends keyof T>(key: K, value: T[K]): boolean` | Stores the value, returns `true` | `false` |
| `delete` | `delete(key: keyof T): boolean` | Removes the key, returns `true` | `false` |
| `has` | `has(key: keyof T): boolean` | Returns whether the key exists | `false` |
| `getAll` | `getAll(): Partial<T>` | Returns a shallow snapshot object | `{}` |
| `clear` | `clear(): void` | Clears all keys in the current store | No-op |
| `isActive` | `isActive(): boolean` | `true` | `false` |
| `run` | `run<R>(fn: () => R \| Promise<R>, values?: Partial<T>): Promise<R>` | Creates an isolated store and executes `fn` | N/A (always creates a store) |

### Reading and writing values

```ts
await ctx.run(async () => {
    ctx.set("requestId", "req-abc");
    ctx.set("userId", "user-1");

    const id = ctx.get("requestId");        // "req-abc"
    const exists = ctx.has("userId");       // true
    const removed = ctx.delete("traceId");  // false (key absent)
    const all = ctx.getAll();               // { requestId: "req-abc", userId: "user-1", ... }
});
```

### Running outside a context boundary

Methods that read or mutate the store return safe defaults when no `run()` is active:

```ts
const ctx = createRequestContext();

ctx.get("requestId");    // undefined
ctx.set("key", "val");   // false
ctx.delete("key");       // false
ctx.has("key");          // false
ctx.getAll();            // {}
ctx.clear();             // no-op, does not throw
ctx.isActive();          // false
```

### Typed schema (compile-time safety)

```ts
interface AppContext {
    requestId: string;
    userId: string;
}

const ctx = createRequestContext<AppContext>();

ctx.set("requestId", "req-1"); // OK
ctx.get("requestId");          // string | undefined

// Type error: number is not assignable to string
// ctx.set("requestId", 123);
```

The runtime store is dynamically keyed (`Map<string, unknown>`); the generic schema provides compile-time guarantees, not runtime validation.

---

## Initial values and precedence

Every `run()` builds its store in this order:

1. Factory-level `initialValues`
2. Automatic timestamp (if `autoTimestamp` is enabled)
3. Values passed to `run()`

Run-specific values override defaults and the automatic timestamp.

```ts
const ctx = createRequestContext<AppContext>({
    initialValues: { requestId: "req-default" },
    autoTimestamp: true,
});

await ctx.run(async () => {
    // "req-default" comes from factory initialValues
    console.log(ctx.get("requestId")); // "req-default"
});

await ctx.run(
    async () => {
        console.log(ctx.get("requestId")); // "req-override"
    },
    { requestId: "req-override" } // run values override factory defaults
);

await ctx.run(
    async () => {
        console.log(ctx.get("timestamp")); // "explicit"
    },
    { timestamp: "explicit" } // run values override autoTimestamp
);
```

### Timestamps

```ts
const ctx = createRequestContext({
    autoTimestamp: true,
    timestampKey: "startedAt",
    timestampFormat: "unix-ms",
});

await ctx.run(async () => {
    console.log(ctx.get("startedAt")); // 1794650400000 (example)
});
```

Supported formats:

| Format | Example |
|--------|---------|
| `iso` | `2026-11-14T10:00:00.000Z` |
| `unix` | `1794650400` (seconds) |
| `unix-ms` | `1794650400000` (milliseconds) |

The timestamp represents context initialization time, not necessarily exact HTTP request arrival time.

---

## Execution isolation

### Concurrent requests

Each `run()` receives its own `Map`. Concurrent executions never share state:

```ts
import { createRequestContext } from "@oneunit/core";

const ctx = createRequestContext<AppContext>();
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const [first, second] = await Promise.all([
    ctx.run(async () => {
        ctx.set("requestId", "request-A");
        await delay(20);
        return ctx.get("requestId");
    }),
    ctx.run(async () => {
        ctx.set("requestId", "request-B");
        await delay(10);
        return ctx.get("requestId");
    }),
]);

// first === "request-A"
// second === "request-B"
```

### Nested execution

Nested `run()` calls create fresh isolated stores. The child does **not** inherit parent values:

```ts
await ctx.run(async () => {
    ctx.set("requestId", "parent");

    await ctx.run(async () => {
        ctx.set("requestId", "child");
        console.log(ctx.get("requestId")); // "child"
    });

    console.log(ctx.get("requestId")); // "parent"
});
```

If inherited execution is needed later, build it as an explicit wrapper around `run()` rather than changing `run()` behavior.

### Multiple instances

Each `createRequestContext()` call owns an independent `AsyncLocalStorage`. Instances never share state:

```ts
const ctxA = createRequestContext<AppContext>();
const ctxB = createRequestContext<AppContext>();

let resultB: string | undefined;
await ctxA.run(async () => {
    ctxA.set("requestId", "instance-A");
    resultB = await ctxB.run(async () => {
        ctxB.set("requestId", "instance-B");
        return ctxB.get("requestId");
    });
    console.log(ctxA.get("requestId")); // "instance-A"
});

console.log(resultB); // "instance-B"
```

---

## Error handling

Callback exceptions and rejections propagate through the returned `Promise`. They are **not** swallowed:

```ts
await ctx.run(async () => {
    throw new Error("boom");
}).catch((err) => {
    console.error(err.message); // "boom"
});

await ctx.run(async () => {
    return Promise.reject(new Error("reject"));
}).catch((err) => {
    console.error(err.message); // "reject"
});
```

A synchronous callback result is also supported:

```ts
const result = await ctx.run(() => {
    ctx.set("requestId", "sync");
    return ctx.get("requestId");
});
// result === "sync"
```

---

## Snapshot semantics

`getAll()` returns a shallow copy of the current store as a plain object. It does **not** expose the internal `Map`, and mutating the returned object does not affect the store:

```ts
await ctx.run(async () => {
    ctx.set("requestId", "req-1");
    const snapshot = ctx.getAll();
    snapshot.requestId = "modified";
    console.log(ctx.get("requestId")); // "req-1" (unchanged)
});
```

Nested objects are shared references — `getAll()` performs a shallow clone only.

---

## Framework integration (consumer-side)

The core module contains no framework code. Adapters live in consumer land. Below are reference patterns for common runtimes.

### Native Node.js HTTP

```ts
import { createServer } from "node:http";
import { createRequestContext } from "@oneunit/core";

const ctx = createRequestContext<AppContext>();

const server = createServer((req, res) => {
    ctx.run(async () => {
        ctx.set("requestId", req.headers["x-request-id"] ?? "unknown");
        ctx.set("clientIp", req.socket?.remoteAddress ?? "unknown");

        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ requestId: ctx.get("requestId") }));
    }).catch((error) => {
        if (!res.headersSent) {
            res.statusCode = 500;
            res.end("Internal Server Error");
        }
    });
});

server.listen(3000);
```

### Express

```ts
import express from "express";
import { createRequestContext } from "@oneunit/core";

const app = express();
const ctx = createRequestContext<AppContext>();

app.use((req, res, next) => {
    ctx.run(() => {
        ctx.set("requestId", req.headers["x-request-id"] ?? "unknown");
        ctx.set("clientIp", req.ip);
        next();
    }).catch(next);
});

app.get("/api", (req, res) => {
    // next() ran inside the context boundary, so context is available here
    res.json({ requestId: ctx.get("requestId") });
});

app.listen(3000);
```

`next()` executes inside the context boundary. Do not treat `next()` as a Promise representing the entire Express request.

### Fastify

```ts
import Fastify from "fastify";
import { createRequestContext } from "@oneunit/core";

const app = Fastify();
const ctx = createRequestContext<AppContext>();

app.addHook("onRequest", (req, reply, done) => {
    ctx.run(() => {
        ctx.set("requestId", req.headers["x-request-id"] ?? "unknown");
        ctx.set("method", req.method);
        done();
    }).catch(done);
});

app.get("/api", async (req, reply) => {
    reply.send({ requestId: ctx.get("requestId") });
});

await app.listen({ port: 3000 });
```

Validate adapter behavior against the supported Fastify versions to verify propagation through the actual request lifecycle.

### Koa

```ts
import Koa from "koa";
import { createRequestContext } from "@oneunit/core";

const app = new Koa();
const ctx = createRequestContext<AppContext>();

app.use(async (koaContext, next) => {
    await ctx.run(async () => {
        ctx.set("requestId", koaContext.headers["x-request-id"] ?? "unknown");
        await next();
    });
});

app.use((koaContext) => {
    koaContext.body = { requestId: ctx.get("requestId") };
});

app.listen(3000);
```

---

## Common patterns

### Service layer access

```ts
const ctx = createRequestContext<AppContext>();

async function getUser() {
    const userId = ctx.get("userId");
    if (!userId) throw new Error("missing userId");
    return database.findUser(userId);
}

async function handleRequest() {
    await ctx.run(async () => {
        ctx.set("userId", "user-123");
        const user = await getUser(); // reads context implicitly
        console.log(user);
    });
}
```

### Logging enrichment

```ts
import { createRequestContext } from "@oneunit/core";

const ctx = createRequestContext<AppContext>();

function log(message: string, data?: Record<string, unknown>) {
    const entry = {
        message,
        requestId: ctx.get("requestId"),
        timestamp: new Date().toISOString(),
        ...data,
    };
    console.log(JSON.stringify(entry));
}

await ctx.run(async () => {
    ctx.set("requestId", "req-abc");
    log("processing order", { orderId: "ord-1" });
});
```

### Detached background tasks

The store is not necessarily garbage-collected immediately when `run()` completes. A detached asynchronous task can retain its associated context while it remains alive. Avoid unbounded detached work, and create independent context boundaries for long-running jobs:

```ts
// Avoid: fire-and-forget inside run() without a boundary
await ctx.run(async () => {
    ctx.set("requestId", "req-1");
    setTimeout(() => {
        console.log(ctx.get("requestId")); // may still read context
    }, 60_000);
});

// Preferred: explicit boundary for independent work
ctx.run(async () => {
    ctx.set("requestId", "background-job");
    await longRunningTask();
});
```

---

## Security considerations

Request Context is a metadata propagation mechanism, not a security boundary:

1. Do not use contextual values as authorization proof.
2. Validate request metadata originating from external input (headers, query params).
3. Avoid storing passwords, tokens, or unnecessary authentication secrets.
4. Do not log all contextual values indiscriminately.
5. Avoid retaining large request and response objects in the store.
6. Treat nested objects as mutable shared references.
7. Remember that `getAll()` creates a shallow snapshot, not a deep clone.

---

## TypeScript schema example

```ts
interface AppContext {
    requestId: string;
    userId: string;
    traceId?: string;
    clientIp?: string;
    timestamp?: string | number;
}

const ctx = createRequestContext<AppContext>({
    initialValues: { application: "core-api" },
    autoTimestamp: true,
    timestampKey: "timestamp",
    timestampFormat: "iso",
});

await ctx.run(
    async () => {
        ctx.set("requestId", "req-999");
        ctx.set("userId", "user-42");

        const id: string \| undefined = ctx.get("requestId");
        const all = ctx.getAll(); // Partial<AppContext>
    },
    { traceId: "trace-777" }
);
```

Consumers using typed schemas must declare a compatible property when enabling timestamp generation (e.g. `timestamp?: string | number`).

---

## Import paths

Root barrel:

```ts
import { createRequestContext } from "@oneunit/core";
import type { RequestContext, RequestContextOptions } from "@oneunit/core";
```

Optional subpath export (configured in the package export map):

```ts
import { createRequestContext } from "@oneunit/core/context";
import type { RequestContext, RequestContextOptions } from "@oneunit/core/context";
```

---

## Checklist

- [ ] Import `createRequestContext` from `@oneunit/core` (or `@oneunit/core/context`)
- [ ] Define a typed schema interface `T extends object`
- [ ] Call `createRequestContext<T>(options?)` once and reuse the instance
- [ ] Wrap request handling in `ctx.run(async () => { ... })`
- [ ] Use `ctx.get` / `ctx.set` / `ctx.has` / `ctx.delete` inside the boundary
- [ ] Rely on `ctx.isActive()` to detect context availability outside `run()`
- [ ] Expect safe defaults (`undefined`, `false`, `{}`, no-op) when inactive
- [ ] Let callback errors/rejections propagate naturally
- [ ] Do not add global `enable()` / `disable()` — they are not part of the API
- [ ] Do not store secrets or use values as authorization proof
- [ ] Treat framework integration (Express, Fastify, Koa, HTTP) as consumer-side adapters
