# MsgPack — Architecture Specification

@oneunit/core v1.0.0

## Component Overview

**Purpose:** Provide MsgPack serialization and deserialization capabilities within the @oneunit/core package (v1.0.0).

**Scope:** The MsgPack feature is a thin, type-safe wrapper around the @msgpack/msgpack library, exposing both asynchronous and synchronous encode/decode APIs through the MsgPackImpl class.

**Responsibilities:**
- Serialize JavaScript values to MsgPack binary format (Uint8Array)
- Deserialize MsgPack binary data back into typed JavaScript values
- Expose async and sync variants of encode/decode
- Allow optional per-call MsgPackOptions to be passed through to the underlying library
- Provide a factory function (createMsgPack) to construct MsgPackImpl instances

## Source File Map

| File path | Responsibility | Key exports |
|-----------|----------------|-------------|
| `src/msgpack/index.ts` | Barrel module that aggregates and re-exports the MsgPack feature public API | `createMsgPack`, `MsgPackImpl`, `MsgPackOptions`, `DEFAULT_MSGPACK_OPTIONS`, `MsgPack` |
| `src/msgpack/config.ts` | Configuration types and default values for MsgPack | `MsgPackOptions` interface, `DEFAULT_MSGPACK_OPTIONS` constant |
| `src/msgpack/type.ts` | Type declarations defining the MsgPack service interface | `MsgPack` interface |
| `src/msgpack/registery.ts` | Concrete implementation of the MsgPack feature | `MsgPackImpl` class |

## Component Relationships Diagram (Mermaid)

```mermaid
graph TD
    app[app.msgpack()] --> factory[createMsgPack()]
    factory --> impl[MsgPackImpl]
    impl --> lib[@msgpack/msgpack library]
    impl --> opts[MsgPackOptions]
    lib --> encode[msgpack.encode()]
    lib --> decode[msgpack.decode()]
    lib --> encodeSync[msgpack.encodeSync()]
    lib --> decodeSync[msgpack.decodeSync()]
```

## Data Flow Diagrams (Mermaid)

### 1. encode(value, options) → msgpack.encode() → Uint8Array

```mermaid
flowchart LR
    A[value] --> B[encode(value, options)]
    B --> C[msgpack.encode(value, options)]
    C --> D[Uint8Array]
```

### 2. decode(data, options) → msgpack.decode() → T

```mermaid
flowchart LR
    A[Uint8Array / ArrayBuffer] --> B[decode<T>(data, options)]
    B --> C[msgpack.decode(data, options)]
    C --> D[T]
```

### 3. encodeSync(value, options) → msgpack.encodeSync() → Uint8Array

```mermaid
flowchart LR
    A[value] --> B[encodeSync(value, options)]
    B --> C[msgpack.encodeSync(value, options)]
    C --> D[Uint8Array]
```

### 4. decodeSync(data, options) → msgpack.decodeSync() → T

```mermaid
flowchart LR
    A[Uint8Array / ArrayBuffer] --> B[decodeSync<T>(data, options)]
    B --> C[msgpack.decodeSync(data, options)]
    C --> D[T]
```

## Internal State Model

- **No persistent state:** MsgPackImpl is a stateless wrapper around the @msgpack/msgpack library. It does not retain any data between calls.
- **Options passed through:** Any MsgPackOptions supplied to encode/decode/encodeSync/decodeSync are forwarded directly to the corresponding @msgpack/msgpack library function. Options are not stored on the instance.

## Design Patterns

- **Wrapper Pattern:** MsgPackImpl is a thin wrapper around @msgpack/msgpack. Each method delegates directly to the equivalent library function, adding async wrapping where applicable.
- **Factory Pattern:** `createMsgPack()` is a factory function that instantiates and returns a `MsgPackImpl` instance.

## Technical Implementation Details

- All operations delegate to the @msgpack/msgpack library functions: `encode`, `decode`, `encodeSync`, `decodeSync`.
- The options object is passed through to the library functions unchanged.
- Async methods (`encode`, `decode`) wrap the synchronous library calls in `Promise.resolve()` to satisfy the async interface signature.
- Default configuration: `maxDepth: 100`, `initialBufferSize: 2048`.
- The `MsgPack` interface declares `encode`, `decode`, `encodeSync`, `decodeSync` methods but does NOT declare an options parameter; the implementation accepts optional options at the call site.

### Method signatures

```typescript
// MsgPack interface (type.ts)
interface MsgPack {
  encode(value: unknown): Promise<Uint8Array>;
  decode<T>(data: Uint8Array | ArrayBuffer): Promise<T>;
  encodeSync(value: unknown): Uint8Array;
  decodeSync<T>(data: Uint8Array | ArrayBuffer): T;
}

// MsgPackImpl implementation (registery.ts)
class MsgPackImpl implements MsgPack {
  async encode(value: unknown, options?: MsgPackOptions): Promise<Uint8Array>;
  async decode<T>(data: Uint8Array | ArrayBuffer, options?: MsgPackOptions): Promise<T>;
  encodeSync(value: unknown, options?: MsgPackOptions): Uint8Array;
  decodeSync<T>(data: Uint8Array | ArrayBuffer, options?: MsgPackOptions): T;
}
```

### DEFAULT_MSGPACK_OPTIONS

```typescript
DEFAULT_MSGPACK_OPTIONS = {
  maxDepth: 100,
  initialBufferSize: 2048,
};
```

## Concurrency Considerations

- **No shared state:** MsgPackImpl instances hold no mutable instance state, making them safe for concurrent use by design.
- All operations delegate directly to the @msgpack/msgpack library; concurrency characteristics are determined by that library.
- Async methods are non-blocking wrappers over sync library calls.

## Error Model

- Errors thrown by the @msgpack/msgpack library (e.g., invalid binary data, depth limit exceeded, unsupported types) propagate as-is to the caller.
- No error wrapping, translation, or suppression is performed by MsgPackImpl.
- Callers are responsible for try/catch handling around encode/decode operations.

## Complexity Analysis

- **Time complexity:** Determined by the @msgpack/msgpack library implementation. Typically O(n) where n is the size of the input value (for encode) or encoded data (for decode).
- **Space complexity:** Determined by the @msgpack/msgpack library implementation. Typically O(n) for the resulting Uint8Array (encode) or decoded value (decode).
- `maxDepth` (default 100) bounds recursion depth during serialization/deserialization, protecting against stack exhaustion on deeply nested structures.
- `initialBufferSize` (default 2048) hints the starting buffer capacity for encoding, influencing reallocation frequency.
