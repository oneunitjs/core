# Cookie — Architecture Specification

@oneunit/core v1.0.0

## Component Overview

**Purpose.** The Cookie feature provides a framework-agnostic cookie store abstraction for the `@oneunit/core` package. It enables reading, writing, signing, encrypting, serializing, and deleting cookies across multiple Node.js web frameworks (Express, Fastify, Koa, and native `node:http`) through a unified `CookieStore` interface backed by framework-specific adapters.

**Scope.** The subsystem covers cookie store creation (in-memory and adapter-backed), serialization/deserialization of cookie headers, AES-256-GCM encryption, HMAC-SHA256 signing, cookie name validation, security prefix enforcement (`__Secure-`, `__Host-`), SameSite=None→Secure enforcement, adapter-based framework detection, and a cookie-specific error model.

**Responsibilities.**
- Normalize and merge user cookie options with `DEFAULT_COOKIE_CONFIG`.
- Create an in-memory `Map`-backed cookie store or wrap a framework adapter as a `CookieStore`.
- Serialize cookie values to `Set-Cookie` header strings with security validation.
- Parse incoming `Cookie` headers into name→value records.
- Sign cookie values (HMAC-SHA256) and encrypt them (AES-256-GCM) with fallback-secret support.
- Enforce security prefix rules (`__Secure-` requires `secure=true`; `__Host-` additionally requires `path="/"` and no `domain`).
- Enforce SameSite=None requires Secure.
- Detect the HTTP framework from request/response/context shape and route to the correct adapter.

## Source File Map

| File Path | Responsibility | Key Exports |
|-----------|----------------|-------------|
| `src/cookie/index.ts` | Barrel module re-exporting the cookie factory functions, adapters, defaults, and option merger. | `createExpressCookieAdapter`, `createFastifyCookieAdapter`, `createKoaCookieAdapter`, `createHttpCookieAdapter`, `createCookieStore`, `createCookieStoreFromAdapter`, `createDetectedCookieStore`, `detectCookieFramework`, `DEFAULT_COOKIE_CONFIG`, `mergeCookieOptions` |
| `src/cookie/types.ts` | TypeScript interfaces and type aliases for the cookie subsystem. | `CookieSameSite`, `CookieOptions`, `CookieConfig`, `CookieAdapter`, `CookieStore`, `CookieFramework`, `DetectedCookieFramework`, `ServerOnlyCookieOptions`, `CookieEntry`, `CookieIo` (internal) |
| `src/cookie/configs.ts` | Canonical default config and option merger. `secure` defaults to `process.env.NODE_ENV === "production"`. | `DEFAULT_COOKIE_CONFIG`, `mergeCookieOptions` |
| `src/cookie/cookie-utils.ts` | Cookie header parsing, SameSite attribute rendering, cookie-part building, serialization, delete-cookie building, name validation. Duplicate `mergeCookieOptions` (secure defaults to `false`); not canonical. | `parseCookieHeader`, `sameSiteAttr`, `buildCookieParts`, `serializeCookieString`, `buildDeleteCookieParts`, `validateCookieName`, `mergeCookieOptions` (duplicate) |
| `src/cookie/registery.ts` | Core store factory, encryption/signing primitives, adapter detection, detected store routing. | `createCookieStore`, `createCookieStoreFromAdapter`, `detectCookieFramework`, `createDetectedCookieStore`, `DEFAULT_COOKIE_CONFIG`, `mergeCookieOptions` (re-exported) |
| `src/adapters/cookie/base.ts` | Abstract base adapter implementing `CookieAdapter` with initialized-state guards; delegates raw header I/O to subclasses. | `BaseCookieAdapter`, `CookieAdapterConfig` |
| `src/adapters/cookie/express.ts` | Express `req`/`res` adapter: reads `req.headers.cookie`, writes via `res.setHeader("Set-Cookie", ...)`. | `ExpressCookieAdapter`, `createExpressCookieAdapter` |
| `src/adapters/cookie/fastify.ts` | Fastify `req`/`reply` adapter: reads `req.cookies`, writes via `reply.setCookie()`/`reply.unsetCookie()`. | `FastifyCookieAdapter`, `createFastifyCookieAdapter` |
| `src/adapters/cookie/koa.ts` | Koa `ctx` adapter: reads/writes via `ctx.cookies.get()`/`ctx.cookies.set()`. | `KoaCookieAdapter`, `createKoaCookieAdapter` |
| `src/adapters/cookie/http.ts` | Native `node:http` `req`/`res` adapter: reads `req.headers.cookie`, writes via `res.setHeader("Set-Cookie", ...)`. | `HttpCookieAdapter`, `createHttpCookieAdapter` |
| `src/adapters/cookie/index.ts` | Barrel module re-exporting all framework cookie adapters. | `ExpressCookieAdapter`, `FastifyCookieAdapter`, `KoaCookieAdapter`, `HttpCookieAdapter`, `BaseCookieAdapter`, `CookieAdapterConfig` |
| `src/errors/cookie.ts` | Cookie-specific error classes extending `OneUnitError`. | `CookieError`, `CookieSecretRequiredError`, `InvalidCookieNameError`, `CookieSecurePrefixError`, `SameSiteNoneRequiresSecureError`, `CookieDecryptionError`, `CookieSignatureError` |
| `src/adapters/types.ts` | Shared adapter types: `FrameworkName`, `BaseAdapter`, `AdapterError`, `AdapterNotInitializedError`. | `FrameworkName`, `BaseAdapter`, `AdapterError`, `AdapterNotInitializedError` |

## Component Relationships Diagram (Mermaid)

```mermaid
flowchart TD
    classDef factory fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef store fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef adapter fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef util fill:#f3e5f5,stroke:#4a148c,stroke-width:2px

    CS[createCookieStore]:::factory
    CSA[createCookieStoreFromAdapter]:::factory
    CDS[createDetectedCookieStore]:::factory
    DCF[detectCookieFramework]:::factory
    CR[createStore]:::factory

    S[(CookieStore / Map store)]:::store
    IO(CookieIo):::store
    BC[BaseCookieAdapter]:::adapter
    EA[ExpressCookieAdapter]:::adapter
    FA[FastifyCookieAdapter]:::adapter
    KA[KoaCookieAdapter]:::adapter
    HA[HttpCookieAdapter]:::adapter

    CS --> CR
    CSA --> CR
    CDS --> DCF
    CDS --> EA & FA & KA & HA & CS
    CR --> S
    CR --> IO
    BC <|-- EA
    BC <|-- FA
    BC <|-- KA
    BC <|-- HA
```

## Data Flow Diagrams (Mermaid)

### 1. `set(name, value, options)`

```mermaid
flowchart TD
    classDef process fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef store fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px

    A[set(name, value, options)]:::process
    B[validateCookieName(name)]:::process
    C[mergeCookieOptions(config_, options)]:::process
    D{{encrypted?}}:::decision
    E{{signed?}}:::decision
    F[encryptValue → AES-256-GCM]:::process
    G[signValue → HMAC-SHA256]:::process
    H[plain: store value]:::process
    I[store.set(name, CookieEntry)]:::store
    J[io.write(name, value, merged)]:::process

    A --> B --> C --> D
    D -->|yes| F
    D -->|no| E
    E -->|yes| G
    E -->|no| H
    F --> I
    G --> I
    H --> I
    I --> J
```

### 2. `getSigned(name)`

```mermaid
flowchart TD
    classDef process fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef io fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px

    A[getSigned(name)]:::process
    B[read entry from store]:::process
    C{{entry exists?}}:::decision
    D[read io.read(name)]:::process
    E{{payload undefined?}}:::decision
    F[payload.split(".")]:::process
    G{{parts.length === 2?}}:::decision
    H[verifySignedValue timingSafeEqual]:::process
    I{{verified?}}:::decision
    J[iterate config_.secrets fallback]:::process
    K[return signedValue]:::io
    L[return undefined]:::io

    A --> B --> C
    C -->|yes| F
    C -->|no| D --> E
    E -->|yes| L
    E -->|no| F
    F --> G
    G -->|no| L
    G -->|yes| H --> I
    I -->|yes| K
    I -->|no| J --> I
    J -->|exhausted| L
```

### 3. `getEncrypted(name)`

```mermaid
flowchart TD
    classDef process fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef io fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px

    A[getEncrypted(name)]:::process
    B[read entry from store]:::process
    C{{entry exists?}}:::decision
    D[read io.read(name)]:::process
    E{{payload undefined?}}:::decision
    F[decryptValue AES-256-GCM]:::process
    G{{result !== null?}}:::decision
    H[iterate config_.secrets fallback]:::process
    I[return decrypted value]:::io
    J[return null]:::io

    A --> B --> C
    C -->|yes| F
    C -->|no| D --> E
    E -->|yes| J
    E -->|no| F
    F --> G
    G -->|yes| I
    G -->|no| H --> F
    H -->|exhausted| J
```

### 4. `serialize(name, value, options)`

```mermaid
flowchart TD
    classDef process fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef io fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px

    A[serialize(name, value, options)]:::process
    B[mergeCookieOptions(config_, options)]:::process
    C[validateCookieName(name)]:::process
    D[hasSecurePrefix(name)?]:::decision
    E[__Secure- → require secure=true]:::process
    F[__Host- → require secure=true, path="/", no domain]:::process
    G[serializeCookieString → SameSite=None requires Secure]:::process
    H[buildCookieParts]:::process
    I[return Set-Cookie string]:::io

    A --> B --> C --> D
    D -->|yes| E --> F --> G
    D -->|no| G
    G --> H --> I
```

### 5. `cookies(req, res)` / detected store routing

```mermaid
flowchart TD
    classDef process fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef adapter fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px

    A[createDetectedCookieStore(req, res, ctx, config)]:::process
    B[detectCookieFramework(req, res, ctx)]:::process
    C{{ctx.cookies?}}:::decision
    D{{req.cookies?}}:::decision
    E{{req.headers.cookie?}}:::decision
    F{{res.setHeader?}}:::decision
    G[createKoaCookieAdapter(ctx)]:::adapter
    H[createFastifyCookieAdapter(req, res)]:::adapter
    I[createExpressCookieAdapter(req, res)]:::adapter
    J[createHttpCookieAdapter(req, res)]:::adapter
    K[createCookieStore(config) in-memory fallback]:::process

    A --> B --> C
    C -->|yes| G
    C -->|no| D
    D -->|yes| H
    D -->|no| E
    E -->|yes| I
    E -->|no| F
    F -->|yes| J
    F -->|no| K
    G & H & I & J --> K2[createCookieStoreFromAdapter(adapter, config)]
    K --> K2
```

## Internal State Model

**store:** `Map<string, CookieEntry>` — in-memory key-value store keyed by cookie name.

**CookieEntry:**
```ts
interface CookieEntry {
    value: string;      // raw, signed (value.signature), or encrypted ciphertext
    signed: boolean;    // true if value carries an HMAC signature
    encrypted: boolean; // true if value is AES-256-GCM ciphertext
    secret?: string;    // secret used to sign/encrypt this entry
}
```

**config_:** merged `CookieConfig` = `{ ...DEFAULT_COOKIE_CONFIG, ...userConfig }`.

**io:** `CookieIo` interface (read/write/remove/clear/snapshot). Two implementations exist:
- In-memory (`createCookieStore`): read/write against the same `Map`; `write` is a no-op.
- Adapter-backed (`createCookieStoreFromAdapter`): delegates to the framework adapter's `get`/`set`/`delete`/`getAll`; `clear` is a no-op.

**DEFAULT_COOKIE_CONFIG:**
```ts
{
    path: "/",
    secure: undefined,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    signed: false,
    encrypted: false,
}
```

## Design Patterns

- **Strategy Pattern:** Framework-specific adapters (`ExpressCookieAdapter`, `FastifyCookieAdapter`, `KoaCookieAdapter`, `HttpCookieAdapter`) extend `BaseCookieAdapter` and implement framework-specific raw header I/O while sharing serialization logic from `cookie-utils.ts`.
- **Factory Pattern:** `createCookieStore`, `createCookieStoreFromAdapter`, `createDetectedCookieStore`, and per-framework `create*CookieAdapter` functions encapsulate object construction.
- **Decorator Pattern:** `setSigned`/`setEncrypted` delegate to `set()` with the `signed`/`encrypted` flag set, wrapping the base write path.
- **Chain of Responsibility:** `getSigned` and `getEncrypted` try `config_.secret` first, then iterate `config_.secrets` fallbacks until verification/decryption succeeds.

## Technical Implementation Details

**Encryption (AES-256-GCM):**
- Constant `ENCRYPTION_VERSION = 1`, `GCM_IV_LENGTH = 12`.
- `deriveKey(secret, salt, keyLength=32)` uses `scryptSync(secret, salt, keyLength)`.
- `encryptValue`: generates a random 16-byte salt and random 12-byte IV; derives a 32-byte key via scrypt; creates `aes-256-gcm` cipher; sets AAD to the salt; encrypts; returns `"1:salt:iv:ciphertext:authTag"` (hex-encoded components).
- `decryptValue`: parses v1 format (`version:salt:iv:ciphertext:authTag`, 5 parts) or legacy 4-part format (`salt:iv:ciphertext:authTag`); derives key; verifies auth tag via `setAuthTag`; decrypts; returns `null` on any parse or decryption failure.

**Signing (HMAC-SHA256):**
- `signValue(value, secret)`: `createHmac("sha256", secret).update(value).digest("hex")`.
- `verifySignedValue`: length check then `timingSafeEqual(Buffer.from(expected), Buffer.from(signature))` to prevent timing attacks.

**Security Prefix Validation:**
- `hasSecurePrefix(name)`: true when name starts with `__Secure-` or `__Host-`.
- `__Secure-`: requires `secure === true`.
- `__Host-`: requires `secure === true`, `path === "/"` (or undefined), and `domain === undefined`.

**SameSite=None:** `serializeCookieString` throws `SameSiteNoneRequiresSecureError` when `sameSite === "none"` and `secure !== true`.

**Cookie Name Validation:** `validateCookieName` rejects empty names or names matching `/[=;\s]/`.

**Serialization format:** `serializeCookieString` → `buildCookieParts` → joins with `"; "`. Parts include `name=value`, `Path`, `Domain`, `Max-Age`, `Expires`, `Secure`, `HttpOnly`, `SameSite`.

**Delete behavior:** `buildDeleteCookieParts` sets `Max-Age=0` and adds `Secure` for secure-prefixed names, but does NOT include `Secure`/`SameSite` unconditionally (documented limitation/bug).

**Cookie header parsing:** `parse` uses the `cookie` npm package's `parseCookie`; `parseCookieHeader` (duplicate utility) splits on `";"` and `"="`.

## Concurrency Considerations

- The in-memory store is a single `Map` per `CookieStore` instance and is not shared across requests unless a framework adapter is used (where state lives in the framework's request/response objects).
- All `Map` operations are synchronous; there is no async I/O within the store itself.
- No locking is provided; concurrent mutation of the same `CookieStore` from multiple async contexts is the caller's responsibility.

## Error Model

| Error | Trigger | Code |
|-------|---------|------|
| `CookieSecretRequiredError` | Signing or encryption requested but no `secret` available (neither per-option nor config). | `COOKIE_SECRET_REQUIRED` |
| `InvalidCookieNameError` | Cookie name is empty or contains `=`, `;`, or whitespace. | `INVALID_COOKIE_NAME` |
| `CookieSecurePrefixError` | `__Secure-` without `secure=true`, or `__Host-` without `secure=true`/`path="/"`/no domain. | `COOKIE_SECURE_PREFIX_ERROR` |
| `SameSiteNoneRequiresSecureError` | `sameSite === "none"` with `secure !== true` during serialization. | `SAMESITE_NONE_REQUIRES_SECURE` |
| `CookieDecryptionError` | Decryption failure (declared in error module; `decryptValue` returns `null` internally rather than throwing). | `COOKIE_DECRYPTION_ERROR` |
| `CookieSignatureError` | Signature verification failure (declared in error module; `getSigned` returns `undefined` internally rather than throwing). | `COOKIE_SIGNATURE_ERROR` |
| `AdapterError` | Adapter method called before `initialize()`. | `ADAPTER_NOT_INITIALIZED` |

## Complexity Analysis

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|----------------|------------------|-------|
| `get(name)` | O(1) | O(1) | Single `Map`/adapter lookup. |
| `set(name, value, options)` plain | O(1) | O(1) | `Map` insert plus constant-size header write. |
| `set` signed | O(1) + HMAC | O(1) | HMAC-SHA256 over value length; output size constant relative to input. |
| `set` encrypted | O(1) + AES-GCM | O(1) | AES-256-GCM encryption; output includes salt, IV, ciphertext, auth tag. |
| `delete(name)` | O(1) | O(1) | `Map` delete plus adapter remove. |
| `has(name)` | O(1) | O(1) | Single read. |
| `all()` | O(n · v) | O(n) | `n` = store size; signed/encrypted entries are re-verified/decrypted (v = value size for crypto). |
| `clear()` | O(n) | O(1) | `Map.clear()` plus adapter clear (no-op). |
| `serialize(name, value, options)` | O(v) | O(v) | String building proportional to value and attribute length. |
| `parse(cookieHeader)` | O(h) | O(h) | `h` = header length; single pass split. |
| `detectCookieFramework` | O(1) | O(1) | Fixed property checks. |
| `encryptValue` / `decryptValue` | O(v) | O(v) | `v` = plaintext/ciphertext length; scrypt key derivation is the dominant cost. |
| `signValue` / `verifySignedValue` | O(v) | O(1) | HMAC over value bytes; `timingSafeEqual` is constant-time over signature length. |
