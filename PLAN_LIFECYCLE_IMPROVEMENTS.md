# Lifecycle Plan: Solving Cross-Framework Limitations (Non-Breaking)

## Principle
All changes below are **additive** — new methods, options, and helpers. No existing API signatures, interfaces, or behaviors are modified. Backward compatibility is 100% preserved.

---

## 1. Framework-Specific Middleware Adapters

**Problem:** Middleware assumes Express-style `(req, res, next)`. Fastify needs `req.raw`, Koa needs `ctx.req`/`ctx.res`.

**Solution:** Add adapter factory functions that wrap framework-native objects into the lifecycle middleware signature.

**New exports** (in `src/lifecycle/adapters/` or `src/lifecycle/index.ts`):

```ts
// Express — pass-through (no adaptation needed)
export function expressMiddlewareAdapter(mw: Middleware): (req, res, next) => void

// Fastify — adapts (req, reply) to (req, res, next)
export function fastifyMiddlewareAdapter(
  mw: Middleware
): (req: any, reply: any) => Promise<void>

// Koa — adapts (ctx, next) to (req, res, next)
export function koaMiddlewareAdapter(
  mw: Middleware
): (ctx: any, next: () => void) => Promise<void>

// node:http — pass-through
export function httpMiddlewareAdapter(mw: Middleware): (req, res, next) => void
```

**Usage:**
```ts
const mw = app.lifecycle().createMiddleware("cors", "cors", myCorsLogic);

// Fastify
fastify.use(fastifyMiddlewareAdapter(mw));

// Koa
app.use(koaMiddlewareAdapter(mw));
```

**Feasibility:** High. Pure wrapper functions, no core changes.

---

## 2. Auto-Wiring Helper (reduce boilerplate)

**Problem:** Users must manually call `executeMiddlewareChain()` in every route handler.

**Solution:** Add `createFrameworkMiddleware(framework)` that returns a ready-to-use framework middleware function.

```ts
export function createLifecycleMiddleware(
  lifecycle: LifecycleAPI,
  framework: "express" | "fastify" | "koa" | "http",
  phase: "request" | "response" | "error" = "request"
): (req, res, next?) => void | Promise<void>
```

**Usage:**
```ts
// Express
app.use(createLifecycleMiddleware(core.lifecycle(), "express"));

// Fastify
fastify.all("*", createLifecycleMiddleware(core.lifecycle(), "fastify"));

// Koa
koaApp.use(createLifecycleMiddleware(core.lifecycle(), "koa"));

// node:http
server.on("request", createLifecycleMiddleware(core.lifecycle(), "http"));
```

**Feasibility:** High. Internal wrapper around `executeMiddlewareChain`.

---

## 3. Per-Framework Isolated Lifecycle Instances

**Problem:** Single `app.lifecycle()` is shared — middleware registered for Express leaks into Fastify context.

**Solution:** Add `createLifecycle(options?)` to the App that returns an isolated `LifecycleManager` instance.

**New on `App` interface:**

```ts
export interface App {
  // ... existing ...
  lifecycle(): LifecycleAPI;                    // existing, shared/cached
  createLifecycle(options?: LifecycleOptions): LifecycleAPI;  // NEW: isolated instance
}
```

**Usage:**
```ts
const expressLifecycle = app.createLifecycle({ mode: "advanced" });
const fastifyLifecycle = app.createLifecycle({ mode: "strict" });

expressLifecycle.registerMiddleware("cors", "cors", expressCorsMw);
fastifyLifecycle.registerMiddleware("cors", "cors", fastifyCorsMw);
// No conflict — separate instances
```

**Feasibility:** High. `LifecycleManager` is already a class; `createLifecycle` just instantiates a new one.

---

## 4. Header Conflict Guard

**Problem:** Multiple middleware setting the same header (e.g., CORS from two sources) causes runtime collisions not caught by registration-time conflict detection.

**Solution:** Add optional header tracking to `MiddlewareRegistry` with a `trackHeaders` option.

**New on `MiddlewareRegistry`:**

```ts
register(name, type, middleware, options?: {
  priority?: number;
  conflictTypes?: string[];
  version?: string;
  trackHeaders?: string[];  // headers this middleware sets
})
```

`getValidationReport()` extended to include header conflicts:

```ts
interface ValidationReport {
  safe: boolean;
  conflicts: ConflictInfo[];        // existing (registration-time)
  headerConflicts: HeaderConflict[]; // NEW (runtime header tracking)
  warnings: ConflictInfo[];
  errors: ConflictInfo[];
}

interface HeaderConflict {
  header: string;
  setBy: string[];  // middleware names
  severity: "warning" | "error";
}
```

**Feasibility:** Medium. Requires wrapping middleware to capture `setHeader` calls, but purely additive.

---

## 5. Named/Isolated Cookie Stores

**Problem:** `app.cookies(req, res)` creates a store cached per `(req, res)` pair, but there's no way to have logically separate stores (e.g., session cookies vs auth cookies) within the same framework instance.

**Solution:** Add `createCookieStore(name, config)` to create named, isolated cookie stores.

**New on `CookieStoreAPI` / App:**

```ts
export interface App {
  cookies(req?, res?): CookieStoreAPI;           // existing, default store
  createCookieStore(name: string, config?: CookieConfig): CookieStoreAPI;  // NEW
  getCookieStore(name: string): CookieStoreAPI | undefined;  // NEW
}
```

**Usage:**
```ts
const sessionCookies = app.createCookieStore("session", { secure: true, httpOnly: true });
const authCookies = app.createCookieStore("auth", { secure: true, sameSite: "strict" });

sessionCookies.set("sid", "abc123");
authCookies.set("token", "jwt-xyz");
// Completely isolated — different secrets, different configs
```

**Feasibility:** High. Internal Map of named stores; no existing API changes.

---

## 6. Per-Framework Secret Override

**Problem:** `createApp({ secret })` uses one secret for CSRF/signing across all frameworks.

**Solution:** Allow `secret` to be specified per-security-call, overriding the app-level default.

Already works today:
```ts
app.security().csrf({ secret: "express-secret" });  // Express-specific
app.security().csrf({ secret: "fastify-secret" });  // Fastify-specific
```

**New:** Add `secret` to `SecurityDefaults` in `AppOptions`:

```ts
export interface AppOptions {
  secret?: string;                          // app-level default
  security?: {
    csrf?: { secret?: string; ... };        // per-security-call override
    ...
  };
}
```

**Feasibility:** Already works via per-call options; documentation only.

---

## 7. Middleware Execution Order Documentation

**Problem:** Framework-native middleware ordering differs from lifecycle chain ordering.

**Solution:** Document the interaction clearly and recommend using lifecycle `priority` for cross-framework consistency.

No code change — documentation in `USAGE.md` and plan file.

---

## Implementation Order (Recommended)

| Priority | Change | Effort | Risk |
|----------|--------|--------|------|
| 1 | `createLifecycle()` (isolated instances) | Low | None |
| 2 | Framework middleware adapters | Low | None |
| 3 | `createLifecycleMiddleware()` auto-wiring | Low | None |
| 4 | Named cookie stores | Low | None |
| 5 | Header conflict guard | Medium | Low |
| 6 | Documentation updates | Low | None |

---

## What This Does NOT Change

- `createApp()` signature unchanged
- `app.lifecycle()` unchanged (still returns cached shared instance)
- All existing middleware/plugin APIs unchanged
- All 426+ existing tests continue to pass
- No TypeScript breaking changes

---

## Files to Modify

**New files:**
- `src/lifecycle/adapters/express.ts`
- `src/lifecycle/adapters/fastify.ts`
- `src/lifecycle/adapters/koa.ts`
- `src/lifecycle/adapters/http.ts`
- `src/lifecycle/adapters/index.ts`

**Modified files (additive only):**
- `src/core.ts` — add `createLifecycle()` to App interface and implementation
- `src/core.ts` — add `createCookieStore()` / `getCookieStore()` to cookie API
- `src/lifecycle/middleware-registry.ts` — add `trackHeaders` option + header conflict tracking
- `src/lifecycle/types.ts` — add `HeaderConflict`, `ValidationReport.headerConflicts`
- `src/lifecycle/manager.ts` — wire up header conflict reporting
- `USAGE.md` — document cross-framework usage patterns

**No files deleted or signatures changed.**
