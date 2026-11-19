# MsgPack — Usage Guide

@oneunit/core v1.0.0

## Overview

MsgPack is the binary serialization feature of `@oneunit/core`, powered by the `@msgpack/msgpack` library. It is exposed through the application instance as `app.msgpack()` and converts JavaScript values to and from MessagePack binary format (`Uint8Array`).

It is designed for applications that need a compact, fast binary format for data storage, inter-process communication, cache payloads, message queues, or RPC endpoints where JSON's verbosity and parsing cost are a drawback.

## Quick Start

Install the dependency:

```bash
npm install @msgpack/msgpack
```

Basic asynchronous encode/decode:

```typescript
import { createApp } from '@oneunit/core';

const app = createApp();
const msgpack = app.msgpack();

// Encode a value to binary
const bytes: Uint8Array = await msgpack.encode({ hello: 'world', count: 42 });

// Decode binary back to a typed value
const decoded = await msgpack.decode<{ hello: string; count: number }>(bytes);

console.log(decoded); // { hello: 'world', count: 42 }
```

## MsgPack API

The `app.msgpack()` factory returns an object with the following methods:

| Method | Signature | Parameters | Returns |
|--------|-----------|------------|---------|
| `encode` | `encode(value: unknown, options?: MsgPackOptions): Promise<Uint8Array>` | `value` — any JavaScript value to serialize; `options` — optional serialization options | `Promise<Uint8Array>` — the MessagePack-encoded binary data |
| `decode` | `decode<T>(data: Uint8Array \| ArrayBuffer, options?: MsgPackOptions): Promise<T>` | `data` — binary MessagePack data; `options` — optional decoding options; `T` — expected output type | `Promise<T>` — the decoded and typed value |
| `encodeSync` | `encodeSync(value: unknown, options?: MsgPackOptions): Uint8Array` | `value` — any JavaScript value to serialize; `options` — optional serialization options | `Uint8Array` — the MessagePack-encoded binary data |
| `decodeSync` | `decodeSync<T>(data: Uint8Array \| ArrayBuffer, options?: MsgPackOptions): T` | `data` — binary MessagePack data; `options` — optional decoding options; `T` — expected output type | `T` — the decoded and typed value |

## Options

All four methods accept an optional `MsgPackOptions` object that controls serialization behavior:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `forceFloat32` | `boolean` | `false` | Encodes all 64-bit floats as 32-bit floats. |
| `useBigInt64` | `boolean` | `false` | Encodes BigInt values as 64-bit integers. |
| `sortKeys` | `boolean` | `false` | Sorts object keys before encoding for deterministic output. |
| `ignoreUndefined` | `boolean` | `false` | Omits `undefined` values instead of encoding them as nil. |
| `forceIntegerToFloat` | `boolean` | `false` | Forces integer values to be encoded as floats. |
| `maxDepth` | `number` | `100` | Maximum recursion depth allowed during encoding/decoding. |
| `initialBufferSize` | `number` | `2048` | Initial size in bytes of the encoding buffer. |
| `extensionCodec` | `ExtensionCodec` | `undefined` | Custom extension codec for encoding/decoding extension types. |

Example with options:

```typescript
const bytes = await msgpack.encode(
  { a: 1, b: 2 },
  { sortKeys: true, initialBufferSize: 4096 }
);

const value = await msgpack.decode<{ a: number; b: number }>(
  bytes,
  { maxDepth: 50 }
);
```

## Async vs Sync

`encode` and `decode` return `Promise<...>` and are the default choice. Use them when you want non-blocking serialization, for example inside an async request handler.

`encodeSync` and `decodeSync` return their values directly and block the event loop during serialization. Use them only for small payloads in synchronous code paths where awaiting is inconvenient.

```typescript
// Async (recommended)
const bytes = await msgpack.encode({ foo: 'bar' });
const value = await msgpack.decode<{ foo: string }>(bytes);

// Sync
const bytesSync = msgpack.encodeSync({ foo: 'bar' });
const valueSync = msgpack.decodeSync<{ foo: string }>(bytesSync);
```

## Typed Decode

Both async and sync decode methods accept a generic type parameter `T` so the result is typed at compile time:

```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

const encoded = await msgpack.encode({ id: 7, name: 'Ada' });

// TypeScript knows the shape of `user`
const user = await msgpack.decode<User>(encoded);

console.log(user.name); // 'Ada'
console.log(user.email); // string \| undefined
```

The type parameter is a compile-time aid only; `@msgpack/msgpack` does not validate the decoded value against `T` at runtime. Validate untrusted payloads with a schema library before use.

## Cross-Framework Usage

MsgPack works wherever you can send or receive binary data.

### Express

```typescript
import express from 'express';
import { createApp } from '@oneunit/core';

const app = createApp();
const msgpack = app.msgpack();
const server = express();

server.use(express.raw({ type: 'application/msgpack' }));

server.post('/rpc', async (req, res) => {
  const input = await msgpack.decode<{ method: string; args: unknown[] }>(
    req.body as Uint8Array
  );

  const result = await dispatch(input.method, input.args);

  res.type('application/msgpack').send(await msgpack.encode(result));
});
```

### Fastify

```typescript
import Fastify from 'fastify';
import { createApp } from '@oneunit/core';

const app = createApp();
const msgpack = app.msgpack();
const fastify = Fastify();

fastify.addContentTypeParser('application/msgpack', { parseAs: 'buffer' }, (req, payload, done) => {
  done(null, msgpack.decodeSync(payload as Uint8Array));
});

fastify.post('/cache', async (req, reply) => {
  const payload = req.body as { key: string; value: unknown };
  await cache.set(payload.key, await msgpack.encode(payload.value));
  reply.type('application/msgpack').send({ ok: true });
});
```

### Koa

```typescript
import Koa from 'koa';
import { createApp } from '@oneunit/core';

const app = createApp();
const msgpack = app.msgpack();
const koa = new Koa();

koa.use(async (ctx) => {
  if (ctx.is('application/msgpack')) {
    const data = await msgpack.decode<{ q: string }>(ctx.request.body as Uint8Array);
    ctx.body = await msgpack.encode({ results: search(data.q) });
    ctx.type = 'application/msgpack';
  }
});
```

### Node http

```typescript
import http from 'http';
import { createApp } from '@oneunit/core';

const app = createApp();
const msgpack = app.msgpack();

http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const decoded = await msgpack.decode<{ op: string }>(body);
  const response = await msgpack.encode({ status: 'ack', op: decoded.op });

  res.setHeader('Content-Type', 'application/msgpack');
  res.end(response);
}).listen(3000);
```

Common patterns:

- **RPC payloads**: encode method name and arguments into a single binary blob, decode on the server, dispatch, and encode the response.
- **Cache serialization**: store `encodeSync` output in Redis or Memcached instead of JSON strings for smaller memory footprint and faster round trips.
- **Message queues**: publish `Uint8Array` payloads to RabbitMQ, Kafka, or NATS subscribers that call `decodeSync` on receipt.

## Best Practices

- Prefer `encode`/`decode` (async) in request handlers and hot paths; reserve `encodeSync`/`decodeSync` for tiny payloads in synchronous code.
- Always pass a type argument to `decode<T>`/`decodeSync<T>` so callers know the expected shape.
- Use `sortKeys: true` when you need byte-identical output for caching, signatures, or deduplication.
- Set `maxDepth` lower than the default when decoding untrusted, deeply nested payloads to guard against stack exhaustion.
- Do not store secrets or PII in MessagePack without additional encryption; MessagePack is an encoding, not encryption.
- Validate decoded payloads against a schema before using them in business logic; the generic type parameter is erased at runtime.
- Set `Content-Type: application/msgpack` when sending binary payloads over HTTP.

## Error Handling

`app.msgpack()` throws errors from the underlying `@msgpack/msgpack` library in these situations:

- **Invalid input data**: passing malformed bytes to `decode`/`decodeSync` throws a decode error.
- **Exceeded depth**: encoding or decoding a structure deeper than `maxDepth` throws a depth-limit error.
- **Unsupported values**: encoding values the codec cannot represent (for example, certain symbols or functions without an extension codec) throws an encoding error.
- **Extension codec errors**: a custom `extensionCodec` that throws during encode or decode propagates that error.

Wrap encode/decode calls in `try/catch` when handling untrusted input:

```typescript
try {
  const user = await msgpack.decode<User>(payload);
} catch (err) {
  // Handle invalid or malicious MessagePack payload
  throw new Error(`Invalid messagepack payload: ${(err as Error).message}`);
}
```
