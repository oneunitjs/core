# Hooks — Usage Guide

@oneunit/core v1.0.0

## Overview

The Hooks feature implements an event-driven listener pattern for application lifecycle and request/response interception. It lets you register callbacks ("listeners") against named events ("hooks"), then trigger those events at key points in your application flow. Listeners can inspect or transform shared context as a request or application phase progresses.

Hooks are useful for:
- Running setup and teardown logic around application startup and shutdown.
- Intercepting requests and responses for logging, authentication, validation, or modification.
- Decoupling cross-cutting concerns from core business logic.
- Coordinating behavior across framework-agnostic middleware or lifecycle phases.

The hook system is provided by `app.hooks()` on the core application instance. Every hook instance holds a set of named listeners and an execution context passed to each listener when the hook is emitted.

## Quick Start

Register a listener for the `"init"` hook, then emit it:

```ts
import { createApp } from "@oneunit/core";

const app = createApp();

app.hooks().on("init", (context) => {
  console.log("Application initializing:", context.appName);
});

await app.hooks().emit("init", { appName: "my-app" });
// Application initializing: my-app
```

A listener receives a `Context` object and may return `void` or `Promise<void>`. When you emit a hook, all registered listeners run in registration order.

## Hooks API

The following table lists every method on the object returned by `app.hooks()`.

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `on` | `on(name: string, listener: HookListener<Context>): Hooks` | `Hooks` (chainable) | Registers a listener for a hook name. |
| `use` | `use(name: string, listener): Hooks` | `Hooks` (chainable) | Alias for `on`. |
| `off` | `off(name: string, listener): Hooks` | `Hooks` (chainable) | Removes a previously registered listener. |
| `once` | `once(name: string, listener): Hooks` | `Hooks` (chainable) | Registers a listener that auto-removes after its first execution. |
| `emit` | `emit(name: string, context: Context): Promise<void>` | `Promise<void>` | Asynchronously invokes all listeners for a hook, sequentially. |
| `emitSync` | `emitSync(name: string, context: Context): void` | `void` | Synchronously invokes all listeners for a hook. |
| `has` | `has(name: string): boolean` | `boolean` | Returns `true` if any listeners are registered for the hook name. |
| `listeners` | `listeners(name: string): HookListener[]` | `HookListener[]` | Returns all registered listeners for a hook name. |
| `listenerCount` | `listenerCount(name: string): number` | `number` | Returns the number of registered listeners for a hook name. |
| `clear` | `clear(): Hooks` | `Hooks` (chainable) | Removes all listeners from all hook names. |
| `clearHook` | `clearHook(name: string): Hooks` | `Hooks` (chainable) | Removes all listeners for a specific hook name. |
| `toJSON` | `toJSON(): Record<string, number>` | `Record<string, number>` | Returns a map of hook names to listener counts. |

## Registering Listeners

Use `on()` (or its alias `use()`) to attach a listener to a hook name. Both return the hooks instance, so calls can be chained.

```ts
const hooks = app.hooks();

hooks
  .on("beforeHandler", (context) => {
    context.requestId = "req-123";
  })
  .on("afterHandler", (context) => {
    console.log("Handler finished for", context.requestId);
  })
  .use("beforeSend", (context) => {
    context.headers["X-Powered-By"] = "@oneunit/core";
  });
```

Remove a listener with `off()`, passing the same listener function reference that was registered:

```ts
function logRequest(context) {
  console.log("Request:", context.method, context.url);
}

hooks.on("request", logRequest);
// ... later
hooks.off("request", logRequest);
```

If the listener was not registered for that name, `off()` is a no-op.

## One-time Listeners

`once()` registers a listener that executes at most once and removes itself automatically after its first invocation.

```ts
hooks.once("ready", (context) => {
  console.log("Ready:", context.version);
});

await hooks.emit("ready", { version: "1.0.0" }); // prints
await hooks.emit("ready", { version: "1.0.0" }); // silent — listener removed
```

This is ideal for initialization work that should only run a single time.

## Emitting Hooks

Use `emit()` for asynchronous, sequential execution. Listeners run one after another in registration order. If a listener returns a promise, emission awaits it before moving to the next listener.

```ts
await hooks.emit("beforeValidation", { data: { email: "a@b.com" } });
```

Use `emitSync()` when you need synchronous execution. Listener return values (including promises) are not awaited.

```ts
hooks.emitSync("beforeParse", { raw: "..." });
```

Key differences:

| Aspect | `emit()` | `emitSync()` |
|--------|----------|--------------|
| Execution | Async, sequential | Sync |
| Awaits promises | Yes | No |
| Return type | `Promise<void>` | `void` |
| Best for | Async I/O, database, network | Fast, in-memory transformations |

## Error Handling

The `throwOnError` option controls what happens when a listener throws.

### `throwOnError: false` (default)

Errors thrown by a listener are caught. The remaining listeners for that hook continue to run. The error is suppressed and `emit()` does not reject.

```ts
const hooks = app.hooks({ throwOnError: false });

hooks.on("request", (context) => {
  throw new Error("boom");
});

hooks.on("request", (context) => {
  console.log("still runs");
});

await hooks.emit("request", {});
// "still runs" is logged; no rejection
```

### `throwOnError: true`

The first listener error propagates. Execution stops immediately and `emit()` rejects with that error. Remaining listeners do not run.

```ts
const hooks = app.hooks({ throwOnError: true });

hooks.on("request", (context) => {
  throw new Error("boom");
});

hooks.on("request", (context) => {
  console.log("never runs");
});

await hooks.emit("request", {}); // rejects with Error: boom
```

## Hook Inspection

Query and manipulate hook state with these methods.

### `has(name)`

```ts
hooks.has("init"); // true if at least one listener is registered
```

### `listeners(name)`

```ts
const fns = hooks.listeners("start");
// fns is HookListener[] in registration order
```

### `listenerCount(name)`

```ts
hooks.listenerCount("shutdown"); // 2
```

### `toJSON()`

```ts
hooks.toJSON();
// { init: 1, start: 2, shutdown: 1 }
```

Returns a plain object mapping hook names to their listener counts.

### `clear()` and `clearHook(name)`

```ts
hooks.clearHook("request"); // removes all listeners for "request"
hooks.clear(); // removes all listeners from every hook name
```

Both return the hooks instance for chaining.

## Default Hook Names

`DEFAULT_HOOKS` defines the canonical hook names recognized by the framework, organized by category:

| Category | Hook names |
|----------|------------|
| application | `init`, `start`, `ready`, `shutdown` |
| lifecycle | `request`, `beforeParse`, `afterParse`, `beforeValidation`, `afterValidation`, `beforeAuth`, `afterAuth`, `beforeHandler`, `afterHandler`, `beforeSerialize`, `beforeSend`, `afterSend`, `response`, `error`, `notFound`, `timeout` |
| server | `beforeListen`, `afterListen`, `beforeClose`, `afterClose` |
| cache | `cacheHit`, `cacheMiss` |
| connection | `connection`, `disconnection` |

These names are conventions, not enforced unless you use `createHooksWithDefaults()` (see Restricted Hooks).

## Restricted Hooks

`createHooksWithDefaults(options?)` creates a hook instance restricted to the names in `DEFAULT_HOOKS`. Attempting to register or emit a hook name outside that set is treated as invalid.

```ts
import { createHooksWithDefaults } from "@oneunit/core";

const hooks = createHooksWithDefaults();

hooks.on("init", (context) => { /* ... */ });   // allowed
hooks.on("customHook", (context) => { /* ... */ }); // not allowed
```

Use this when you want strict validation against the known hook vocabulary rather than an open-ended event bus.

## Cross-Framework Usage

Hooks are framework-agnostic. You can drive them from Express, Fastify, Koa, or any other framework by tying hook emissions to that framework's middleware or lifecycle phases.

### Express

```ts
import express from "express";
import { createApp } from "@oneunit/core";

const app = createApp();
const expressApp = express();

app.hooks().on("beforeHandler", (context) => {
  // context populated from Express req/res
});

expressApp.use((req, res, next) => {
  const context = { method: req.method, url: req.url, req, res };
  app.hooks().emit("beforeHandler", context).then(next).catch(next);
});
```

### Fastify

```ts
import Fastify from "fastify";
import { createApp } from "@oneunit/core";

const app = createApp();
const fastify = Fastify();

fastify.addHook("preHandler", async (request, reply) => {
  const context = { method: request.method, url: request.url, request, reply };
  await app.hooks().emit("beforeHandler", context);
});
```

### Koa

```ts
import Koa from "koa";
import { createApp } from "@oneunit/core";

const app = createApp();
const koaApp = new Koa();

koaApp.use(async (ctx, next) => {
  const context = { method: ctx.method, url: ctx.url, ctx };
  await app.hooks().emit("beforeHandler", context);
  await next();
});
```

## Best Practices

### Do

- Keep listeners small and focused on a single responsibility.
- Treat the context object as shared mutable state; document what each listener may read or write.
- Use `once()` for initialization logic that should run a single time.
- Prefer `emit()` when listeners perform async work (I/O, database, network).
- Use `throwOnError: true` for critical validation hooks where failure must abort the flow.
- Use `clearHook()` or `clear()` in teardown to avoid listener leaks in long-running processes.
- Chain `on()`/`use()` calls for concise registration.

### Don't

- Don't register the same listener function multiple times unless you intend it to run multiple times.
- Don't throw inside listeners when `throwOnError: false` unless you want the error swallowed silently.
- Don't mix sync and async expectations in `emitSync()`; promises returned by listeners are not awaited.
- Don't rely on hook execution order across separate `emit()` calls; order is guaranteed only within a single emission.
- Don't emit hook names outside `DEFAULT_HOOKS` when using `createHooksWithDefaults()`.

## Error Handling

Errors thrown during hook emission depend on the `throwOnError` option:

- With `throwOnError: false` (default): listener errors are caught and suppressed. Remaining listeners continue. `emit()` resolves normally.
- With `throwOnError: true`: the first listener error stops execution and `emit()` rejects with that error. Remaining listeners are skipped.

No other errors are thrown by the hook API itself under normal use. Calling `off()` with an unregistered listener is a no-op and does not throw.
