# Cookie Feature Architecture

## Overview

The cookie feature provides a framework-agnostic cookie store with support for plain, signed, and encrypted cookies across Express, Fastify, Koa, and native `node:http`.

## File layout

```
src/cookie/
├── index.ts              # Public barrel exports
├── types.ts              # TypeScript interfaces & types
├── configs.ts            # Default config & option merging
├── registery.ts          # Core store implementation
└── adapters/
    ├── index.ts          # (if present)
    ├── types.ts          # CookieAdapter & CookieOptions types
    ├── express.ts        # Express req/res adapter
    ├── fastify.ts        # Fastify req/reply adapter
    ├── koa.ts            # Koa ctx adapter
    └── http.ts           # node:http req/res adapter
```

## Core concepts

### CookieStore

`CookieStore` is the central abstraction. It owns an in-memory `Map<string, CookieEntry>` and exposes:

- `get(name)` / `set(name, value, options?)` — plain read/write
- `setSigned` / `getSigned` — HMAC-signed cookies
- `setEncrypted` / `getEncrypted` — AES-256-CBC encrypted cookies
- `serialize(name, value, options?)` — builds a `Set-Cookie` header string
- `parse(cookieHeader)` — parses a `Cookie` header into a record
- `all()` — returns verified/decrypted values for signed & encrypted cookies
- `has(name)`, `delete(name, options?)`, `clear()`, `chainable` returns `this`

### CookieEntry

Every stored cookie is wrapped in a `CookieEntry`:

```ts
interface CookieEntry {
    value: string;      // raw stored value (may be signed/encrypted payload)
    signed: boolean;    // true if value carries a HMAC signature
    encrypted: boolean; // true if value is AES-256-CBC ciphertext
    secret?: string;    // secret used to sign/encrypt (falls back to config secret)
}
```

The raw `Map` is exposed as `store["store"]` for introspection/testing.

### CookieConfig vs CookieOptions

`CookieConfig` = global defaults applied at store creation.
`CookieOptions` = per-call overrides applied on `set`/`serialize`.

Merge precedence:

```
per-call options  >  global config  >  DEFAULT_COOKIE_CONFIG
```

`DEFAULT_COOKIE_CONFIG`:

```ts
{
    path: "/",
    secure: false,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    signed: false,
    encrypted: false,
}
```

## Cookie types

Three mutually-exclusive modes per `set()` call:

| Mode | Storage | Retrieval | Requires secret |
|------|---------|-----------|-----------------|
| Plain | `value` | `get()` | No |
| Signed | `value.signature` (HMAC-SHA256) | `getSigned()` verifies signature | Yes |
| Encrypted | `salt:iv:ciphertext` (AES-256-CBC) | `getEncrypted()` decrypts | Yes |

- `signed: true` on config auto-signs every `set()`.
- `encrypted: true` on config auto-encrypts every `set()`.
- If both `signed` and `encrypted` are set on one call, **encrypted wins** (the value is stored as ciphertext).
- `secure` only affects the `Set-Cookie` attribute emitted by `serialize()`/adapters; it does **not** affect signing or encryption.

## Crypto

- Signing: `createHmac("sha256" | "sha512", secret).update(value).digest("hex")`
- Encryption: `scryptSync(secret, salt, 32)` → AES-256-CBC with random 16-byte salt and IV
- Serialized form: `salt:iv:ciphertext` (all hex)
- Tampered signed cookies → `getSigned()` returns `undefined`
- Tampered encrypted cookies → `getEncrypted()` returns `null`

## Framework adapters

`CookieAdapter` bridges the store to a web framework:

```ts
interface CookieAdapter {
    get(name): string | undefined;
    set(name, value, options): void;
    delete(name, options?): void;
    getAll(): Record<string, string>;
}
```

| Adapter | Constructor args | Framework |
|---------|-----------------|-----------|
| `createExpressCookieAdapter(req, res)` | Express `req`, `res` | Express |
| `createFastifyCookieAdapter(req, reply)` | Fastify `req`, `reply` | Fastify |
| `createKoaCookieAdapter(ctx)` | Koa `ctx` | Koa |
| `createHttpCookieAdapter(req, res)` | node:http `req`, `res` | node:http |

Adapters handle reading the `Cookie` header and writing `Set-Cookie` headers natively for their framework.

## Store variants

### `createCookieStore(config?)`

In-memory store. Accepts `CookieConfig` or a shorthand string:

```ts
createCookieStore("my-secret");        // { secret: "my-secret", signed: true }
createCookieStore({ secret, signed: true });
```

### `createCookieStoreFromAdapter(adapter, config?)`

Adapter-backed store. Reads/writes through the framework adapter instead of the in-memory map. The in-memory map still tracks `CookieEntry` metadata for `getSigned`/`getEncrypted`.

### `createDetectedCookieStore(req, res, ctx, config?)`

Auto-detects the framework and returns the appropriate store:

1. `ctx.cookies` → Koa adapter store
2. `req.headers.cookie` + `res.setHeader` → Express adapter store
3. `res.setHeader` only → node:http adapter store
4. Otherwise → plain in-memory store

### `detectCookieFramework(req, res, ctx)`

Returns `{ framework, confidence }` where `framework` is `"express" \| "fastify" \| "koa" \| "http" \| "unknown"`.

## DX conveniences

- **String shortcut**: `createCookieStore("secret")` auto-enables signing.
- **`setSigned` / `setEncrypted`**: aliases for `set(..., { signed: true })` / `set(..., { encrypted: true })`.
- **Per-call secret**: `set(name, value, { secret: "..." })` overrides the config secret for that call.
- **Chainable**: all mutating methods return `this`.

## Example usage

```ts
import {
    createCookieStore,
    createCookieStoreFromAdapter,
    createExpressCookieAdapter,
    createFastifyCookieAdapter,
    createKoaCookieAdapter,
    createHttpCookieAdapter,
    createDetectedCookieStore,
} from "./cookie/index.js";

// Plain cookie
const cookies = createCookieStore();
cookies.set("theme", "dark", { path: "/", httpOnly: true });
cookies.get("theme"); // "dark"

// Signed (string shortcut auto-enables signing)
const signed = createCookieStore("my-secret");
signed.setSigned("session", "user-123");
signed.getSigned("session"); // "user-123"

// Encrypted
const enc = createCookieStore("my-secret");
enc.setEncrypted("token", "abc123");
enc.getEncrypted("token"); // "abc123"

// Mixed plain/signed/encrypted
const mixed = createCookieStore({ secret: "s", signed: true });
mixed.set("plain", "hello");
mixed.set("session", "u1", { signed: true });
mixed.set("secret", "sensitive", { encrypted: true });
mixed.all(); // { plain: "hello", session: "u1", secret: "sensitive" }

// Serialize a Set-Cookie header
cookies.serialize("session", "abc", {
    httpOnly: true, secure: true, sameSite: "strict", maxAge: 3600,
// "session=abc; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600"
});

// Parse a Cookie header
cookies.parse("theme=dark; session=xyz");
// { theme: "dark", session: "xyz" }

// Per-call secret overrides the config secret
mixed.set("session", "other", { secret: "other-secret", signed: true });

// Secret rotation: sign with `secret`, verify with `secret` or any entry in `secrets`
const rotating = createCookieStore({
    secret: "current-secret",
    secrets: ["old-secret"],
    signed: true,
});
rotating.setSigned("session", "user-123");
// A cookie signed with the old secret still verifies:
rotating.getSigned("session"); // "user-123"

// Stateless cross-request: verify/decrypt from payload alone, no shared Map
let setCookieHeader: string | undefined;
const reqA: any = { headers: {} };
const resA: any = { setHeader: (_n: string, v: string) => { setCookieHeader = v; } };
const storeA = createCookieStoreFromAdapter(createExpressCookieAdapter(reqA, resA), { secret: "s", signed: true });
storeA.setSigned("session", "user-123");

// Next request carries the Set-Cookie value as the Cookie header
const reqB: any = { headers: { cookie: setCookieHeader } };
const storeB = createCookieStoreFromAdapter(createExpressCookieAdapter(reqB, resA), { secret: "s", signed: true });
storeB.getSigned("session"); // "user-123" (verified from payload alone)

// Framework adapters (Express)
const expressStore = createCookieStoreFromAdapter(createExpressCookieAdapter(req, res), { secret: "s", signed: true });
expressStore.setSigned("session", "user-123");

// Fastify
const fastifyStore = createCookieStoreFromAdapter(createFastifyCookieAdapter(req, reply), { secret: "s", encrypted: true });
fastifyStore.setEncrypted("token", "abc123");

// Koa
const koaStore = createCookieStoreFromAdapter(createKoaCookieAdapter(ctx), { secret: "s", signed: true });
koaStore.setSigned("session", "user-123");

// node:http
const httpStore = createCookieStoreFromAdapter(createHttpCookieAdapter(req, res), { secret: "s" });
httpStore.set("theme", "dark");

// Auto-detect framework
const detected = createDetectedCookieStore(req, res, ctx);
detected.set("a", "1"); // writes via the right adapter

// Chainable
cookies.set("a", "1").set("b", "2").delete("a");

// SameSite=None requires Secure (throws otherwise)
try {
    cookies.serialize("x", "y", { sameSite: "none" });
} catch (e) {
    // Error: SameSite=None requires Secure
}

// maxAge: 0 (default) omits Max-Age → session cookie
cookies.serialize("s", "v", { maxAge: 0 }); // no Max-Age attribute
cookies.serialize("s", "v", { maxAge: 3600 }); // includes Max-Age=3600
```

## Type exports

`CookieOptions`, `CookieConfig`, `CookieAdapter`, `CookieStore`, `CookieEntry`, `DetectedCookieFramework`, `ServerOnlyCookieOptions`, `CookieFramework`, `DEFAULT_COOKIE_CONFIG`, `mergeCookieOptions`.
