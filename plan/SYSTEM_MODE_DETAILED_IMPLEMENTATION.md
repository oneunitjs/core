# System Mode Management — Detailed Implementation Guide

**Status:** Implementation-ready (detailed)  
**Companion to:** System Mode Management — Implementation Plan  
**Location:** `src/system-mode/`  
**Audience:** Implementers

This document explains **what** each piece does and **how** it should be implemented. It expands the high-level plan into concrete types, algorithms, invariants, and file-level responsibilities so that coding can proceed without ambiguity.

---

## Table of contents

1. [Goals and non-goals](#1-goals-and-non-goals)
2. [Core concepts](#2-core-concepts)
3. [Public API surface](#3-public-api-surface)
4. [Data types](#4-data-types)
5. [Constants and classification](#5-constants-and-classification)
6. [Error model](#6-error-model)
7. [Concurrency primitives](#7-concurrency-primitives)
8. [State management](#8-state-management)
9. [Presets and integrity](#9-presets-and-integrity)
10. [Security layer](#10-security-layer)
11. [Config resolution and transactions](#11-config-resolution-and-transactions)
12. [Adapters](#12-adapters)
13. [Initialization](#13-initialization)
14. [Mode switching (`setMode`)](#14-mode-switching-setmode)
15. [Override engine](#15-override-engine)
16. [Audit system](#16-audit-system)
17. [Persistence](#17-persistence)
18. [Events](#18-events)
19. [NODE_ENV and backward compatibility](#19-node_env-and-backward-compatibility)
20. [File-by-file implementation order](#20-file-by-file-implementation-order)
21. [Invariants checklist](#21-invariants-checklist)
22. [Testing expectations](#22-testing-expectations)

---

## 1. Goals and non-goals

### Goals

- Provide a **single, auditable control plane** for switching the process between `development`, `test`, and `production` modes.
- Guarantee that mode transitions and manual parameter overrides are **atomic from the library’s point of view** (candidate built → validated → prepared → committed → audited → published).
- Prevent **cross-mode credential leakage** (e.g. dev database URLs never active in production).
- Keep the existing `src/config/` surface **untouched and backward-compatible**.
- Remain **host-agnostic**: the library does not know about specific DB pools, loggers, or middleware; the host supplies adapters.
- Make every security-relevant change **audit-trailed** with a hash chain and redaction of secrets.

### Non-goals (v1)

- Authenticating users (host supplies a trusted `Principal`).
- True distributed transactions across external resources.
- External audit anchoring / checkpoint signing.
- Production rollout governance (e.g. “only allow production mode inside a K8s deployment”).
- Hot-reloading of presets from disk at runtime.

---

## 2. Core concepts

| Concept | Meaning |
|---------|---------|
| **SystemMode** | One of `"development" \| "test" \| "production"`. |
| **ModePreset** | Frozen, versioned, checksummed baseline parameters for a mode. |
| **ModeParameters** | The concrete runtime parameter set (endpoint, DB URL, logging, security, feature flags, error detail). |
| **SystemModeState** | Immutable snapshot: active mode, parameters, overrides, revision, timestamps, initialized flag. |
| **Override** | A single-parameter deviation from the preset, applied only while the current mode remains active. Cleared on mode switch. |
| **Principal** | Caller-supplied identity + capabilities. Library trusts it; does not authenticate. |
| **ConfigTransaction** | Prepare → commit / rollback protocol executed against registered host adapters. |
| **HostModeAdapter** | Host-provided bridge that applies (or rolls back) a subset of `ModeParameters` to a concrete consumer (DB pool, logger, etc.). |
| **AuditEntry** | Append-only, hash-chained record of every attempt (applied or rejected). |
| **Revision** | Monotonically increasing counter; used for optimistic concurrency. |

### High-level data flow

```
Host
  │
  ├─ registerModeAdapter(...)     (once at bootstrap)
  ├─ enablePersistence(...)       (optional)
  ├─ initialize(...)              (mandatory cold-start)
  │
  ├─ setMode(...)                 ──► authorize → preset → secrets → isolation
  │                                   → build candidate → adapter coverage
  │                                   → tx.prepare → tx.commit
  │                                   → publish state → NODE_ENV? → audit → event
  │
  ├─ previewOverride(...)         ──► validate → risk → bind preview (TTL + revision)
  ├─ applyOverride(...)           ──► revalidate preview → same transaction path
  │
  └─ getModeState() / getAuditEntries() / verifyAuditIntegrity()
```

On any failure after `prepare` begins, the transaction is rolled back and the previous `SystemModeState` is retained. Audit failure after a successful commit also triggers compensating rollback.

---

## 3. Public API surface

Exposed from `src/system-mode/index.ts` and re-exported from `src/index.ts`:

```ts
// Lifecycle
export function initialize(options?: InitializeOptions): Promise<ModeResult<SystemModeState>>;
export function setMode(
  targetMode: SystemMode,
  principal: Principal,
  options?: SetModeOptions
): Promise<ModeResult<SetModeResult>>;

// Overrides
export function previewOverride(request: OverrideRequest): Promise<ModeResult<OverridePreview>>;
export function applyOverride(
  request: ApplyOverrideRequest
): Promise<ModeResult<ApplyOverrideResult>>;
export function getOverrides(): ReadonlyMap<string, OverrideRecord>;

// Queries
export function getActiveMode(): SystemMode | null;
export function getModeState(): SystemModeState | null;
export function validateMode(mode: string): mode is SystemMode;

// Audit
export function getAuditEntries(
  filters?: AuditFilters,
  cursor?: string,
  limit?: number
): Promise<ModeResult<AuditPage>>;
export function verifyAuditIntegrity(): Promise<ModeResult<true>>;

// Persistence
export function enablePersistence(options: { path: string }): Promise<ModeResult<void>>;
export function disablePersistence(options?: { clearFile?: boolean }): Promise<ModeResult<void>>;

// Adapters
export function registerModeAdapter(adapter: HostModeAdapter): void;

// Events
export function onSystemModeEvent(
  listener: (event: SystemModeEvent) => void
): () => void; // returns unsubscribe
```

All mutating functions that require authorization take a `Principal`. Query functions that only read state do not.

---

## 4. Data types

### 4.1 Core

```ts
export type SystemMode = "development" | "test" | "production";

export interface ModeParameters {
  apiEndpoint: string;
  databaseUrl: string;
  logging: {
    level: "debug" | "info" | "warn" | "error";
    format: "pretty" | "json";
  };
  security: {
    csp: boolean;
    hsts: boolean;
    cors: "permissive" | "restricted" | "strict";
  };
  featureFlags: Record<string, boolean>;
  errorDetail: "full" | "summary" | "generic";
}

export interface ModePreset {
  mode: SystemMode;
  version: number;
  checksum: string;
  createdAt: string; // ISO-8601 UTC
  parameters: ModeParameters;
  metadata: {
    description: string;
    schemaVersion: number;
  };
}
```

### 4.2 State

```ts
export interface OverrideRecord {
  parameter: string;
  value: unknown;
  appliedAt: string;
  appliedBy: string; // principal.id
  reason?: string;
  previewId?: string;
}

export interface SystemModeState {
  activeMode: SystemMode;
  presetVersion: number;
  revision: number;
  parameters: ModeParameters;          // effective = preset ⊕ overrides
  overrides: ReadonlyMap<string, OverrideRecord>;
  initialized: boolean;
  updatedAt: string;                   // ISO-8601 UTC
}
```

`getModeState()` must return a deep-frozen (or structurally immutable) snapshot. Mutating the returned object must not affect internal state.

### 4.3 Principal & results

```ts
export interface Principal {
  id: string;
  roles: string[];
  capabilities: string[];
  authenticated: boolean;
}

export type ModeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ModeError };
```

### 4.4 Override types

```ts
export interface OverrideRequest {
  mode: SystemMode;
  parameter: string;
  value: unknown;
  principal: Principal;
  reason?: string;
  expectedRevision?: number;
}

export interface ApplyOverrideRequest extends OverrideRequest {
  previewId: string;
  confirm?: boolean;
}

export interface OverridePreview {
  previewId: string;
  parameter: string;
  oldValue: unknown;
  proposedValue: unknown;
  riskLevel: "low" | "medium" | "high" | "prohibited";
  riskDisclosure?: string;
  downstreamImpact: string[];
  requiresConfirmation: boolean;
  revision: number;
  expiresAt: string;
  boundTo: {
    principalId: string;
    mode: SystemMode;
    parameter: string;
    value: unknown;
  };
}
```

### 4.5 Options

```ts
export interface SetModeOptions {
  expectedRevision?: number;
  reason?: string;
  updateNodeEnv?: boolean;           // default true
  allowIncompleteAdapters?: boolean; // default false
}

export interface InitializeOptions {
  mode?: SystemMode;
  principal?: Principal;
  updateNodeEnv?: boolean;
  allowIncompleteAdapters?: boolean;
  expectedRevision?: number;
  reason?: string;
}
```

### 4.6 Audit

```ts
export type AuditAction = "initialize" | "mode_switch" | "manual_override";

export interface AuditEntry {
  id: string;
  sequence: number;
  timestamp: string;
  userId: string;
  mode: SystemMode;
  action: AuditAction;
  parameter?: string;
  oldValue?: unknown;   // already redacted
  newValue?: unknown;   // already redacted
  reason?: string;
  outcome: "applied" | "rejected";
  errorCode?: string;
  previousHash: string;
  hash: string;
}

export interface AuditPage {
  entries: AuditEntry[];
  nextCursor?: string;
}
```

### 4.7 Events

```ts
export type SystemModeEvent =
  | {
      type: "modeInitialized";
      mode: SystemMode;
      revision: number;
      timestamp: string;
    }
  | {
      type: "modeSwitched";
      previousMode: SystemMode;
      activeMode: SystemMode;
      revision: number;
      timestamp: string;
    }
  | {
      type: "overrideApplied";
      parameter: string;
      revision: number;
      timestamp: string;
    }
  | {
      type: "overrideRejected";
      parameter: string;
      errorCode: string;
      timestamp: string;
    };
```

---

## 5. Constants and classification

File: `constants.ts`

```ts
export const SUPPORTED_MODES = ["development", "test", "production"] as const;

export const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export const PREVIEW_TTL_MS = 300_000; // 5 minutes

export const PARAMETER_KEYS = [
  "apiEndpoint",
  "databaseUrl",
  "logging",
  "security",
  "featureFlags",
  "errorDetail",
] as const;

export type ParameterCategory =
  | "api"
  | "database"
  | "logging"
  | "security"
  | "featureFlags"
  | "errorDetail";

/** Maps top-level parameter keys (and dotted paths) to categories for adapter coverage. */
export const PARAMETER_CATEGORY_MAP: Record<string, ParameterCategory> = {
  apiEndpoint: "api",
  databaseUrl: "database",
  logging: "logging",
  "logging.level": "logging",
  "logging.format": "logging",
  security: "security",
  "security.csp": "security",
  "security.hsts": "security",
  "security.cors": "security",
  featureFlags: "featureFlags",
  errorDetail: "errorDetail",
};

export const HIGH_RISK_PARAMETERS = new Set([
  "databaseUrl",
  "apiEndpoint",
  "security.csp",
  "security.hsts",
  "security.cors",
]);

export const PROHIBITED_PARAMETERS = new Set([
  // Parameters that would break mode isolation or expose signing material.
  // Populate with concrete keys as the registry is finalized.
]);

export const SENSITIVE_PARAMETERS = new Set([
  "databaseUrl",
  "apiKey",
  "signingSecret",
  "token",
]);
```

**How classification is used**

- `PROHIBITED_PARAMETERS` → always rejected in `previewOverride` / `applyOverride`.
- `HIGH_RISK_PARAMETERS` → `requiresConfirmation: true` and non-empty `reason` required.
- `SENSITIVE_PARAMETERS` → values passed through `redactValue` before audit or error details.
- `PARAMETER_CATEGORY_MAP` → drives the adapter-coverage check.

---

## 6. Error model

File: `errors.ts`

```ts
export type ModeErrorCode =
  | "INVALID_MODE"
  | "UNAUTHORIZED"
  | "INVALID_PARAMETER"
  | "VALUE_VIOLATES_SCHEMA"
  | "HIGH_RISK_REQUIRES_CONFIRM"
  | "CROSS_MODE_LEAK"
  | "PRESET_INVALID"
  | "PRESET_CHECKSUM_MISMATCH"
  | "APPLY_FAILED"
  | "ROLLBACK_FAILED"
  | "REVISION_CONFLICT"
  | "AUDIT_WRITE_FAILED"
  | "AUDIT_INTEGRITY_FAILED"
  | "PERSISTENCE_FAILED"
  | "INVALID_CONFIRMATION"
  | "STATE_NOT_INITIALIZED"
  | "TRANSACTION_IN_PROGRESS"
  | "ADAPTERS_INCOMPLETE"
  | "PREVIEW_EXPIRED"
  | "PREVIEW_NOT_FOUND"
  | "PREVIEW_MISMATCH";

export interface ModeError {
  code: ModeErrorCode;
  message: string;
  parameter?: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
}

export function modeError(
  code: ModeErrorCode,
  message: string,
  extras?: Partial<Omit<ModeError, "code" | "message">>
): ModeError {
  return { code, message, ...extras };
}
```

**Retryable defaults (guidance)**

- `REVISION_CONFLICT` → `retryable: true`
- Most validation / authorization / integrity errors → `retryable: false`
- Transient persistence / audit failures may set `retryable: true` if the store is known to be flaky; default is `false`.

---

## 7. Concurrency primitives

File: `mutex.ts`

### AsyncMutex

Simple async mutex:

```ts
class AsyncMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    const next = this.queue.shift();
    if (next) next();
    else this.locked = false;
  }
}
```

### withRevisionGuard

Helper used by `setMode` and `applyOverride`:

```ts
async function withRevisionGuard<T>(
  expectedRevision: number | undefined,
  fn: () => Promise<ModeResult<T>>
): Promise<ModeResult<T>> {
  await mutex.acquire();
  try {
    const state = getInternalState();
    if (
      expectedRevision !== undefined &&
      expectedRevision !== state.revision
    ) {
      return {
        ok: false,
        error: modeError("REVISION_CONFLICT", "Revision mismatch", {
          details: { expected: expectedRevision, actual: state.revision },
          retryable: true,
        }),
      };
    }
    return await fn();
  } finally {
    mutex.release();
  }
}
```

**Invariant:** Every critical section that mutates state or runs a transaction must hold the mutex and release it in `finally`.

---

## 8. State management

File: `state.ts`

### Internal store

```ts
class StateStore {
  private state: SystemModeState | null = null;

  get(): SystemModeState | null {
    return this.state ? deepFreeze(clone(this.state)) : null;
  }

  /** Called only after successful commit + audit. */
  publish(next: SystemModeState): void {
    this.state = deepFreeze(clone(next));
  }

  isInitialized(): boolean {
    return this.state?.initialized === true;
  }
}
```

- `getModeState()` and `getActiveMode()` read from this store.
- Publish happens **only** after both transaction commit and durable audit succeed.
- On any failure path, the previous state object is left untouched.

### Deep freeze / clone

Use structured cloning (or a small recursive freeze) so that:

- Callers cannot mutate internal maps/objects.
- `overrides` is exposed as `ReadonlyMap`.

---

## 9. Presets and integrity

### 9.1 Schema (`presets/schema.ts`)

Zod schemas (zod v4 API) for `ModeParameters` and `ModePreset`. Reject unknown keys and wrong types. `featureFlags` values must be booleans.

### 9.2 Canonical serialization (`presets/integrity.ts`)

```ts
function canonicalSerialize(value: unknown): string {
  // 1. Reject or strip undefined
  // 2. For objects: sort keys lexicographically, recurse
  // 3. For arrays: preserve order, recurse
  // 4. Primitives: JSON-stable representation
  // 5. Return deterministic string
}
```

Used by:

- `calculatePresetChecksum(presetWithoutChecksum)`
- `computeEntryHash(entryWithoutHash, previousHash)`

**Tests must prove:** key order does not affect output; the same logical object always produces the same string across Node versions.

### 9.3 Frozen presets

`development.ts`, `test.ts`, `production.ts` each export a `as const` + `Object.freeze` deep-frozen preset. Checksums are computed at module load (or build time) and embedded.

`getPreset(mode)` returns the frozen object. `verifyPresetChecksum` recomputes and compares.

### 9.4 Validation order on activation

1. Mode is supported.
2. Preset exists.
3. Checksum matches.
4. Zod schema validation.
5. Isolation checks on every parameter value.
6. Adapter coverage for changed categories.

---

## 10. Security layer

### 10.1 Authorization (`security/authorization.ts`)

```ts
function authorizePrincipal(
  principal: Principal,
  capability: string
): ModeResult<void> {
  if (!principal.authenticated) {
    return { ok: false, error: modeError("UNAUTHORIZED", "Principal not authenticated") };
  }
  if (!principal.capabilities.includes(capability)) {
    return {
      ok: false,
      error: modeError("UNAUTHORIZED", `Missing capability: ${capability}`),
    };
  }
  return { ok: true, data: undefined };
}
```

Capabilities used by the module:

- `system-mode:switch`
- `system-mode:override`
- `system-mode:override-high-risk` (required when preview says `requiresConfirmation`)

### 10.2 Isolation (`security/isolation.ts`)

```ts
function assertNoCrossModeLeak(
  mode: SystemMode,
  parameter: string,
  value: unknown
): ModeResult<void>;
```

Rules (examples — finalize with concrete patterns):

- In `production`, `databaseUrl` must not match known dev host patterns.
- In `production`, `apiEndpoint` must not point at localhost / internal dev hosts.
- Dev-only credentials or patterns are rejected when `mode === "production"`.

Return `CROSS_MODE_LEAK` on violation. This runs **before** secrets are applied into the candidate that will be committed.

### 10.3 Credentials (`security/credentials.ts`)

```ts
function resolveSecrets(mode: SystemMode): ModeSecrets;
```

- Mode-specific lazy resolution.
- Never returns development secrets when `mode === "production"`.
- Secrets are injected into the candidate by the resolver; they are **not** stored in `SystemModeState` or persistence.

---

## 11. Config resolution and transactions

### 11.1 Resolver (`config/resolver.ts`)

```ts
function buildCandidateConfig(
  mode: SystemMode,
  presetParameters: ModeParameters,
  secrets: ModeSecrets,
  overrides: ReadonlyMap<string, unknown>
): ModeParameters;
```

Precedence:

1. Preset baseline.
2. Mode-specific secrets (e.g. replace placeholder DB URL).
3. Explicit overrides (highest priority).

Mode switch always passes an empty overrides map (overrides are cleared).

### 11.2 Transaction (`config/transaction.ts`)

```ts
class ConfigTransaction {
  constructor(private adapters: HostModeAdapter[]) {}

  async prepare(candidate: ModeParameters, previous: ModeParameters): Promise<void> {
    for (const adapter of this.adapters) {
      await adapter.prepareMode(candidate, previous);
    }
  }

  async commit(): Promise<void> {
    for (const adapter of this.adapters) {
      await adapter.commitMode(candidate, previous);
    }
  }

  async rollback(): Promise<void> {
    // Best-effort; collect errors but still attempt all adapters
    for (const adapter of this.adapters) {
      await adapter.rollbackMode(previous);
    }
  }
}
```

**Semantics**

- `prepare` must be side-effect free or easily reversible (validation, connection warm-up that can be discarded).
- `commit` applies the change to the live consumer.
- `rollback` restores the previous consumer state even after a partial prepare/commit.

If any adapter throws in `prepare` or `commit`, the orchestrator calls `rollback` and surfaces `APPLY_FAILED` (or `ROLLBACK_FAILED` if rollback itself throws).

---

## 12. Adapters

File: `config/adapter.ts`

### Interface

```ts
export interface HostModeAdapter {
  readonly id: string;
  readonly categories: ReadonlyArray<ParameterCategory>;
  prepareMode(candidate: ModeParameters, previous: ModeParameters): Promise<void>;
  commitMode(candidate: ModeParameters, previous: ModeParameters): Promise<void>;
  rollbackMode(previous: ModeParameters): Promise<void>;
}
```

### Registry

```ts
const adapterRegistry: HostModeAdapter[] = [];

export function registerModeAdapter(adapter: HostModeAdapter): void {
  // reject duplicate ids
  adapterRegistry.push(adapter);
}

export function getRegisteredAdapters(): readonly HostModeAdapter[] {
  return adapterRegistry;
}
```

### Coverage check

```ts
function assertAdapterCoverage(
  previous: ModeParameters,
  candidate: ModeParameters,
  allowIncomplete: boolean
): ModeResult<void> {
  const changedCategories = diffCategories(previous, candidate);
  const covered = new Set(
    adapterRegistry.flatMap((a) => a.categories)
  );
  const missing = changedCategories.filter((c) => !covered.has(c));
  if (missing.length > 0 && !allowIncomplete) {
    return {
      ok: false,
      error: modeError("ADAPTERS_INCOMPLETE", "Missing adapters for changed categories", {
        details: { missing },
      }),
    };
  }
  return { ok: true, data: undefined };
}
```

### Built-in test adapters

- `NoOpModeAdapter` — empty methods; useful when a host truly has no consumer for a category in tests.
- `RecordingModeAdapter` — records `prepare` / `commit` / `rollback` calls for assertions.

---

## 13. Initialization

File: `initialize.ts`

### Purpose

Establish the first immutable `SystemModeState`. No mutating API works until this succeeds.

### Detailed sequence

1. `await mutex.acquire()`.
2. **Load persistence** (if enabled):
   - `repo.load()` → raw blob or `null`.
   - Validate schema version.
   - Verify preset checksum for the restored mode.
   - If anything fails → treat as uninitialized (log internally if desired; do not throw to caller as a crash).
3. **Resolve target mode**:
   - `options.mode` if provided,
   - else restored `activeMode`,
   - else `process.env.NODE_ENV` if it is a valid `SystemMode`,
   - else `"development"`.
4. **Authorization**:
   - If the chosen mode differs from a restored mode (or there was no restore and mode is not the pure default path), require `principal` and `system-mode:switch`.
5. Load preset → checksum → schema validate.
6. `resolveSecrets(targetMode)`.
7. `buildCandidateConfig(..., empty overrides)`.
8. `assertNoCrossModeLeak` for every parameter.
9. Adapter coverage check (`allowIncompleteAdapters` from options).
10. `tx.prepare` → on failure → `tx.rollback` → return `APPLY_FAILED`.
11. `tx.commit` → on failure → `tx.rollback` → return `APPLY_FAILED`.
12. Build next `SystemModeState`:
    - `activeMode`, `presetVersion`, `revision` (0 or restored+1 according to policy; recommend starting at 1 on first init, or continue restored revision),
    - `parameters = candidate`,
    - `overrides = restored overrides` (only if mode unchanged; otherwise empty),
    - `initialized = true`,
    - `updatedAt = now()`.
13. If `updateNodeEnv !== false`: `process.env.NODE_ENV = targetMode`.
14. `audit.append({ action: "initialize", outcome: "applied", ... })`.
    - On failure: compensating rollback, return `AUDIT_WRITE_FAILED`.
15. `state.publish(next)`.
16. Emit `modeInitialized` (and `modeSwitched` if there was a previous distinct mode).
17. Return `{ ok: true, data: nextState }`.

**Note on overrides restore:** Only restore overrides when the restored mode equals the target mode. A mode change always clears overrides.

---

## 14. Mode switching (`setMode`)

File: `orchestrator.ts`

### Preconditions

- State is initialized.
- `principal` has `system-mode:switch`.
- `targetMode` is supported.
- `expectedRevision` (if supplied) matches current revision.

### Sequence

1. Reject if `!state.isInitialized()` → `STATE_NOT_INITIALIZED`.
2. Authorize.
3. Enter `withRevisionGuard`.
4. `validateMode` / get preset / verify checksum / validate schema.
5. `resolveSecrets(targetMode)`.
6. Build candidate with **empty** overrides.
7. Isolation checks.
8. Adapter coverage (respect `allowIncompleteAdapters`).
9. `tx.prepare` / `tx.commit` with rollback on failure.
10. Construct next state:
    - new mode, new parameters, **overrides cleared**, `revision + 1`.
11. Optionally set `NODE_ENV`.
12. Durable audit (`action: "mode_switch"`).
13. Publish state.
14. Emit `modeSwitched`.
15. Return success payload: previous mode, new mode, revision, timestamp, list of applied parameter keys.

**Failure atomicity:** Any error after step 8 leaves the previous state published and returns a structured `ModeError`.

---

## 15. Override engine

### 15.1 Registry (`override/registry.ts`)

Holds per-parameter metadata:

```ts
interface ParameterDefinition {
  key: string;
  category: ParameterCategory;
  overridable: boolean;
  riskLevel: "low" | "medium" | "high" | "prohibited";
  schema: ZodType; // or a validate() function
}
```

Populated from constants + explicit definitions. Prohibited entries have `overridable: false` and `riskLevel: "prohibited"`.

### 15.2 Validator (`override/validator.ts`)

```ts
function validateOverrideValue(
  parameter: string,
  value: unknown,
  mode: SystemMode
): ModeResult<void>;
```

Checks: parameter exists, not prohibited, value matches schema, isolation rules.

### 15.3 Risk (`override/risk.ts`)

```ts
function buildRiskDisclosure(
  parameter: string,
  oldValue: unknown,
  newValue: unknown,
  mode: SystemMode
): {
  riskLevel: ...;
  riskDisclosure?: string;
  downstreamImpact: string[];
  requiresConfirmation: boolean;
};
```

### 15.4 Preview (`override/preview.ts`)

1. Authorize `system-mode:override`.
2. Require `request.mode === state.activeMode`.
3. Validate value.
4. If prohibited → reject.
5. Compute risk fields.
6. Create `previewId` (uuid), `expiresAt = now + PREVIEW_TTL_MS`.
7. Store in an in-memory `PreviewStore` keyed by `previewId`, bound to principal/mode/parameter/value/revision.
8. Return `OverridePreview`.

**PreviewStore cleanup**

- TTL expiry on read.
- Clear all previews on successful `setMode` or `initialize` that changes mode.
- Delete preview on successful `applyOverride`.

### 15.5 Apply (`override/executor.ts`)

1. Authorize (and high-risk capability if needed).
2. Load preview; check not expired, revision matches, principal matches, parameter/value match → else `PREVIEW_*` / `INVALID_CONFIRMATION`.
3. If `requiresConfirmation` and (`confirm !== true` or empty reason) → `HIGH_RISK_REQUIRES_CONFIRM` / `INVALID_CONFIRMATION`.
4. Re-run isolation + schema validation.
5. Adapter coverage for the single changed category.
6. Build candidate = current parameters + this one override.
7. Transaction prepare/commit.
8. Next state: `revision + 1`, `overrides.set(parameter, record)`, parameters updated.
9. Audit (`manual_override`, applied).
10. Publish; delete preview; emit `overrideApplied`.

Rejected attempts (validation, auth, confirmation) still produce an audit entry with `outcome: "rejected"` when the principal is known.

---

## 16. Audit system

### 16.1 Hashing (`audit/hash.ts`)

```ts
function canonicalEntryPayload(entry: Omit<AuditEntry, "hash">): string {
  return canonicalSerialize(entry);
}

function computeEntryHash(
  entry: Omit<AuditEntry, "hash">,
  previousHash: string
): string {
  const payload = canonicalEntryPayload(entry) + previousHash;
  return sha256(payload);
}
```

### 16.2 Append path

1. Allocate `id`, `sequence = lastSequence + 1`.
2. Set `previousHash` (or `GENESIS_HASH` for sequence 1).
3. Redact `oldValue` / `newValue` via `redactValue`.
4. Compute `hash`.
5. Durably append to the audit store.
6. Only then may the orchestrator report success to the caller.

### 16.3 Integrity (`audit/integrity.ts`)

```ts
function verifyChain(entries: AuditEntry[]): boolean;
function validateGenesis(first: AuditEntry): boolean;
function detectTampering(entries: AuditEntry[]): boolean;
```

`verifyAuditIntegrity()` loads the full chain (or a verified suffix) and returns `{ ok: true, data: true }` or `AUDIT_INTEGRITY_FAILED`.

### 16.4 Query (`audit/query.ts`)

Filter by mode, userId, action, time range; cursor-based pagination. Return redacted entries only.

### 16.5 Redaction helper

```ts
function redactValue(parameter: string, value: unknown): unknown {
  if (!SENSITIVE_PARAMETERS.has(parameter)) return value;
  if (parameter === "databaseUrl" && typeof value === "string") {
    // return host-only fingerprint or "***"
  }
  return "***";
}
```

Never put raw secrets into `ModeError.details` either.

---

## 17. Persistence

### Repository interface

```ts
interface ModeStateRepository {
  load(): Promise<PersistedModeState | null>;
  save(state: PersistedModeState): Promise<void>;
  clear(): Promise<void>;
}

interface PersistedModeState {
  schemaVersion: number;
  activeMode: SystemMode;
  presetVersion: number;
  revision: number;
  parameters: ModeParameters; // non-secret values only
  overrides: Array<[string, OverrideRecord]>;
  updatedAt: string;
}
```

### In-memory (default)

Simple variable; used in tests and simple deployments.

### File-backed

- Write to `path.tmp` → `fsync` → rename over `path`.
- File mode `0600` (or platform equivalent).
- On load: JSON parse → schema version check → preset checksum verify.
- Any failure → return `null` (uninitialized), never throw uncaught.

**Invariant:** The persisted blob must not contain secret material. `resolveSecrets` is always called again on restore.

---

## 18. Events

File: `events.ts`

```ts
type Listener = (event: SystemModeEvent) => void;
const listeners = new Set<Listener>();

export function onSystemModeEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSystemModeEvent(event: SystemModeEvent): void {
  const snapshot = Object.freeze({ ...event });
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      // isolate listener failures
    }
  }
}
```

Listeners receive immutable payloads and cannot affect control flow of the emitter.

---

## 19. NODE_ENV and backward compatibility

| Mechanism | Behavior after `initialize` / `setMode` with `updateNodeEnv: true` |
|-----------|---------------------------------------------------------------------|
| `process.env.NODE_ENV` | Updated to target mode |
| `isProduction()` etc. | Reflect new mode (read env on each call) |
| `createConfig()` | Reflects new mode if called again |
| `configAPI` from `createApp()` | **Stale** — closed over old `Config` |

**Host obligations (document in JSDoc and README):**

1. Prefer calling `initialize` / `setMode` only at process bootstrap.
2. After a mode change, call `createConfig()` again if any code depends on a fresh `Config` object.
3. Pass `updateNodeEnv: false` if the host owns `NODE_ENV` exclusively.

No files under `src/config/` or `src/core.ts` are modified.

---

## 20. File-by-file implementation order

Follow this order to keep each PR/commit compilable and testable.

| Step | Files | What to implement |
|------|-------|-------------------|
| 1 | `types.ts`, `constants.ts`, `errors.ts` | All public and internal types, classification sets, error factory |
| 2 | `mutex.ts`, `state.ts`, `mode.ts` | AsyncMutex, StateStore, `validateMode` / `getActiveMode` / `getModeState` |
| 3 | `presets/integrity.ts`, `presets/schema.ts` | `canonicalSerialize`, checksum helpers, Zod schemas |
| 4 | `presets/development.ts`, `test.ts`, `production.ts`, `presets/index.ts` | Frozen presets + `getPreset` / `validatePreset` |
| 5 | `security/authorization.ts`, `isolation.ts`, `credentials.ts` | Authz, leak checks, secret resolution |
| 6 | `override/registry.ts` | Parameter definitions driven by constants |
| 7 | `config/resolver.ts`, `config/transaction.ts`, `config/adapter.ts` | Candidate builder, transaction, adapter registry + test adapters |
| 8 | `initialize.ts` | Full cold-start path |
| 9 | `orchestrator.ts` | `setMode` |
| 10 | `override/validator.ts`, `risk.ts`, `preview.ts`, `executor.ts`, `override/index.ts` | Two-stage override flow |
| 11 | `audit/*` | Hash chain, append, verify, query, redaction |
| 12 | `persistence/*` | Memory + file repositories, enable/disable |
| 13 | `events.ts`, `index.ts` | Event bus + public barrel; wire into `src/index.ts` |
| 14 | `test/system-mode/**` | Unit → integration → security → concurrency → failure-injection |

---

## 21. Invariants checklist

Implementers and reviewers should be able to tick these:

- [ ] No mutating API succeeds before `initialize`.
- [ ] State is published only after successful `commit` **and** durable audit.
- [ ] Mutex is always released (including on throw).
- [ ] `expectedRevision` mismatch yields `REVISION_CONFLICT` and no mutation.
- [ ] Mode switch clears overrides.
- [ ] Secrets never appear in `SystemModeState`, audit values, error details, or persisted blobs.
- [ ] Prohibited parameters cannot be overridden even with `confirm: true`.
- [ ] High-risk overrides require preview + confirm + non-empty reason.
- [ ] Adapter coverage is enforced unless explicitly opted out.
- [ ] `canonicalSerialize` is used for every checksum and hash-chain entry.
- [ ] Cross-mode leak checks run before commit.
- [ ] Preview is bound to principal, mode, parameter, value, and revision; TTL enforced.
- [ ] Listeners cannot mutate internal state or abort the emitter.
- [ ] File persistence uses atomic write and fails safe on corruption.
- [ ] Existing `src/config` and `src/core` APIs are unchanged.

---

## 22. Testing expectations

Minimum coverage target: **≥ 90%** statements/branches/functions on `src/system-mode/`.

### Required test categories

1. **Unit** — each module above (mutex serialization, canonical serialize stability, preset checksums, authorization matrix, isolation matrix, redaction, revision guard, etc.).
2. **Integration** — `initialize` → `setMode` → `createConfig` / `isProduction()` consistency; override updates `getModeState().parameters` without touching `Config` shape.
3. **Security** — dev credential in production rejected; unauthorized switch rejected; secrets absent from audit; prohibited parameter always rejected.
4. **Concurrency** — parallel `setMode` / `applyOverride`; only one winner; no lost updates; revision monotonic.
5. **Failure injection** — prepare throws, commit throws, audit throws → rollback + correct error code + state unchanged; corrupt persistence file → safe uninitialized path.

Use the supplied `RecordingModeAdapter` to assert prepare/commit/rollback call order without a real host.

---

## Appendix A — Suggested success payloads

```ts
interface SetModeResult {
  previousMode: SystemMode;
  activeMode: SystemMode;
  revision: number;
  parametersApplied: string[];
  timestamp: string;
}

interface ApplyOverrideResult {
  parameter: string;
  oldValue: unknown; // redacted if sensitive
  newValue: unknown; // redacted if sensitive
  revision: number;
  timestamp: string;
}
```

## Appendix B — Capability strings

| Capability | Required for |
|------------|--------------|
| `system-mode:switch` | `initialize` (when transitioning), `setMode` |
| `system-mode:override` | `previewOverride`, `applyOverride` |
| `system-mode:override-high-risk` | `applyOverride` when preview.requiresConfirmation |

---

*End of detailed implementation guide.*
