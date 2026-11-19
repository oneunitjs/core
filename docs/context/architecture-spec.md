# Context — Architecture Specification

@oneunit/core v1.0.0

## Component Overview

**Purpose.** The Context feature provides request-scoped storage for the @oneunit/core package (v1.0.0). It lets application code store and access request-specific data — such as request ID, user ID, trace ID, or client IP — throughout the lifecycle of an asynchronous operation without threading that data through every function call as an explicit parameter.

**Scope.** The feature is limited to a single module (`src/context/`). It exposes a public factory (`createRequestContext`) and the `RequestContext`/`RequestContextOptions` types. Internal storage mechanics (AsyncLocalStorage wrapping, store creation, timestamp generation) are private to the module and not part of the public API.

**Responsibilities.**
- Create isolated, request-scoped key/value stores bound to an asynchronous execution chain.
- Provide typed read/write/delete/has/clear/getAll operations against the active store.
- Support per-run initial values that are merged into each new store.
- Optionally auto-stamp each run with a timestamp in ISO, unix, or unix-ms format.
- Degrade gracefully when no context is active: `get` returns `undefined`, `set`/`delete`/`has` return `false`, `getAll` returns `{}`, `clear()` is a no-op.
- Propagate errors thrown by the user-supplied function from `run()` without interception.

## Source File Map

| File path | Responsibility | Key exports |
|---|---|---|
| `src/context/index.ts` | Public barrel for the context module; re-exports the factory and types. | `createRequestContext`, `RequestContext` (type), `RequestContextOptions` (type) |
| `src/context/types.ts` | TypeScript type definitions for the context module. | `TimestampFormat`, `RequestContextOptions<T>`, `RequestContext<T>` |
| `src/context/registry.ts` | Factory implementation: creates the AsyncLocalStorage-backed context instance and binds all public methods. | `createRequestContext<T>(options?)` |
| `src/context/internal/storage.ts` | Private AsyncLocalStorage management and per-run `Map` store creation. | `createStorage()`, `createStore(options, values)`, `getCurrentStore(storage)`, `ContextStore` (type) |
| `src/context/internal/timestamp.ts` | Private timestamp generation used when `autoTimestamp` is enabled. | `generateTimestamp(format)` |

## Component Relationships Diagram (Mermaid)

```mermaid
flowchart TD
    A[createRequestContext(options)]
    B[RequestContextImpl / context object]
    C[AsyncLocalStorage<Map<string, unknown>>]
    D[Map store created per run()]

    A -->|owns| B
    B -->|creates| C
    C -->|run(store, fn)| D
    D -->|bound to fn execution chain| B

    subgraph Public API
        A
        B
    end

    subgraph Node.js async context
        C
        D
    end
```

Execution flow for `run()`:

```mermaid
flowchart LR
    run[run(fn, values)]
    newMap[create new Map store]
    merge[merge initialValues + values + optional timestamp]
    alsRun[AsyncLocalStorage.run(store, fn)]
    fn[execute fn in async context chain]
    clear[store cleared / context exits]

    run --> newMap
    newMap --> merge
    merge --> alsRun
    alsRun --> fn
    fn --> clear
```

## Data Flow Diagrams (Mermaid)

### 1. createRequestContext(options)

```mermaid
flowchart LR
    opts[RequestContextOptions]
    factory[createRequestContext(opts)]
    storage[AsyncLocalStorage<Map<string, unknown>>]
    ctx[RequestContext object]

    opts --> factory
    factory -->|creates| storage
    factory -->|returns| ctx
    ctx -->|closes over| storage
```

### 2. run(fn, values)

```mermaid
flowchart LR
    call[ctx.run(fn, values)]
    newMap[new Map store]
    initial[copy options.initialValues]
    stamp[optional autoTimestamp entry]
    overlay[apply per-run values]
    run[storage.run(store, fn)]
    result[return fn result]

    call --> newMap
    newMap --> initial
    newMap --> stamp
    newMap --> overlay
    newMap --> run
    run --> result
```

### 3. get(key)

```mermaid
flowchart LR
    call[ctx.get(key)]
    als[AsyncLocalStorage.getStore()]
    mapGet[Map.get(key)]
    out[return value or undefined]

    call --> als
    als --> mapGet
    mapGet --> out
```

### 4. set(key, value)

```mermaid
flowchart LR
    call[ctx.set(key, value)]
    als[AsyncLocalStorage.getStore()]
    noStore{store active?}
    mapSet[Map.set(key, value)]
    retTrue[return true]
    retFalse[return false]

    call --> als
    als --> noStore
    noStore -->|yes| mapSet
    noStore -->|no| retFalse
    mapSet --> retTrue
```

## Public API Reference (self-contained)

### `TimestampFormat`

```ts
type TimestampFormat = "iso" | "unix" | "unix-ms";
```

### `RequestContextOptions<T>`

```ts
interface RequestContextOptions<T extends object = Record<string, unknown>> {
    initialValues?: Partial<T>;
    autoTimestamp?: boolean;        // default: false
    timestampKey?: string;          // default: "timestamp"
    timestampFormat?: TimestampFormat; // default: "iso"
}
```

### `RequestContext<T>`

```ts
interface RequestContext<T extends object = Record<string, unknown>> {
    get<K extends keyof T>(key: K): T[K] | undefined;
    set<K extends keyof T>(key: K, value: T[K]): boolean;
    delete(key: keyof T): boolean;
    has(key: keyof T): boolean;
    getAll(): Partial<T>;
    clear(): void;
    isActive(): boolean;
    run<R>(fn: () => R | Promise<R>, values?: Partial<T>): Promise<R>;
}
```

### `createRequestContext<T>(options?)`

```ts
function createRequestContext<
    T extends object = Record<string, unknown>
>(options: RequestContextOptions<T> = {}): RequestContext<T>;
```

### Method behavior

| Method | Behavior when context active | Behavior when no context active |
|---|---|---|
| `get(key)` | `store.get(key)` or `undefined` | `undefined` |
| `set(key, value)` | `store.set(key, value)`, returns `true` | returns `false` |
| `delete(key)` | `store.delete(key)`, returns `true`/`false` | returns `false` |
| `has(key)` | `store.has(key)` | returns `false` |
| `getAll()` | snapshot of all entries | `{}` |
| `clear()` | `store.clear()` | no-op |
| `isActive()` | `true` | `false` |
| `run(fn, values)` | creates new isolated store, runs `fn`, returns result | creates store anyway; `fn` executes within it |

## Internal State Model

- `storage: AsyncLocalStorage<Map<string, unknown>>` — one per context instance, created by `createStorage()`.
- `options: RequestContextOptions` — resolved defaults at factory creation time: `initialValues` (default `{}`), `autoTimestamp` (default `false`), `timestampKey` (default `"timestamp"`), `timestampFormat` (default `"iso"`).
- Each `run()` creates an independent `Map` store via `createStore()`: entries are copied from `options.initialValues`, an optional timestamp entry is added when `autoTimestamp` is enabled, then per-run `values` are overlaid on top.
- No persistent state between runs: the store exists only for the duration of `AsyncLocalStorage.run(store, fn)` and is discarded when the execution chain exits.
- `getCurrentStore(storage)` delegates to `AsyncLocalStorage.getStore()` and returns `ContextStore | undefined`.

## Design Patterns

- **AsyncLocalStorage Pattern.** Request-scoped storage built on Node.js `AsyncLocalStorage` (`node:async_hooks`), which propagates context across asynchronous call chains unlike thread-local storage.
- **Factory Pattern.** `createRequestContext()` is the sole constructor; it builds and returns a `RequestContext` object closing over a private `AsyncLocalStorage`.
- **Isolation Pattern.** Every `run()` allocates a fresh `Map` with no prototype inheritance from other stores; concurrent requests never share mutable state.

## Technical Implementation Details

- Built on Node.js `AsyncLocalStorage` from `node:async_hooks` (available since Node.js v14.17.0).
- Each `run()` creates a new `Map<string, unknown>` instance.
- No inheritance between concurrent request stores; stores are independent snapshots.
- `set()` returns `false` when no context is active (graceful degradation).
- `autoTimestamp` adds a timestamp entry to each new store at run time when enabled.
- Timestamp formats: `"iso"` (`new Date().toISOString()`), `"unix"` (`Math.floor(Date.now() / 1000)`), `"unix-ms"` (`Date.now()`).
- Per-run `values` override `initialValues` and the timestamp key if collisions occur, because values are applied last in `createStore()`.

## Concurrency Considerations

- `AsyncLocalStorage` provides async context isolation: the active store is tied to the asynchronous execution chain, not to a thread or the event loop globally.
- No shared mutable state between concurrent requests; each `run()` allocates its own `Map`.
- Nested `run()` calls create nested, independent stores; inner stores shadow outer ones for the duration of the inner execution.
- Context is automatically propagated to `await`ed promises and callbacks scheduled within the `run()` boundary.

## Error Model

- No errors are thrown for missing context. Read/write operations degrade gracefully: `get` returns `undefined`, `set`/`delete`/`has` return `false`, `getAll` returns `{}`, `clear()` is a no-op, `isActive()` returns `false`.
- Errors thrown synchronously or asynchronously by the user-supplied `fn` propagate normally from `run()`; they are not caught or transformed by the context implementation.
- `AsyncLocalStorage.run()` rejects with the same error if `fn` returns a rejected promise.

## Complexity Analysis

| Operation | Time complexity | Space complexity |
|---|---|---|
| `get(key)` | O(1) | O(1) |
| `set(key, value)` | O(1) | O(1) |
| `has(key)` | O(1) | O(1) |
| `delete(key)` | O(1) | O(1) |
| `getAll()` | O(n) | O(n) where n is store size |
| `clear()` | O(n) | O(1) |
| `isActive()` | O(1) | O(1) |
| `run(fn, values)` | O(m) to build store where m = initialValues + values count, plus fn cost | O(m) for the new store |

n = number of entries in the active store; m = number of entries seeded into a new store.
