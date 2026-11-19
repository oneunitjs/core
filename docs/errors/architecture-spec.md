# Errors — Architecture Specification

@oneunit/core v1.0.0

## Component Overview

**Purpose:** Provide a consistent, typed error-handling model for the @oneunit/core package so that all runtime failures across response management, cookies, lifecycle, multipart, hooks, lib, and core domains are surfaced through a single `OneUnitError` base class with category-scoped subclasses.

**Scope:** Covers error type definitions, the base error class, every domain-specific error family, the barrel exports, and the non-throwing `createErrorInfo` factory.

**Responsibilities:**
- Define `ErrorCategory`, `ErrorSeverity`, `ErrorContext`, `OneUnitErrorOptions`, and `ErrorInfo` types.
- Implement `OneUnitError`, an `Error` subclass carrying category, code, severity, details, timestamp, and optional `cause`.
- Provide category-specific error subclasses (CookieError, LifecycleError, MultipartError, ResponseManagementError, HooksError, LibError, CoreError) and their concrete error classes.
- Export all error types and classes from a single barrel module.
- Provide `createErrorInfo` to build plain `ErrorInfo` objects without throwing.

## Source File Map

| File path | Responsibility | Key exports |
|-----------|----------------|-------------|
| `src/errors/types.ts` | Error type definitions and `createErrorInfo` factory | `ErrorCategory`, `ErrorSeverity`, `ErrorContext`, `OneUnitErrorOptions`, `ErrorInfo`, `createErrorInfo` |
| `src/errors/base.ts` | Base error class implementation | `OneUnitError` |
| `src/errors/index.ts` | Barrel module aggregating all error exports | `OneUnitError`, all types, `createErrorInfo`, all domain error classes |
| `src/errors/cookie.ts` | Cookie domain error classes | `CookieError`, `CookieSecretRequiredError`, `InvalidCookieNameError`, `CookieSecurePrefixError`, `SameSiteNoneRequiresSecureError`, `CookieDecryptionError`, `CookieSignatureError` |
| `src/errors/core.ts` | Core domain error classes | `CoreError`, `ResponseRequiresRequestResponseError` |
| `src/errors/hooks.ts` | Hooks domain error classes | `HooksError`, `HookNotAllowedError` |
| `src/errors/lib.ts` | Lib domain error classes | `LibError`, `InvalidBytesError`, `NegativeBytesError`, `InvalidTimeError`, `NegativeTimeError`, `InvalidDateError` |
| `src/errors/lifecycle.ts` | Lifecycle domain error classes | `LifecycleError`, `LifecycleNotInitializedError`, `MiddlewareLimitError`, `MiddlewareTypeNotAllowedError`, `MiddlewareNotFoundError`, `MiddlewareTimeoutError`, `PluginLimitError`, `PluginAlreadyExistsError`, `MiddlewareConflictError`, `MiddlewareTypeConflictError`, `HeaderConflictError` |
| `src/errors/multipart.ts` | Multipart domain error classes | `MultipartError`, `MultipartDisabledError`, `MultipartFileTooLargeError`, `MultipartTooManyFilesError`, `MultipartTooManyFieldsError`, `MultipartInvalidMimeTypeError`, `MultipartParseTimeoutError` |
| `src/errors/response.ts` | Response domain error classes | `ResponseManagementError`, `ResponseValidationError`, `InvalidStatusCodeError`, `ResponseAlreadySentError`, `BodylessStatusError` |

Note: `security` and `health` are declared members of the `ErrorCategory` union type, but no dedicated source files or error classes exist for them in v1.0.0.

## Component Relationships Diagram

```mermaid
classDiagram
    class OneUnitError {
        <<abstract>>
        +readonly category: ErrorCategory
        +readonly code: string
        +readonly details?: Record~string, unknown~
        +readonly timestamp: string
        +readonly severity: "warning" | "error" | "critical"
        +constructor(message: string, options?: OneUnitErrorOptions)
        +toJSON(): ErrorInfo & { stack?: string }
    }
    class CookieError {
        +category: "cookie"
        +code: "COOKIE_ERROR"
    }
    class CookieSecretRequiredError { +code: "COOKIE_SECRET_REQUIRED" }
    class InvalidCookieNameError { +code: "INVALID_COOKIE_NAME" }
    class CookieSecurePrefixError { +code: "COOKIE_SECURE_PREFIX_ERROR" }
    class SameSiteNoneRequiresSecureError { +code: "SAMESITE_NONE_REQUIRES_SECURE" }
    class CookieDecryptionError { +code: "COOKIE_DECRYPTION_ERROR" }
    class CookieSignatureError { +code: "COOKIE_SIGNATURE_ERROR" }
    class LifecycleError {
        +category: "lifecycle"
        +code: "LIFECYCLE_ERROR"
    }
    class LifecycleNotInitializedError { +code: "LIFECYCLE_NOT_INITIALIZED" }
    class MiddlewareLimitError { +code: "MIDDLEWARE_LIMIT_EXCEEDED" }
    class MiddlewareTypeNotAllowedError { +code: "MIDDLEWARE_TYPE_NOT_ALLOWED" }
    class MiddlewareNotFoundError { +code: "MIDDLEWARE_NOT_FOUND" }
    class MiddlewareTimeoutError { +code: "MIDDLEWARE_TIMEOUT" }
    class PluginLimitError { +code: "PLUGIN_LIMIT_EXCEEDED" }
    class PluginAlreadyExistsError { +code: "PLUGIN_ALREADY_EXISTS" }
    class MiddlewareConflictError { +code: "MIDDLEWARE_CONFLICT" }
    class MiddlewareTypeConflictError { +code: "MIDDLEWARE_TYPE_CONFLICT" }
    class HeaderConflictError { +code: "HEADER_CONFLICT" }
    class MultipartError {
        +category: "multipart"
        +code: "MULTIPART_ERROR"
    }
    class MultipartDisabledError { +code: "MULTIPART_DISABLED" }
    class MultipartFileTooLargeError { +code: "MULTIPART_FILE_TOO_LARGE" }
    class MultipartTooManyFilesError { +code: "MULTIPART_TOO_MANY_FILES" }
    class MultipartTooManyFieldsError { +code: "MULTIPART_TOO_MANY_FIELDS" }
    class MultipartInvalidMimeTypeError { +code: "MULTIPART_INVALID_MIME_TYPE" }
    class MultipartParseTimeoutError { +code: "MULTIPART_PARSE_TIMEOUT" }
    class ResponseManagementError {
        +category: "response"
        +code: "RESPONSE_ERROR"
    }
    class ResponseValidationError { +code: "RESPONSE_VALIDATION_ERROR" }
    class InvalidStatusCodeError { +code: "INVALID_STATUS_CODE" }
    class ResponseAlreadySentError { +code: "RESPONSE_ALREADY_SENT" }
    class BodylessStatusError { +code: "BODYLESS_STATUS" }
    class HooksError {
        +category: "hooks"
        +code: "HOOKS_ERROR"
    }
    class HookNotAllowedError { +code: "HOOK_NOT_ALLOWED" }
    class LibError {
        +category: "lib"
        +code: "LIB_ERROR"
    }
    class InvalidBytesError { +code: "INVALID_BYTES" }
    class NegativeBytesError { +code: "NEGATIVE_BYTES" }
    class InvalidTimeError { +code: "INVALID_TIME" }
    class NegativeTimeError { +code: "NEGATIVE_TIME" }
    class InvalidDateError { +code: "INVALID_DATE" }
    class CoreError {
        +category: "core"
        +code: "CORE_ERROR"
    }
    class ResponseRequiresRequestResponseError { +code: "RESPONSE_REQUIRES_REQUEST_RESPONSE" }
    class ErrorInfo {
        +category: ErrorCategory
        +code: string
        +message: string
        +severity: ErrorSeverity
        +details?: Record~string, unknown~
        +timestamp: string
    }
    class createErrorInfo {
        +(category, code, message, severity?, details?): ErrorInfo
    }

    OneUnitError <|-- CookieError
    CookieError <|-- CookieSecretRequiredError
    CookieError <|-- InvalidCookieNameError
    CookieError <|-- CookieSecurePrefixError
    CookieError <|-- SameSiteNoneRequiresSecureError
    CookieError <|-- CookieDecryptionError
    CookieError <|-- CookieSignatureError
    OneUnitError <|-- LifecycleError
    LifecycleError <|-- LifecycleNotInitializedError
    LifecycleError <|-- MiddlewareLimitError
    LifecycleError <|-- MiddlewareTypeNotAllowedError
    LifecycleError <|-- MiddlewareNotFoundError
    LifecycleError <|-- MiddlewareTimeoutError
    LifecycleError <|-- PluginLimitError
    LifecycleError <|-- PluginAlreadyExistsError
    LifecycleError <|-- MiddlewareConflictError
    LifecycleError <|-- MiddlewareTypeConflictError
    LifecycleError <|-- HeaderConflictError
    OneUnitError <|-- MultipartError
    MultipartError <|-- MultipartDisabledError
    MultipartError <|-- MultipartFileTooLargeError
    MultipartError <|-- MultipartTooManyFilesError
    MultipartError <|-- MultipartTooManyFieldsError
    MultipartError <|-- MultipartInvalidMimeTypeError
    MultipartError <|-- MultipartParseTimeoutError
    OneUnitError <|-- ResponseManagementError
    ResponseManagementError <|-- ResponseValidationError
    ResponseManagementError <|-- InvalidStatusCodeError
    ResponseManagementError <|-- ResponseAlreadySentError
    ResponseManagementError <|-- BodylessStatusError
    OneUnitError <|-- HooksError
    HooksError <|-- HookNotAllowedError
    OneUnitError <|-- LibError
    LibError <|-- InvalidBytesError
    LibError <|-- NegativeBytesError
    LibError <|-- InvalidTimeError
    LibError <|-- NegativeTimeError
    LibError <|-- InvalidDateError
    OneUnitError <|-- CoreError
    CoreError <|-- ResponseRequiresRequestResponseError
    OneUnitError ..> ErrorInfo : toJSON()
    createErrorInfo ..> ErrorInfo : returns
```

## Data Flow Diagrams

### Flow 1: Throw and serialize a OneUnitError

```mermaid
flowchart TD
    A[new OneUnitError(message, options)] --> B[Set name = "OneUnitError"]
    B --> C[Set timestamp = new Date().toISOString()]
    C --> D[Set category / code / severity / details / cause]
    D --> E[Error instance created and thrown]
    E --> F[catch (err)]
    F --> G[err.toJSON()]
    G --> H[Plain ErrorInfo object: category, code, message, severity, details?, timestamp, stack]
    H --> I[Serialized / logged / returned to caller]
```

### Flow 2: Non-throwing createErrorInfo factory

```mermaid
flowchart TD
    A[createErrorInfo(category, code, message, severity?, details?)] --> B[Build ErrorInfo object]
    B --> C[timestamp = new Date().toISOString()]
    C --> D[Return plain ErrorInfo object]
    D --> E[No exception thrown; caller consumes object directly]
```

### Flow 3: Error thrown → caught → category-specific handling

```mermaid
flowchart TD
    A[throw new DomainSpecificError(...)] --> B[Error propagates up call stack]
    B --> C{catch block}
    C --> D[err instanceof OneUnitError?]
    D -->|No| E[Rethrow or handle as unknown error]
    D -->|Yes| F[Read err.category]
    F --> G[Switch on category: response | cookie | lifecycle | multipart | hooks | lib | core | security | health | config | msgpack]
    G --> H[Category-specific handling logic]
    H --> I[Optional: err.toJSON() for serialization]
    H --> J[Optional: inspect err.cause separately]
```

## Internal State Model

- No persistent state: error objects are transient, created on demand and discarded after handling.
- Error categories are defined as the `ErrorCategory` TypeScript union type:
  `"response" | "cookie" | "lifecycle" | "multipart" | "hooks" | "lib" | "core" | "security" | "health" | "config" | "msgpack"`.
- Error severity is defined as the `ErrorSeverity` TypeScript union type:
  `"warning" | "error" | "critical"`.
- `ErrorInfo` is a plain data object (`category`, `code`, `message`, `severity`, `details?`, `timestamp`) with no methods or mutable state.

## Design Patterns

- **Factory Pattern:** `createErrorInfo(category, code, message, severity?, details?)` constructs and returns an `ErrorInfo` object without throwing an exception.
- **Inheritance Pattern:** `OneUnitError` is the base class; every domain error extends it, fixing `category` and a family-level `code`, then each concrete error refines the `code` and message.
- **Value Object Pattern:** `ErrorInfo` is a plain, serializable data object used for logging, transmission, and inspection; it carries no behavior.

## Technical Implementation Details

### OneUnitError class (`src/errors/base.ts`)

- Extends the built-in `Error` class.
- Constructor signature: `constructor(message: string, options: OneUnitErrorOptions = {})`.
- `options` fields: `category?`, `code?`, `details?`, `cause?`.
- Sets `this.name = "OneUnitError"`.
- Sets `this.timestamp = new Date().toISOString()` at construction time.
- Defaults: `category` defaults to `"core"`; `code` defaults to `"UNKNOWN_ERROR"`; `severity` defaults to `"error"`, or `"critical"` when a `cause` is provided.
- Preserves V8 stack traces via `Error.captureStackTrace(this, this.constructor)` when available.
- Stores `cause` on the instance when `options.cause` is supplied.
- `toJSON()` returns `{ category, code, message, details, timestamp, severity, stack }`.
  - `cause` is intentionally **excluded** from `toJSON()` output; callers must inspect `err.cause` directly.
  - `stack` is included in the serialized output.

### Error families and concrete classes

Each family extends `OneUnitError`, hardcodes its `category` and family-level `code`, and sets `this.name` to the class name.

| Family | Category | Family code | Concrete classes (code) |
|--------|----------|-------------|-------------------------|
| `CookieError` | `"cookie"` | `COOKIE_ERROR` | `CookieSecretRequiredError` (`COOKIE_SECRET_REQUIRED`), `InvalidCookieNameError` (`INVALID_COOKIE_NAME`), `CookieSecurePrefixError` (`COOKIE_SECURE_PREFIX_ERROR`), `SameSiteNoneRequiresSecureError` (`SAMESITE_NONE_REQUIRES_SECURE`), `CookieDecryptionError` (`COOKIE_DECRYPTION_ERROR`), `CookieSignatureError` (`COOKIE_SIGNATURE_ERROR`) |
| `LifecycleError` | `"lifecycle"` | `LIFECYCLE_ERROR` | `LifecycleNotInitializedError` (`LIFECYCLE_NOT_INITIALIZED`), `MiddlewareLimitError` (`MIDDLEWARE_LIMIT_EXCEEDED`), `MiddlewareTypeNotAllowedError` (`MIDDLEWARE_TYPE_NOT_ALLOWED`), `MiddlewareNotFoundError` (`MIDDLEWARE_NOT_FOUND`), `MiddlewareTimeoutError` (`MIDDLEWARE_TIMEOUT`), `PluginLimitError` (`PLUGIN_LIMIT_EXCEEDED`), `PluginAlreadyExistsError` (`PLUGIN_ALREADY_EXISTS`), `MiddlewareConflictError` (`MIDDLEWARE_CONFLICT`), `MiddlewareTypeConflictError` (`MIDDLEWARE_TYPE_CONFLICT`), `HeaderConflictError` (`HEADER_CONFLICT`) |
| `MultipartError` | `"multipart"` | `MULTIPART_ERROR` | `MultipartDisabledError` (`MULTIPART_DISABLED`), `MultipartFileTooLargeError` (`MULTIPART_FILE_TOO_LARGE`), `MultipartTooManyFilesError` (`MULTIPART_TOO_MANY_FILES`), `MultipartTooManyFieldsError` (`MULTIPART_TOO_MANY_FIELDS`), `MultipartInvalidMimeTypeError` (`MULTIPART_INVALID_MIME_TYPE`), `MultipartParseTimeoutError` (`MULTIPART_PARSE_TIMEOUT`) |
| `ResponseManagementError` | `"response"` | `RESPONSE_ERROR` | `ResponseValidationError` (`RESPONSE_VALIDATION_ERROR`), `InvalidStatusCodeError` (`INVALID_STATUS_CODE`), `ResponseAlreadySentError` (`RESPONSE_ALREADY_SENT`), `BodylessStatusError` (`BODYLESS_STATUS`) |
| `HooksError` | `"hooks"` | `HOOKS_ERROR` | `HookNotAllowedError` (`HOOK_NOT_ALLOWED`) |
| `LibError` | `"lib"` | `LIB_ERROR` | `InvalidBytesError` (`INVALID_BYTES`), `NegativeBytesError` (`NEGATIVE_BYTES`), `InvalidTimeError` (`INVALID_TIME`), `NegativeTimeError` (`NEGATIVE_TIME`), `InvalidDateError` (`INVALID_DATE`) |
| `CoreError` | `"core"` | `CORE_ERROR` | `ResponseRequiresRequestResponseError` (`RESPONSE_REQUIRES_REQUEST_RESPONSE`) |

### Code pattern convention

Error codes follow the `CATEGORY_ERROR_NAME` convention (all uppercase, underscore-separated), e.g. `COOKIE_SECRET_REQUIRED`, `MIDDLEWARE_LIMIT_EXCEEDED`, `INVALID_STATUS_CODE`.

### createErrorInfo factory (`src/errors/types.ts`)

- Signature: `createErrorInfo(category, code, message, severity = "error", details?): ErrorInfo`.
- Returns a plain `ErrorInfo` object with `timestamp` set to `new Date().toISOString()`.
- Does not throw; intended for non-exceptional construction of serialized error data.

## Concurrency Considerations

- No shared mutable state; each error instance owns its fields, making error creation and handling thread-safe by design in single-threaded JavaScript execution.
- Error objects are effectively immutable after construction: all public fields are `readonly`, and `toJSON()` produces a fresh object on each call without mutating the instance.

## Error Model

- All package errors extend `OneUnitError`, which itself extends `Error`.
- Category-specific error classes group related failures by domain.
- `toJSON()` enables serialization; output excludes `cause` but includes `stack`.
- `createErrorInfo` factory supports non-throwing creation of `ErrorInfo` values.
- `instanceof OneUnitError` checks support category-based handling in catch blocks.

## Complexity Analysis

- Error construction: O(1) — fixed set of field assignments and one timestamp call.
- `toJSON()` serialization: O(1) — copies a fixed number of fields into a new object.
- `createErrorInfo`: O(1) — builds a fixed-shape object.
- Memory per error: O(1) plus the size of any optional `details` payload.
