# Cookie — Usage Guide

@oneunit/core v1.0.0

## Overview

The Cookie feature provides secure cookie management for web applications built on @oneunit/core. It supports plain, signed, and encrypted cookies, automatic framework detection (Express, Fastify, Koa, node:http), named isolated stores, cookie prefix security enforcement (__Secure- and __Host-), and serialized Set-Cookie / Cookie header handling.

Access the cookie store through your application instance:

```ts
const cookies = app.cookies()
```

The returned `CookieStore` lets you read and write cookies on the current request/response context. Each call operates on a per-request store that is automatically bound to the detected framework.

## Quick Start

```ts
import { createApp } from "@oneunit/core"

const app = createApp()

app.get("/login", (req, res) => {
  const cookies = app.cookies(req, res)

  cookies.set("session_id", "abc123", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 3600,
  })

  const session = cookies.get("session_id")
  console.log(session) // "abc123"

  res.send("Logged in")
})
```

## Basic Operations

### set(name, value, options?)

Sets a cookie. Returns the `CookieStore` for chaining.

```ts
const cookies = app.cookies(req, res)

cookies.set("theme", "dark", {
  path: "/",
  maxAge: 86400,
  httpOnly: false,
  sameSite: "lax",
})

// Chaining
cookies.set("a", "1").set("b", "2").set("c", "3")
```

### get(name) → string | undefined

Reads a cookie by name.

```ts
const theme = cookies.get("theme")
// "dark" or undefined
```

### has(name) → boolean

Checks whether a cookie is present.

```ts
if (cookies.has("session_id")) {
  // user is authenticated
}
```

### delete(name, options?) → CookieStore

Removes a cookie by clearing it. Returns the `CookieStore` for chaining.

```ts
cookies.delete("session_id", { path: "/" })
```

### all() → Record<string, string>

Returns all cookies as a key/value map.

```ts
const all = cookies.all()
// { theme: "dark", session_id: "abc123" }
```

### clear() → CookieStore

Removes all cookies. Returns the `CookieStore` for chaining.

```ts
cookies.clear()
```

## Signed Cookies

### setSigned(name, value, options?) → CookieStore

Sets a cookie with an HMAC-SHA256 signature. The value is signed so any tampering is detectable on read. Returns the `CookieStore` for chaining.

```ts
cookies.setSigned("user", "42", {
  secret: "my-signing-key",
  httpOnly: true,
  sameSite: "strict",
})
```

### getSigned(name) → string | undefined

Verifies the HMAC-SHA256 signature and returns the original value, or `undefined` if the cookie is missing, unsigned, or tampered with. Supports fallback secrets for key rotation.

```ts
const user = cookies.getSigned("user")
// "42" if signature is valid
// undefined if tampered with or missing
```

### Fallback secrets

Pass an array of secrets via `secrets`. The first secret is used for signing; all listed secrets are tried during verification. This enables secret rotation without invalidating existing cookies.

```ts
cookies.setSigned("user", "42", {
  secret: "current-signing-key",
  secrets: ["current-signing-key", "previous-signing-key"],
})

const user = cookies.getSigned("user")
// Verified against all secrets in the array
```

### Tamper detection

If the signature does not match any configured secret, `getSigned()` returns `undefined`. The cookie is treated as untrusted and never returned.

## Encrypted Cookies

### setEncrypted(name, value, options?) → CookieStore

Sets a cookie with AES-256-GCM encryption. The plaintext is encrypted so it cannot be read or modified by the client. Returns the `CookieStore` for chaining.

```ts
cookies.setEncrypted("prefs", "{ \"theme\": \"dark\" }", {
  secret: "my-encryption-key",
  httpOnly: true,
  secure: true,
})
```

### getEncrypted(name) → string | null

Decrypts the cookie and returns the plaintext, or `null` if the cookie is missing, not encrypted, or the ciphertext/auth tag has been tampered with. Supports fallback secrets for key rotation.

```ts
const prefs = cookies.getEncrypted("prefs")
// "{ \"theme\": \"dark\" }" if decryption succeeds
// null if tampered with or missing
```

### Fallback secrets

Pass an array of secrets via `secrets`. The first secret encrypts; all listed secrets are attempted during decryption.

```ts
cookies.setEncrypted("prefs", "{ \"theme\": \"dark\" }", {
  secret: "current-encryption-key",
  secrets: ["current-encryption-key", "previous-encryption-key"],
})

const prefs = cookies.getEncrypted("prefs")
// Decrypted with the first secret that succeeds
```

## Cookie Options

Full reference of `CookieOptions`. These apply to `set`, `setSigned`, `setEncrypted`, `delete`, and `serialize`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | `string` | `"/"` | The URL path that must exist in the request URL to send the Cookie header. |
| `domain` | `string` | `undefined` | The domain for which the cookie is valid. Omit for host-only cookies. |
| `expires` | `Date` | `undefined` | The expiry date. If omitted with `maxAge: 0`, the cookie is a session cookie. |
| `maxAge` | `number` | `0` | Max age in seconds. `0` means a session cookie. |
| `secure` | `boolean` | `NODE_ENV === "production"` | Only send over HTTPS. Defaults to `true` in production, `false` otherwise. |
| `httpOnly` | `boolean` | `true` | Inaccessible to JavaScript `document.cookie`. |
| `sameSite` | `"strict" \| "lax" \| "none" \| boolean` | `"lax"` | Controls cross-site cookie sending. `true` maps to `"lax"`, `false` means unset. |
| `signed` | `boolean` | `false` | Signs the cookie with HMAC-SHA256. |
| `encrypted` | `boolean` | `false` | Encrypts the cookie with AES-256-GCM. |
| `secret` | `string` | `undefined` | The signing/encryption secret. |
| `secrets` | `string[]` | `undefined` | Fallback secrets for verification/decryption (key rotation). |
| `encode` | `(value: string) => string` | `undefined` | Custom encoder for the cookie value. |
| `decode` | `(value: string) => string` | `undefined` | Custom decoder for the cookie value. |

### Default values

```
path="/"
secure=(NODE_ENV === "production")
httpOnly=true
sameSite="lax"
maxAge=0
signed=false
encrypted=false
```

## Security Prefixes

### __Secure-

Cookie names prefixed with `__Secure-` require the `Secure` attribute. Setting a `__Secure-` cookie without `secure: true` throws an error.

```ts
// Throws: __Secure- cookies require the Secure attribute
cookies.set("__Secure-session", "abc", { secure: false })

// OK
cookies.set("__Secure-session", "abc", { secure: true })
```

### __Host-

Cookie names prefixed with `__Host-` require:
- `secure: true`
- `path: "/"`
- No `domain` attribute

Violating any of these throws an error.

```ts
// Throws: missing Secure, Path=/, or has Domain
cookies.set("__Host-session", "abc", { secure: true, path: "/", domain: "example.com" })

// OK
cookies.set("__Host-session", "abc", { secure: true, path: "/" })
```

## SameSite=None Requires Secure

A cookie with `sameSite: "none"` must also have `secure: true`. Setting `sameSite: "none"` without `secure` throws an error.

```ts
// Throws: SameSite=None requires Secure
cookies.set("x", "1", { sameSite: "none", secure: false })

// OK
cookies.set("x", "1", { sameSite: "none", secure: true })
```

## Cookie Name Validation

Cookie names must not be empty and must not contain `=`, `;`, or whitespace characters. Invalid names throw an error.

```ts
// Throws: invalid cookie name
cookies.set("bad name", "x")
cookies.set("bad=name", "x")
cookies.set("bad;name", "x")
cookies.set("", "x")

// OK
cookies.set("valid_name", "x")
cookies.set("session-id", "x")
```

## Framework Auto-Detection

Call `cookies(req, res)` outside of a request handler (or pass the request/response explicitly) to create a framework-detected store. Detection order:

| Framework | Detection signal |
|-----------|------------------|
| Koa | `ctx.cookies` is present |
| Fastify | `req.cookies` is present |
| Express | `req.headers.cookie` is present |
| node:http | `res.setHeader` is present |
| Fallback | In-memory store |

### Express

```ts
app.use((req, res, next) => {
  const cookies = app.cookies(req, res)
  cookies.set("visited", "true")
  next()
})
```

### Fastify

```ts
app.get("/", async (req, res) => {
  const cookies = app.cookies(req, res)
  cookies.set("visited", "true")
  return { ok: true }
})
```

### Koa

```ts
app.use(async (ctx) => {
  const cookies = app.cookies(ctx.req, ctx.res)
  cookies.set("visited", "true")
  ctx.body = { ok: true }
})
```

### node:http

```ts
const server = http.createServer((req, res) => {
  const cookies = app.cookies(req, res)
  cookies.set("visited", "true")
  res.end("ok")
})
```

## Named Isolated Stores

Create isolated cookie stores with their own configuration. Stores are identified by name and do not share state with the default store or each other.

### createStore(name, config?) → CookieStoreAPI

```ts
const sessionStore = app.cookies().createStore("session", {
  secure: true,
  httpOnly: true,
  sameSite: "strict",
  secret: "session-signing-key",
})

sessionStore.set("userId", "42")
sessionStore.setSigned("token", "abc", { secret: "session-signing-key" })
```

### getStore(name) → CookieStoreAPI | undefined

Retrieves a previously created named store, or `undefined` if it does not exist.

```ts
const store = app.cookies().getStore("session")
if (store) {
  const userId = store.get("userId")
}
```

### Example

```ts
app.cookies().createStore("analytics", {
  secure: false,
  httpOnly: false,
  sameSite: "lax",
})

app.cookies().createStore("auth", {
  secure: true,
  httpOnly: true,
  sameSite: "strict",
  secret: "auth-key",
})

const auth = app.cookies().getStore("auth")
auth.setSigned("session", "xyz")
```

## Serialize/Parse

### serialize(name, value, options?) → string

Produces a `Set-Cookie` header value string. Useful when you need to construct the header manually.

```ts
const header = cookies.serialize("theme", "dark", {
  path: "/",
  maxAge: 86400,
  httpOnly: false,
  sameSite: "lax",
})
// "theme=dark; Path=/; Max-Age=86400; SameSite=Lax"

res.setHeader("Set-Cookie", header)
```

### parse(cookieHeader) → Record<string, string>

Parses a `Cookie` header string into a key/value map.

```ts
const parsed = cookies.parse("theme=dark; session_id=abc123")
// { theme: "dark", session_id: "abc123" }
```

## Production vs Development

The `secure` flag defaults to `true` when `NODE_ENV === "production"` and `false` otherwise. In development, cookies work over HTTP; in production they require HTTPS.

```ts
process.env.NODE_ENV = "production"
const cookies = app.cookies()
// cookies.set("x", "1") -> secure defaults to true

process.env.NODE_ENV = "development"
// cookies.set("x", "1") -> secure defaults to false
```

Explicitly set `secure` in options to override the default:

```ts
cookies.set("x", "1", { secure: false }) // over HTTP in any env
```

## Best Practices

### Do

- Use `httpOnly: true` for session and auth cookies to prevent XSS theft.
- Use `secure: true` in production so cookies are only sent over HTTPS.
- Use `sameSite: "strict"` or `"lax"` to mitigate CSRF.
- Use signed cookies (`setSigned`/`getSigned`) when the client must not tamper with the value.
- Use encrypted cookies (`setEncrypted`/`getEncrypted`) when the value must be confidential.
- Rotate secrets by appending old secrets to the `secrets` array and adding a new `secret`.
- Validate cookie names before setting (avoid `=`, `;`, whitespace).
- Use `__Host-` prefix for the most sensitive host-only cookies.

### Don't

- Store sensitive plaintext in unsigned/unencrypted cookies.
- Set `sameSite: "none"` without `secure: true`.
- Set `__Secure-` cookies without `secure: true`.
- Set `__Host-` cookies with a `domain` attribute or `path` other than `"/"`.
- Rely on client-controlled cookie values for authorization decisions.
- Use the same secret for signing and encryption across long periods without rotation.

## Error Handling

The Cookie feature throws errors for the following situations:

| Error condition | Thrown when |
|-----------------|-------------|
| Invalid cookie name | Name is empty or contains `=`, `;`, or whitespace |
| `__Secure-` without Secure | Name starts with `__Secure-` and `secure` is not `true` |
| `__Host-` missing Secure | Name starts with `__Host-` and `secure` is not `true` |
| `__Host-` missing Path=/ | Name starts with `__Host-` and `path` is not `"/"` |
| `__Host-` has Domain | Name starts with `__Host-` and `domain` is set |
| SameSite=None without Secure | `sameSite` is `"none"` and `secure` is not `true` |
| Missing secret for signed/encrypted | `signed` or `encrypted` is `true` but no `secret`/`secrets` provided |

Errors are thrown synchronously at the point of the invalid operation (e.g. during `set`, `setSigned`, `setEncrypted`, or `serialize`). Catch them with `try/catch` if you need to degrade gracefully:

```ts
try {
  cookies.set("__Host-session", "abc", { secure: true, path: "/" })
} catch (err) {
  console.error("Cookie rejected:", err.message)
}
```
