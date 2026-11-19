# Hooks — Architecture Specification

@oneunit/core v1.0.0

## Component Overview

**Purpose:** Provide a type-safe, chainable hook/event system for the @oneunit/core package. Hooks allow components to subscribe to named lifecycle points and react to events as they occur.

**Scope:** The Hooks feature covers listener registration (`on`, `use`, `off`, `once`), sequential event emission (`emit`, `emitSync`), hook introspection (`has`, `listeners`, `listenerCount`, `toJSON`), state reset (`clear`, `clearHook`), error collection (`getErrors`), and hook-name validation (`supportedHooks`, `isSupported`). It includes a default set of well-known hook names (`DEFAULT_HOOKS`) and an optional restriction mode (`allowedHooks`) that rejects unregistered hook names.

**Responsibilities:**
- Maintain a registry of listeners keyed by hook name.
- Execute registered listeners sequentially when a hook is emitted.
- Support one-time listeners that auto-remove after first execution.
- Allow removal of listeners, including one-time listeners by their original reference.
- Enforce an optional allow-list of hook names.
- Collect and report errors thrown by listeners.

## Source File Map

| File Path | Responsibility | Key Exports |
|-----------|----------------|-------------|
| `src/hooks/index.ts` | Public barrel for the Hooks feature; re-exports factory functions, hook-name sets, and types. | `createHooks`, `createHooksWithDefaults`, `DEFAULT_HOOKS`, `APPLICATION_HOOKS`, `LIFECYCLE_HOOKS`, `SERVER_HOOKS`, `CACHE_HOOKS`, `CONNECTION_HOOKS`, plus type re-exports. |
| `src/hooks/type.ts` | TypeScript type definitions for listeners, options, and the Hooks interface. | `HookListener<Context>`, `HooksOptions`, `Hooks<Context, HookName>`, `HookAdapterSupport`. |
| `src/hooks/registery.ts` | Runtime implementation: `HooksImpl` class and factory functions `createHooks` / `createHooksWithDefaults`. | `HooksImpl` (internal class), `createHooks`, `createHooksWithDefaults`, plus type/constant re-exports. |
| `src/hooks/default-hooks.ts` | Canonical sets of well-known hook names grouped by domain. | `APPLICATION_HOOKS`, `LIFECYCLE_HOOKS`, `SERVER_HOOKS`, `CACHE_HOOKS`, `CONNECTION_HOOKS`, `DEFAULT_HOOKS`, `DEFAULT_HOOK_COUNT`, and derived hook-name types. |

## Component Relationships Diagram

```mermaid
classDiagram
    class HooksImpl {
        - Map<string, HookListener[]> store
        - Map<HookListener, HookListener> onceWrappers
        - boolean throwOnError
        - Set<string> | null allowedHooks
        - Error[] errors
        + on(name, listener)
        + use(name, listener)
        + off(name, listener)
        + once(name, listener)
        + emit(name, context)
        + emitSync(name, context)
        + getErrors()
        + has(name)
        + listeners(name)
        + listenerCount(name)
        + clear()
        + clearHook(name)
        + toJSON()
        + supportedHooks()
        + isSupported(name)
        - validateHook(name)
    }
    class Hooks {
        <<interface>>
        + on(name, listener)
        + use(name, listener)
        + off(name, listener)
        + once(name, listener)
        + emit(name, context)
        + emitSync(name, context)
        + getErrors()
        + has(name)
        + listeners(name)
        + listenerCount(name)
        + clear()
        + clearHook(name)
        + toJSON()
        + supportedHooks()
        + isSupported(name)
    }
    class HookListener {
        <<type>>
        (context) => void | Promise<void>
    }
    class HooksOptions {
        <<interface>>
        throwOnError?: boolean
        allowedHooks?: readonly string[]
    }
    class createHooks {
        <<factory>>
        (options) => Hooks
    }
    class createHooksWithDefaults {
        <<factory>>
        (options) => Hooks<..., DefaultHookName>
    }
    HooksImpl ..|> Hooks : implements
    HooksImpl --> HookListener : store values
    HooksImpl --> HookListener : onceWrappers keys/values
    HooksImpl --> HooksOptions : constructor input
    createHooks --> HooksImpl : instantiates
    createHooksWithDefaults --> HooksImpl : instantiates with allowedHooks
    HooksOptions --> HookListener : listener signature context
```

## Data Flow Diagrams

### 1. on(name, listener)

```mermaid
flowchart TD
    A[on(name, listener)] --> B[validateHook(name)]
    B --> C{allowedHooks set?}
    C -->|Yes & not allowed| D[throw HookNotAllowedError]
    C -->|No or allowed| E[store.get(name)]
    E --> F{existing array?}
    F -->|Yes| G[existing.push(listener)]
    F -->|No| H[store.set(name, [listener])]
    G --> I[return this]
    H --> I
```

### 2. once(name, listener)

```mermaid
flowchart TD
    A[once(name, listener)] --> B[validateHook(name)]
    B --> C[create onceListener closure]
    C --> D[onceWrappers.set(listener, onceListener)]
    D --> E[on(name, onceListener)]
    E --> F[onceListener pushed to listeners[name]]
    style C fill:#f9f,stroke:#333
```

**onceListener runtime behavior:**
1. `off(name, onceListener)` — removes itself from `listeners[name]`.
2. `onceWrappers.delete(listener)` — drops the original→wrapper mapping.
3. `await listener(context)` — executes the original listener.

### 3. emit(name, context)

```mermaid
flowchart TD
    A[emit(name, context)] --> B[validateHook(name)]
    B --> C[store.get(name)]
    C --> D{list empty or missing?}
    D -->|Yes| E[return undefined]
    D -->|No| F[for each listener in list]
    F --> G[await listener(context)]
    G --> H{error thrown?}
    H -->|Yes| I[push error to errors array]
    H -->|No| J[next listener]
    I --> K{throwOnError?}
    K -->|Yes| L[throw err — stop execution]
    K -->|No| J
    J --> M{more listeners?}
    M -->|Yes| G
    M -->|No| N[return]
```

### 4. off(name, listener)

```mermaid
flowchart TD
    A[off(name, listener)] --> B[onceWrappers.get(listener)]
    B --> C{wrapper found?}
    C -->|Yes| D[target = wrapper]
    C -->|No| E[target = listener]
    D --> F[store.get(name)]
    E --> F
    F --> G{list exists?}
    G -->|No| H[return this]
    G -->|Yes| I[list.indexOf(target)]
    I --> J{index found?}
    J -->|No| H
    J -->|Yes| K[list.splice(index, 1)]
    K --> L{wrapper was used?}
    L -->|Yes| M[onceWrappers.delete(listener)]
    L -->|No| N[{list.length === 0}?]
    N -->|Yes| O[store.delete(name)]
    N -->|No| P[return this]
    O --> P
```

## Internal State Model

| State Field | Type | Purpose |
|-------------|------|---------|
| `store` (listeners) | `Map<string, HookListener[]>` | Maps each hook name to its ordered array of registered listeners. |
| `onceWrappers` | `Map<HookListener, HookListener>` | Maps an original listener to its auto-removing wrapper, enabling `off()` to unsubscribe one-time listeners by original reference. |
| `throwOnError` | `boolean` | Error policy: `true` propagates the first listener error and stops; `false` catches errors and continues. |
| `allowedHooks` | `Set<string> \| null` | Optional allow-list of hook names. When set, `on()`/`once()`/`emit()`/`emitSync()` reject names not in the set via `HookNotAllowedError`. |
| `errors` | `Error[]` | Collected listener errors (retrievable via `getErrors()`), populated regardless of `throwOnError`. |

**Type definitions:**

```ts
type HookListener<Context = unknown> = (context: Context) => void | Promise<void>;

interface HooksOptions {
    throwOnError?: boolean;
    allowedHooks?: readonly string[];
}
```

## Design Patterns

- **Observer Pattern:** Listeners subscribe to hook names via `on()`/`use()`; `emit()` notifies all subscribers of a hook name.
- **Chain of Responsibility:** `emit()` invokes listeners sequentially in registration order; each listener receives the same context.
- **Decorator Pattern:** `once()` wraps a listener with auto-removal behavior (self-unsubscription after first execution).
- **Factory Pattern:** `createHooks(options)` and `createHooksWithDefaults(options)` construct `HooksImpl` instances; the latter pre-configures `allowedHooks` to `DEFAULT_HOOKS`.

## Technical Implementation Details

- **Sequential execution:** `emit()` and `emitSync()` iterate listeners with a `for...of` loop, awaiting each Promise before proceeding to the next. Listeners do not run in parallel.
- **Synchronous emission:** `process.hrtime` is not used; `emitSync()` invokes listeners directly without awaiting.
- **Once wrapper closure:** The wrapper captures `name`, `listener`, and `this`, calls `off(name, onceListener)` to remove itself, deletes the `onceWrappers` entry, then invokes the original listener.
- **Once removal support:** `onceWrappers` lets `off(name, originalListener)` locate and remove the wrapper from `listeners[name]` using the original listener reference.
- **Error policy:** `throwOnError` controls whether the first listener error propagates (halting remaining listeners) or is caught so remaining listeners continue.
- **Error collection:** Errors are pushed to an internal `errors[]` array in both `throwOnError` modes and are retrievable via `getErrors()`.
- **Hook validation:** `validateHook(name)` throws `HookNotAllowedError` when `allowedHooks` is set and `name` is not a member. This runs in `on()`, `once()`, `emit()`, and `emitSync()`.

## Concurrency Considerations

- The `store` Map is not thread-safe. Node.js is single-threaded for JavaScript execution, so concurrent mutation from multiple JS contexts is not a concern within a single event loop.
- No async race conditions exist in `emit()` because each listener is awaited before the next is invoked; the listener array is snapshot-iterated but mutations during iteration (e.g. a `once` listener removing itself) affect the live array being iterated.
- `listeners(name)` returns the live array reference from the map (not a deep copy), so callers should not mutate the returned array.

## Error Model

| Condition | Behavior |
|-----------|----------|
| `throwOnError = true` | The first listener error is re-thrown; `emit()`/`emitSync()` stop invoking remaining listeners. The error is still pushed to `errors[]` before re-throw. |
| `throwOnError = false` (default) | Listener errors are caught, pushed to `errors[]`, and execution continues with the next listener. Errors are silently swallowed (no return value or callback reports them beyond `getErrors()`). |
| `allowedHooks` restriction | `on()`, `once()`, `emit()`, and `emitSync()` throw `HookNotAllowedError` for names not in the allow-list. The error carries the rejected name and the list of supported names. |
| Non-Error throw values | Caught errors are normalized: `err instanceof Error ? err : new Error(String(err))` before being pushed to `errors[]`. |

## Complexity Analysis

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|----------------|------------------|-------|
| `on(name, listener)` | O(1) amortized | O(1) | Map lookup plus array push. |
| `use(name, listener)` | O(1) amortized | O(1) | Delegates to `on()`. |
| `once(name, listener)` | O(1) amortized | O(1) | Creates wrapper, one Map set, delegates to `on()`. |
| `off(name, listener)` | O(n) where n = listeners of `name` | O(1) | `indexOf` scan plus `splice`; may delete Map entry. |
| `emit(name, context)` | O(n) where n = listeners of `name` | O(1) auxiliary | Sequential awaits; error capture O(1) per listener. |
| `emitSync(name, context)` | O(n) where n = listeners of `name` | O(1) auxiliary | Synchronous invocation. |
| `has(name)` | O(1) | O(1) | Map `has`. |
| `listeners(name)` | O(1) | O(1) | Returns live array reference. |
| `listenerCount(name)` | O(1) | O(1) | Map lookup plus `.length`. |
| `clear()` | O(1) | O(1) | Map `clear`. |
| `clearHook(name)` | O(1) | O(1) | Map `delete`. |
| `toJSON()` | O(h) where h = number of hooks | O(h) | Builds a record of name → count. |
| `supportedHooks()` / `isSupported(name)` | O(1) / O(1) | O(1) | Set/Array membership on `allowedHooks` or `DEFAULT_HOOKS`. |
