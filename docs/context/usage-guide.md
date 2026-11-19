# Context — Usage Guide

@oneunit/core v1.0.0

## Overview

The Context component provides request-scoped storage using Node.js `AsyncLocalStorage`. Each invocation of `run()` creates an isolated `Map` store, guaranteeing that concurrent requests do not leak state into one another. There is no inheritance between concurrent request stores.

This is useful for storing data that should be available to any function in the call stack during the lifetime of a single request, without explicitly threading that data through every function parameter. Typical values include request ID, user ID, trace ID, and client IP.

## Quick Start

Create a context, then execute work inside an isolated store using `run()`:

```typescript
import { createRequestContext } from '@oneunit/core';

const ctx = createRequestContext();

await ctx.run(async () => {
  ctx.set('requestId', 'req_123');
  ctx.set('userId', 'user_456');

  console.log(ctx.get('requestId')); // 'req_123'
  console.log(ctx.getAll());         // { requestId: 'req_123', userId: 'user_456' }
});
```

Values set inside `run()` are only visible to code executing within that same `run()` invocation. Code running outside of `run()`, or in a concurrent `run()`, cannot read them.

## createRequestContext()

`createRequestContext<T>(options?)` returns a `RequestContext<T>` instance.

### Options

`RequestContextOptions<T>`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialValues` | `Partial<T>` | `{}` | Initial values populated into every new store created by `run()`. |
| `autoTimestamp` | `boolean` | `false` | When `true`, a timestamp is automatically added to each new store. |
| `timestampKey` | `string` | `"timestamp"` | Store key used for the auto-generated timestamp. |
| `timestampFormat` | `"iso" \| "unix" \| "unix-ms"` | `"iso"` | Format of the auto-generated timestamp value. |

Example with options:

```typescript
const ctx = createRequestContext<{ requestId?: string; userId?: string }>({
  autoTimestamp: true,
  timestampFormat: 'unix-ms',
});
```

## RequestContext API

`RequestContext<T>` methods:

| Method | Signature | Parameters | Return | Description |
|--------|-----------|------------|--------|-------------|
| `get` | `get(key): T \| undefined` | `key`: store key | The stored value, or `undefined` if absent | Read a value from the active store. |
| `set` | `set(key, value): boolean` | `key`: store key; `value`: value to store | `false` if no active context, otherwise `true` | Write a value into the active store. |
| `delete` | `delete(key): boolean` | `key`: store key | `true` if the key existed and was removed | Remove a key from the active store. |
| `has` | `has(key): boolean` | `key`: store key | `true` if the key exists in the active store | Check key existence in the active store. |
| `getAll` | `getAll(): Partial<T>` | — | Snapshot copy of the entire store | Read all values in the active store. |
| `clear` | `clear(): void` | — | — | Remove all values from the active store. |
| `isActive` | `isActive(): boolean` | — | `true` if a context store is currently active | Check whether code is running inside `run()`. |
| `run` | `run(fn, values?): Promise<R>` | `fn`: function to execute; `values?`: optional initial values for this store | `Promise<R>` resolving to `fn`'s return value | Execute `fn` within an isolated store. |

All store-reading and store-writing methods (`get`, `set`, `delete`, `has`, `getAll`, `clear`) operate on the currently active store. If no store is active, `get` returns `undefined`, `set` returns `false`, `delete` returns `false`, `has` returns `false`, `getAll` returns `{}`, and `clear` does nothing.

## Basic Usage

Store request-scoped metadata and access it from any function in the call stack without passing it as a parameter:

```typescript
import { createRequestContext } from '@oneunit/core';

interface RequestContextValues {
  requestId?: string;
  userId?: string;
  clientIp?: string;
}

const ctx = createRequestContext<RequestContextValues>();

async function handleRequest(requestId: string, userId: string, clientIp: string) {
  return await ctx.run(async () => {
    ctx.set('requestId', requestId);
    ctx.set('userId', userId);
    ctx.set('clientIp', clientIp);

    return await processRequest();
  });
}

async function processRequest() {
  // No parameters needed; the context is available anywhere in the call stack.
  const requestId = ctx.get('requestId');
  const userId = ctx.get('userId');
  const clientIp = ctx.get('clientIp');

  return await logRequest({ requestId, userId, clientIp });
}

async function logRequest(meta: { requestId?: string; userId?: string; clientIp?: string }) {
  console.log(`Request ${meta.requestId} from ${meta.clientIp} by ${meta.userId}`);
}
```

## Timestamp Formats

When `autoTimestamp` is enabled, each store created by `run()` receives a timestamp under `timestampKey` (default `"timestamp"`).

### iso (default)

```typescript
const ctx = createRequestContext({ autoTimestamp: true }); // default format: 'iso'

await ctx.run(async () => {
  console.log(ctx.get('timestamp')); // '2026-11-19T14:10:55.123Z'
});
```

### unix

```typescript
const ctx = createRequestContext({
  autoTimestamp: true,
  timestampFormat: 'unix',
});

await ctx.run(async () => {
  console.log(ctx.get('timestamp')); // 1732014655 (seconds)
});
```

### unix-ms

```typescript
const ctx = createRequestContext({
  autoTimestamp: true,
  timestampFormat: 'unix-ms',
});

await ctx.run(async () => {
  console.log(ctx.get('timestamp')); // 1732014655123 (milliseconds)
});
```

A custom `timestampKey` can be used to store the timestamp under a different name:

```typescript
const ctx = createRequestContext({
  autoTimestamp: true,
  timestampKey: 'requestStartedAt',
  timestampFormat: 'unix-ms',
});
```

## Concurrent Request Isolation

Each `run()` creates an isolated store. Concurrent requests do not share or inherit state:

```typescript
import { createRequestContext } from '@oneunit/core';

const ctx = createRequestContext<{ requestId?: string }>();

async function handleRequest(requestId: string) {
  return await ctx.run(async () => {
    ctx.set('requestId', requestId);

    // Simulate asynchronous work.
    await new Promise((resolve) => setTimeout(resolve, 50));

    return ctx.get('requestId');
  });
}

const results = await Promise.all([
  handleRequest('req-a'),
  handleRequest('req-b'),
  handleRequest('req-c'),
]);

console.log(results); // ['req-a', 'req-b', 'req-c']
```

Even though all three handlers share the same `ctx` instance, each `run()` maintains its own isolated `Map`. No request can read another request's `requestId`.

## Best Practices

### Do

- Create one `RequestContext` instance per application (typically as a module-level singleton).
- Call `run()` at the entry point of each request (for example, inside an HTTP middleware).
- Store only request-scoped data such as request ID, user ID, trace ID, and client IP.
- Check `isActive()` before reading or writing the store when code may run outside of a request.
- Use `getAll()` for debugging or logging a snapshot of the current request state.

### Don't

- Do not store long-lived or application-global state in the context; it is request-scoped and discarded when `run()` completes.
- Do not rely on inheritance between concurrent requests; there is none.
- Do not assume `set` succeeds; check its return value when running outside of an active context.
- Do not mutate the object returned by `getAll()` expecting it to affect the store; it is a snapshot copy.

## Error Handling

When no context store is active (code is not executing inside `run()`):

- `get(key)` returns `undefined`.
- `set(key, value)` returns `false` and does not write.
- `delete(key)` returns `false` and does not remove anything.
- `has(key)` returns `false`.
- `getAll()` returns `{}`.
- `clear()` does nothing.

There is no thrown error for operating outside of an active context. Use `isActive()` to detect this condition and handle it explicitly:

```typescript
if (!ctx.isActive()) {
  // No request context is active; handle accordingly.
  return;
}

const value = ctx.get('userId');
```
