# Request Context — Updated Architecture Design

**Package:** `@oneunit/core`  
**Feature:** Request Context  
**Module:** `src/context`  
**Status:** Proposed Final Architecture  
**Language:** TypeScript  
**Runtime:** Node.js  
**Core Dependency:** `node:async_hooks`  
**Storage Engine:** `AsyncLocalStorage<Map<string, unknown>>`  
**Framework Coupling:** None  
**External Runtime Dependencies:** None

---

# 1. Introduction

## 1.1 Purpose

Request Context is a foundational infrastructure feature of `@oneunit/core`.

It provides asynchronous execution-scoped storage that allows application components to share contextual information without explicitly passing that information through every function call.

The feature is designed for information such as:

- Request ID
- Correlation ID
- Trace ID
- User ID
- Tenant ID
- Client IP
- HTTP method
- Request metadata
- Execution timestamp
- Application-specific contextual values

The module uses Node.js `AsyncLocalStorage` to maintain isolated contextual data across asynchronous execution boundaries.

## 1.2 Problem Statement

In a typical Node.js application, contextual information is passed through function parameters.

For example:

```ts
async function getUser(requestId: string, userId: string) {
    return database.findUser(requestId, userId);
}

async function getOrders(requestId: string, userId: string) {
    const user = await getUser(requestId, userId);

    return database.findOrders(requestId, user.id);
}
```

As applications grow, this introduces unnecessary parameter propagation.

Problems include:

- Repetitive function parameters.
- Tight coupling between application layers.
- Difficult maintenance.
- Boilerplate across services.
- Inconsistent contextual information.
- Increased complexity when adding new metadata.

Request Context solves this by providing a shared execution-scoped storage mechanism.

## 1.3 Design Goal

The primary goal is to provide a small, reusable, predictable, and framework-independent context API that other features and applications can consume.

The module must:

1. Maintain isolated context stores.
2. Propagate context through asynchronous execution.
3. Prevent cross-request data leakage.
4. Provide a simple public API.
5. Support TypeScript consumers.
6. Avoid external runtime dependencies.
7. Remain independent of other `@oneunit/core` features.
8. Provide predictable lifecycle and error behavior.

---

# 2. Architectural Positioning

Request Context belongs to the infrastructure layer of `@oneunit/core`.

It is a reusable capability, not an HTTP framework integration.

## 2.1 High-Level Architecture

```text
                  @oneunit/core
                        |
                        |
                REQUEST CONTEXT
                        |
           +------------+------------+
           |                         |
           v                         v
      PUBLIC API               INTERNAL ENGINE
           |                         |
     createRequestContext()          |
           |                         |
     get() / set()                   |
     delete() / has()                |
     getAll() / clear()              |
     isActive() / run()              |
           |                         |
           +------------+------------+
                        |
                        v
                 CONTEXT STORAGE
                        |
                 Map<string, unknown>
                        |
                        v
                 AsyncLocalStorage
                        |
                        v
                  Node.js Runtime
```

## 2.2 Architectural Layers

| Layer | Responsibility |
|---|---|
| Public API | Exposes the context factory and public types |
| Context Manager | Implements context operations |
| Storage Layer | Maintains isolated Map instances |
| Async Execution Layer | Propagates context across asynchronous operations |
| Node.js Runtime | Provides native AsyncLocalStorage functionality |

## 2.3 Dependency Direction

The dependency direction must remain:

```text
Public API
    |
    v
Context Implementation
    |
    v
Node.js Built-in API
```

The context module must not depend on:

- Config
- Lifecycle
- Hooks
- Cookies
- Security
- Response Management
- Health
- Express
- Fastify
- Koa

Other modules may consume Request Context, but Request Context must not depend on them.

This ensures independent initialization, predictable module behavior, and long-term maintainability.

---

# 3. Core Technology and Design Patterns

## 3.1 AsyncLocalStorage

The foundational technology is Node.js `AsyncLocalStorage`.

```ts
import { AsyncLocalStorage } from "node:async_hooks";
```

It associates a store with an asynchronous execution chain.

When an operation is executed through `AsyncLocalStorage.run()`, asynchronous resources created within that execution inherit access to the corresponding store.

Example:

```ts
await context.run(async () => {

    context.set("requestId", "req-123");

    await serviceA();
    await serviceB();

});
```

Both services can access the same contextual information:

```ts
async function serviceA() {
    return context.get("requestId");
}

async function serviceB() {
    return context.get("requestId");
}
```

### Why AsyncLocalStorage?

- Native Node.js functionality.
- No external runtime dependency.
- Supports asynchronous execution propagation.
- Provides independent stores for separate execution chains.
- Avoids manual contextual parameter propagation.

## 3.2 Factory Pattern

The module exposes:

```ts
createRequestContext()
```

Every factory invocation creates an independent context instance.

```ts
const requestContext = createRequestContext();
const tracingContext = createRequestContext();
```

Each instance owns its own AsyncLocalStorage.

### Why the factory pattern?

- Supports multiple independent context instances.
- Avoids hidden singleton state.
- Allows consumers to control instance lifecycle.
- Makes testing straightforward.
- Prevents different package consumers from sharing an accidental global context instance.

## 3.3 Map-Based Storage

Each execution scope receives its own:

```ts
Map<string, unknown>
```

The Map remains private to the implementation.

Consumers access it through the public context methods.

### Why Map?

- Explicit key-value storage.
- Efficient lookup and deletion.
- No inherited object properties.
- Predictable iteration.
- Simple conversion to a snapshot object.

---

# 4. Public API Architecture

The public API must remain small and stable because it is part of an npm package contract.

## 4.1 Factory

```ts
createRequestContext<T extends object>(
    options?: RequestContextOptions<T>
): RequestContext<T>
```

The factory creates an independent context instance.

## 4.2 RequestContext Interface

```ts
export interface RequestContext<T extends object = Record<string, unknown>> {

    get<K extends keyof T>(key: K): T[K] | undefined;

    set<K extends keyof T>(
        key: K,
        value: T[K]
    ): boolean;

    delete(key: keyof T): boolean;

    has(key: keyof T): boolean;

    getAll(): Partial<T>;

    clear(): void;

    isActive(): boolean;

    run<R>(
        fn: () => R | Promise<R>,
        values?: Partial<T>
    ): Promise<R>;

}
```

## 4.3 API Responsibilities

| Method | Responsibility | Inactive behavior |
|---|---|---|
| `get()` | Retrieve a value | Returns `undefined` |
| `set()` | Store a value | Returns `false` |
| `delete()` | Remove a value | Returns `false` |
| `has()` | Check key existence | Returns `false` |
| `getAll()` | Return contextual values | Returns `{}` |
| `clear()` | Clear current store | No operation |
| `isActive()` | Check active store availability | Returns `false` |
| `run()` | Execute inside a new context | Creates a context |

## 4.4 Method Behavior

### get()

Retrieves a value from the active context.

```ts
const requestId = context.get("requestId");
```

### set()

Stores a value in the current context.

```ts
context.set("userId", "user-123");
```

### delete()

Removes a specific key.

```ts
context.delete("temporaryValue");
```

### has()

Checks whether a key exists, including keys whose values are explicitly `undefined`.

```ts
context.has("requestId");
```

### getAll()

Returns a shallow snapshot of the current context.

```ts
const metadata = context.getAll();
```

The returned object must not expose the internal Map.

### clear()

Clears the active Map.

```ts
context.clear();
```

It must not affect other execution scopes or context instances.

### isActive()

Checks whether the current asynchronous execution has an associated context store.

```ts
if (context.isActive()) {
    // Context is available.
}
```

### run()

Creates a fresh context and executes a callback inside it.

```ts
await context.run(async () => {

    context.set("requestId", "req-123");

    await processRequest();

});
```

The method returns a Promise containing the callback result.

Synchronous callback errors and asynchronous rejections must propagate to the caller.

---

# 5. Context Storage and Lifecycle

## 5.1 Context Initialization

Each `run()` call creates a new Map.

The initialization sequence is:

```text
context.run(fn, values)
          |
          v
     CREATE MAP
          |
          v
  APPLY INITIAL VALUES
          |
          v
  APPLY AUTOMATIC TIMESTAMP
          |
          v
  APPLY RUN-SPECIFIC VALUES
          |
          v
  ASYNCLOCALSTORAGE.RUN()
          |
          v
     EXECUTE CALLBACK
          |
          v
    RETURN CALLBACK RESULT
```

The precedence is:

1. Factory-level initial values.
2. Automatically generated timestamp.
3. Values passed to `run()`.

Run-specific values override the defaults and automatic timestamp.

## 5.2 Execution Isolation

Every `run()` creates a separate Map.

Example:

```ts
await context.run(async () => {

    context.set("requestId", "request-A");

    await processA();

});

await context.run(async () => {

    context.set("requestId", "request-B");

    await processB();

});
```

The two executions must never share the same Map.

## 5.3 Concurrent Execution

Concurrent operations must remain isolated.

```ts
const results = await Promise.all([

    context.run(async () => {

        context.set("requestId", "A");

        await delay(20);

        return context.get("requestId");

    }),

    context.run(async () => {

        context.set("requestId", "B");

        await delay(10);

        return context.get("requestId");

    })

]);
```

Expected:

```ts
["A", "B"]
```

This is a core correctness guarantee.

## 5.4 Nested Execution

Nested `run()` calls create fresh isolated contexts.

```ts
await context.run(async () => {

    context.set("requestId", "parent");

    await context.run(async () => {

        context.set("requestId", "child");

        console.log(context.get("requestId"));

    });

    console.log(context.get("requestId"));

});
```

Expected:

```text
child
parent
```

The child execution does not automatically inherit parent values.

This behavior is intentional.

If inherited execution is needed later, it should be introduced as a separate explicit API rather than silently changing `run()` behavior.

## 5.5 Asynchronous Resource Lifetime

AsyncLocalStorage propagates context to asynchronous resources created inside an execution boundary.

An important distinction:

The store is not necessarily garbage-collected immediately when the callback completes.

A detached asynchronous task can retain its associated context while it remains alive.

Applications should therefore avoid unnecessary detached operations and establish independent context boundaries for long-running background work.

---

# 6. Configuration Architecture

## 6.1 RequestContextOptions

```ts
export interface RequestContextOptions<T extends object = Record<string, unknown>> {

    initialValues?: Partial<T>;

    autoTimestamp?: boolean;

    timestampKey?: string;

    timestampFormat?: "iso" | "unix" | "unix-ms";

}
```

## 6.2 Configuration Details

| Option | Default | Description |
|---|---|---|
| `initialValues` | `{}` | Default values for each new execution |
| `autoTimestamp` | `false` | Enables automatic timestamp generation |
| `timestampKey` | `"timestamp"` | Timestamp storage key |
| `timestampFormat` | `"iso"` | Timestamp representation |

The timestamp key should be documented as a string key, and consumers using typed schemas must declare a compatible property when enabling timestamp generation.

## 6.3 Initial Values

Example:

```ts
const context = createRequestContext({
    initialValues: {
        application: "api",
        environment: "production"
    }
});
```

Every new context begins with these values.

Run-specific values override factory-level defaults.

## 6.4 Timestamp Support

Supported formats:

**ISO**

```text
2026-11-14T10:00:00.000Z
```

**Unix seconds**

```text
1794650400
```

**Unix milliseconds**

```text
1794650400000
```

The timestamp represents context initialization time, not necessarily exact HTTP request arrival time.

---

# 7. Enable and Disable Policy

The previous implementation included global `enable()` and `disable()` methods.

These should not be part of the recommended public API.

## Why remove them?

An instance-wide enabled flag can affect unrelated concurrent executions.

For example:

```text
Request A starts
Request B starts
Request A disables context
Request B loses context access
```

This creates unnecessary shared mutable state.

## Final decision

- Remove global enable/disable controls.
- Use `run()` to establish context availability.
- Use `isActive()` to inspect current context availability.
- Execute operations without `run()` when contextual storage is unnecessary.

If an already-published version exposes these methods, deprecate them before removing them in a breaking release.

---

# 8. Package Integration

Request Context must integrate cleanly into the existing `@oneunit/core` package.

## 8.1 Recommended File Structure

```text
src/
│
├── context/
│   ├── index.ts
│   ├── registry.ts
│   └── types.ts
│
├── config/
├── health/
├── hooks/
├── lifecycle/
├── cookie/
├── security/
├── response-management/
│
└── index.ts

test/
│
└── context/
    ├── registry.test.ts
    ├── isolation.test.ts
    ├── concurrency.test.ts
    ├── nested.test.ts
    ├── lifecycle.test.ts
    └── timestamp.test.ts
```

The spelling of `registry.ts` must be consistent across source files, tests, documentation, and exports.

## 8.2 Context Barrel

`src/context/index.ts`

```ts
export { createRequestContext } from "./registry.js";

export type {
    RequestContext,
    RequestContextOptions
} from "./types.js";
```

## 8.3 Root Barrel

`src/index.ts`

```ts
export * from "./context/index.js";
```

This makes the feature available through:

```ts
import {
    createRequestContext
} from "@oneunit/core";
```

## 8.4 Optional Subpath Export

If the package intentionally supports feature-level imports, expose:

```ts
import {
    createRequestContext
} from "@oneunit/core/context";
```

The subpath must be explicitly configured in the package export map and included in the published build.

---

# 9. TypeScript Design

The feature should provide type-safe contextual access without requiring consumers to use a rigid predefined schema.

Example:

```ts
interface AppContext {
    requestId: string;
    userId: string;
    traceId: string;
}

const context = createRequestContext<AppContext>();
```

Usage:

```ts
context.set("requestId", "req-123");

const requestId = context.get("requestId");
```

TypeScript should infer the value types from the selected keys.

For example:

```ts
context.set("requestId", 123);
```

Should produce a TypeScript type error when `requestId` is declared as a string.

The implementation should also document that the runtime store is dynamically keyed, while the generic schema provides compile-time guarantees rather than runtime validation.

---

# 10. Framework Independence

The context feature must not contain framework-specific code.

Framework integration is the responsibility of consumers or separate adapter modules.

## Express Integration

```ts
app.use((req, res, next) => {

    context.run(() => {

        context.set(
            "requestId",
            req.headers["x-request-id"]
        );

        context.set("clientIp", req.ip);

        next();

    }).catch(next);

});
```

`next()` must execute inside the context boundary.

It must not be treated as a Promise representing the entire Express request.

## Fastify Integration

```ts
app.addHook("onRequest", (req, reply, done) => {

    context.run(() => {

        context.set(
            "requestId",
            req.headers["x-request-id"]
        );

        context.set("method", req.method);

        done();

    }).catch(done);

});
```

This adapter must be validated against the supported Fastify versions to verify propagation through the actual request lifecycle.

## Koa Integration

```ts
app.use(async (koaContext, next) => {

    await context.run(async () => {

        context.set(
            "requestId",
            koaContext.headers["x-request-id"]
        );

        await next();

    });

});
```

## Node.js HTTP Integration

```ts
const server = http.createServer((req, res) => {

    context.run(async () => {

        context.set(
            "requestId",
            req.headers["x-request-id"]
        );

        res.end(
            JSON.stringify({
                requestId: context.get("requestId")
            })
        );

    }).catch((error) => {

        if (!res.headersSent) {
            res.statusCode = 500;
            res.end("Internal Server Error");
        }

    });

});
```

These examples demonstrate consumer-side integration. They are not dependencies of the core module.

---

# 11. Error Handling

The module should provide predictable behavior without introducing its own logging or error-reporting infrastructure.

| Scenario | Expected behavior |
|---|---|
| `get()` outside execution | `undefined` |
| `set()` outside execution | `false` |
| `delete()` outside execution | `false` |
| `has()` outside execution | `false` |
| `getAll()` outside execution | `{}` |
| `clear()` outside execution | No operation |
| `isActive()` outside execution | `false` |
| Callback throws | Error propagates through returned Promise |
| Callback rejects | Rejection propagates |
| Nested execution | Isolated store |
| Concurrent execution | Independent stores |

The implementation must not swallow callback exceptions.

---

# 12. Performance and Memory Management

## 12.1 Performance Considerations

The implementation should remain lightweight.

It uses:

- One AsyncLocalStorage instance per factory invocation.
- One Map per execution scope.
- Native Map operations.
- Native Node.js asynchronous context propagation.
- No external runtime packages.

Avoid introducing unnecessary cloning, serialization, or validation on every `get()` and `set()` call.

## 12.2 Memory Management

The module must not retain completed request contexts in global registries.

AsyncLocalStorage manages context propagation, but outstanding asynchronous operations can retain their stores.

Consumers should avoid unbounded detached background operations and should create new context boundaries for independent jobs.

---

# 13. Security Considerations

Request Context is a metadata propagation mechanism, not a security boundary.

Recommended rules:

1. Do not use contextual values as authorization proof.
2. Validate request metadata originating from external input.
3. Avoid storing passwords and unnecessary authentication secrets.
4. Do not log all contextual values indiscriminately.
5. Avoid retaining large request and response objects.
6. Treat nested objects as mutable shared references.
7. Remember that `getAll()` creates a shallow snapshot, not a deep clone.

---

# 14. Testing Architecture

Testing must validate the actual asynchronous execution behavior.

## Required Test Coverage

| Test Category | Expected Result | Priority |
|---|---|---|
| Factory | Creates independent instances | Critical |
| Set/Get | Correct value retrieval | Critical |
| Delete | Removes selected key | High |
| Has | Correct existence check | High |
| Inactive access | Correct default behavior | Critical |
| GetAll | Returns independent outer snapshot | High |
| Clear | Clears current store only | High |
| Concurrent requests | No cross-request leakage | Critical |
| Nested execution | Parent remains unchanged | Critical |
| Promise rejection | Original error propagates | Critical |
| Initial values | Correct initialization | High |
| Value overrides | Correct precedence | High |
| Timestamp | Correct formatting and precedence | High |
| Multiple instances | No cross-instance leakage | Critical |
| Detached tasks | Lifecycle behavior understood | High |

## Integration Testing

In addition to unit tests:

- Test the compiled package.
- Test actual ESM imports.
- Test CommonJS if supported.
- Test declaration generation.
- Test framework adapters separately.
- Test supported Node.js versions.

---

# 15. NPM Package Compatibility

Since Request Context is part of a reusable npm package, package compatibility is part of the architecture.

## 15.1 Runtime Compatibility

- Explicitly declare the supported Node.js version range.
- Ensure the minimum version supports the required AsyncLocalStorage behavior.
- Use the `node:` import convention.
- Avoid external runtime dependencies.

## 15.2 Module Compatibility

Follow the existing `@oneunit/core` module strategy.

Do not introduce a different module system solely for this feature.

Verify:

- ESM build.
- CommonJS build, if supported.
- TypeScript declarations.
- Import specifiers.
- Package export map.
- Published file inclusion.

## 15.3 Versioning

If the current public API has already been published:

- Preserve existing behavior where possible.
- Deprecate obsolete methods before removal.
- Use a major version for breaking API changes.
- Document behavioral changes.

If the package has not yet been published, establish the final API before the first stable release.

---

# 16. Future Extensibility

The initial feature should remain focused.

Potential future capabilities:

| Capability | Purpose |
|---|---|
| Explicit inherited execution | Support controlled child-context creation |
| Framework adapters | Simplify consumer integration |
| OpenTelemetry integration | Connect contextual data with distributed tracing |
| Correlation helpers | Standardize common metadata |
| Diagnostic utilities | Improve context inspection |

These should not be included in the initial implementation unless there is an immediate package requirement.

The context module should provide primitives that higher-level features can consume.

---

# 17. Final Architectural Decisions

| Architecture Area | Final Decision |
|---|---|
| Package | `@oneunit/core` |
| Module | `src/context` |
| Core technology | AsyncLocalStorage |
| Storage structure | Map |
| Initialization | Factory pattern |
| Context isolation | One Map per `run()` |
| Nested execution | Fresh isolated store |
| Concurrency | Independent asynchronous contexts |
| Initial values | Supported |
| Timestamp | Optional |
| Enable/disable | Removed from proposed public API |
| `getAll()` | Shallow snapshot |
| `clear()` | Current execution only |
| TypeScript | Generic schema support |
| Framework coupling | None |
| External runtime dependencies | None |
| Manual cleanup | Not required for normal lifecycle |
| Public exports | Root barrel and optional subpath |
| Testing | Unit, concurrency, integration, package tests |

---

# 18. Implementation Roadmap

## Phase 1 — Core Implementation

- Implement the context factory.
- Implement AsyncLocalStorage storage.
- Implement all public API methods.
- Implement initial values.
- Implement timestamp support.
- Finalize nested execution semantics.
- Remove or deprecate global enable/disable methods.

## Phase 2 — Correctness and Reliability

- Test concurrency.
- Test nested execution.
- Test rejection propagation.
- Test inactive behavior.
- Test independent instances.
- Test snapshot semantics.
- Test timestamp precedence.

## Phase 3 — Package Integration

- Export context from `src/context/index.ts`.
- Export from the package root.
- Configure the optional context subpath.
- Verify ESM and CommonJS compatibility as applicable.
- Verify TypeScript declarations.
- Verify package build output.

## Phase 4 — Integration Validation

- Validate Express behavior.
- Validate Fastify behavior.
- Validate Koa behavior.
- Validate native Node.js HTTP behavior.

## Phase 5 — Documentation and Release

- Publish API documentation.
- Publish architecture documentation.
- Document supported Node.js versions.
- Document limitations.
- Document migration if the public API changes.
- Run package-level tests.

---

# 19. Final Conclusion

Request Context should remain a foundational infrastructure feature of `@oneunit/core`.

Its responsibility is intentionally limited:

**Provide isolated asynchronous contextual storage through a small, stable, framework-independent TypeScript API.**

It should not own HTTP lifecycle management, authentication, logging, distributed tracing, or application-specific business logic.

The architecture uses native Node.js capabilities, avoids external dependencies, maintains explicit execution boundaries, and provides a predictable public API for npm consumers.

The design prioritizes:

- API stability.
- Asynchronous isolation.
- Type safety.
- Package compatibility.
- Maintainability.
- Minimal implementation complexity.
- Future extensibility.

**Final Design Principle:**

> Build Request Context as an independent infrastructure primitive. Keep its implementation private, its public API stable, its execution boundaries explicit, and its integration responsibilities outside the core module.

**Architecture Status:** Proposed final design for implementation, source-code validation, and package-level testing.