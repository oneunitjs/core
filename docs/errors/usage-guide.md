# Errors — Usage Guide

@oneunit/core v1.0.0

## Overview

The Errors feature of the `@oneunit/core` package provides a standardized error model for OneUnit applications. Every error descends from `OneUnitError` and carries rich, machine-readable metadata: `message`, `category`, `code`, `details`, `timestamp`, `severity`, `stack`, and `cause`.

The `toJSON()` method produces an `ErrorInfo` shape suitable for logging, telemetry, and client-facing error bodies. Because all errors share a common base class, you can inspect any error with `instanceof`, read its serialized shape reliably, and route it by severity or category.

This guide is for application developers integrating the `@oneunit/core` Errors feature. It assumes familiarity with TypeScript/JavaScript error handling (`try`/`catch`, `instanceof`) and does not depend on any other documentation file.

## Quick Start

Create and serialize an error:

```ts
import { InvalidStatusCodeError } from '@oneunit/core';

const err = new InvalidStatusCodeError(600);

try {
  throw err;
} catch (e) {
  if (e instanceof Error) {
    console.log(e.toJSON());
  }
}
```

Output:

```json
{
  "category": "response",
  "code": "ERR_INVALID_STATUS_CODE",
  "message": "Status code 600 is outside the valid range 200-599",
  "severity": "medium",
  "timestamp": "2026-01-15T09:30:00.000Z",
  "details": { "status": 600 }
}
```

## OneUnitError Base

`OneUnitError` is the base class for every error in the package. All other error classes extend it.

### Constructor options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `message` | `string` | Yes | Human-readable error description |
| `category` | `ErrorCategory` | Yes | Error category (see Error Categories) |
| `code` | `string` | No | Machine-readable error code |
| `details` | `Record<string, unknown>` | No | Additional structured context |
| `severity` | `'low' \| 'medium' \| 'high' \| 'critical'` | No | Error severity level |
| `cause` | `Error` | No | Underlying cause of this error |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Error message |
| `category` | `ErrorCategory` | Error category |
| `code` | `string` | Error code |
| `details` | `Record<string, unknown>` | Structured context |
| `timestamp` | `string` | ISO-8601 timestamp when the error was created |
| `severity` | `'low' \| 'medium' \| 'high' \| 'critical'` | Severity level |
| `stack` | `string` | Stack trace |
| `cause` | `Error` | Underlying cause |

### `toJSON(): ErrorInfo`

Produces a plain object suitable for JSON serialization:

```ts
toJSON(): ErrorInfo
```

The resulting `ErrorInfo` shape is:

| Field | Type | Required |
|-------|------|----------|
| `category` | `ErrorCategory` | Yes |
| `code` | `string` | Yes |
| `message` | `string` | Yes |
| `severity` | `'low' \| 'medium' \| 'high' \| 'critical'` | Yes |
| `details` | `Record<string, unknown>` | No |
| `timestamp` | `string` | Yes |

Example:

```ts
import { OneUnitError } from '@oneunit/core';

const err = new OneUnitError('Something failed', 'core', {
  code: 'ERR_CORE_FAILURE',
  severity: 'high',
  details: { component: 'router' },
});

console.log(JSON.stringify(err, null, 2));
```

## Error Categories

| Category | Description |
|----------|-------------|
| `response` | Response handling errors |
| `cookie` | Cookie parsing/signing/encryption errors |
| `lifecycle` | Application lifecycle and middleware errors |
| `multipart` | Multipart form parsing errors |
| `hooks` | Hook registration errors |
| `lib` | Low-level utility errors |
| `core` | Core runtime errors |
| `security` | Security-related errors |
| `health` | Health check errors |
| `config` | Configuration errors |
| `msgpack` | MessagePack serialization errors |

## Error Families

### Cookie errors

| Error | Code pattern | Meaning |
|-------|--------------|---------|
| `CookieError` | `ERR_COOKIE` | Base cookie error |
| `CookieSecretRequiredError(name, kind)` | `ERR_COOKIE_SECRET_REQUIRED` | Signing or encryption secret missing for cookie |
| `InvalidCookieNameError(name)` | `ERR_INVALID_COOKIE_NAME` | Cookie name is malformed |
| `CookieSecurePrefixError(name, requirement)` | `ERR_COOKIE_SECURE_PREFIX` | `__Secure-`/`__Host-` prefix misused |
| `SameSiteNoneRequiresSecureError` | `ERR_SAMESITE_NONE_REQUIRES_SECURE` | `SameSite=None` set without `Secure` |
| `CookieDecryptionError(name)` | `ERR_COOKIE_DECRYPTION` | Cookie decryption failed |
| `CookieSignatureError(name)` | `ERR_COOKIE_SIGNATURE` | Cookie signature invalid |

### Lifecycle errors

| Error | Code pattern | Meaning |
|-------|--------------|---------|
| `LifecycleError` | `ERR_LIFECYCLE` | Base lifecycle error |
| `LifecycleNotInitializedError` | `ERR_LIFECYCLE_NOT_INITIALIZED` | App used before initialization |
| `MiddlewareLimitError(limit)` | `ERR_MIDDLEWARE_LIMIT` | Middleware cap exceeded |
| `MiddlewareTypeNotAllowedError(type)` | `ERR_MIDDLEWARE_TYPE_NOT_ALLOWED` | Middleware type disallowed |
| `MiddlewareNotFoundError(name)` | `ERR_MIDDLEWARE_NOT_FOUND` | Middleware not registered |
| `MiddlewareTimeoutError(name)` | `ERR_MIDDLEWARE_TIMEOUT` | Middleware exceeded timeout |
| `PluginLimitError(limit)` | `ERR_PLUGIN_LIMIT` | Plugin cap exceeded |
| `PluginAlreadyExistsError(name, namespace)` | `ERR_PLUGIN_ALREADY_EXISTS` | Duplicate plugin registration |
| `MiddlewareConflictError(name, conflictWith)` | `ERR_MIDDLEWARE_CONFLICT` | Conflicting middleware |
| `MiddlewareTypeConflictError(name, existingType)` | `ERR_MIDDLEWARE_TYPE_CONFLICT` | Type mismatch on re-registration |
| `HeaderConflictError(header, setBy)` | `ERR_HEADER_CONFLICT` | Header set by conflicting component |

### Multipart errors

| Error | Code pattern | Meaning |
|-------|--------------|---------|
| `MultipartError` | `ERR_MULTIPART` | Base multipart error |
| `MultipartDisabledError` | `ERR_MULTIPART_DISABLED` | Multipart middleware disabled |
| `MultipartFileTooLargeError(maxFileSize)` | `ERR_MULTIPART_FILE_TOO_LARGE` | File exceeds size limit |
| `MultipartTooManyFilesError(maxFiles)` | `ERR_MULTIPART_TOO_MANY_FILES` | File count exceeded |
| `MultipartTooManyFieldsError(maxFields)` | `ERR_MULTIPART_TOO_MANY_FIELDS` | Field count exceeded |
| `MultipartInvalidMimeTypeError(mimetype)` | `ERR_MULTIPART_INVALID_MIME_TYPE` | Disallowed MIME type |
| `MultipartParseTimeoutError` | `ERR_MULTIPART_PARSE_TIMEOUT` | Parse exceeded timeout |

### Response errors

| Error | Code pattern | Meaning |
|-------|--------------|---------|
| `ResponseManagementError` | `ERR_RESPONSE` | Base response error |
| `ResponseValidationError` | `ERR_RESPONSE_VALIDATION` | Invalid response options |
| `InvalidStatusCodeError(status)` | `ERR_INVALID_STATUS_CODE` | Status outside 200-599 |
| `ResponseAlreadySentError` | `ERR_RESPONSE_ALREADY_SENT` | Response already committed |
| `BodylessStatusError(status)` | `ERR_BODYLESS_STATUS` | Body sent for bodyless status |

### Hooks errors

| Error | Code pattern | Meaning |
|-------|--------------|---------|
| `HooksError` | `ERR_HOOKS` | Base hooks error |
| `HookNotAllowedError(name, allowedHooks)` | `ERR_HOOK_NOT_ALLOWED` | Hook not permitted |

### Lib errors

| Error | Code pattern | Meaning |
|-------|--------------|---------|
| `LibError` | `ERR_LIB` | Base library error |
| `InvalidBytesError` | `ERR_INVALID_BYTES` | Invalid byte value |
| `NegativeBytesError` | `ERR_NEGATIVE_BYTES` | Negative byte count |
| `InvalidTimeError` | `ERR_INVALID_TIME` | Invalid time value |
| `NegativeTimeError` | `ERR_NEGATIVE_TIME` | Negative time value |
| `InvalidDateError` | `ERR_INVALID_DATE` | Invalid date |

### Core errors

| Error | Code pattern | Meaning |
|-------|--------------|---------|
| `CoreError` | `ERR_CORE` | Base core error |
| `ResponseRequiresRequestResponseError` | `ERR_RESPONSE_REQUIRES_REQUEST_RESPONSE` | Response needs request/response objects |

## Error Handling Patterns

### try/catch with instanceof checks

```ts
import { OneUnitError, CookieError, InvalidStatusCodeError } from '@oneunit/core';

try {
  await someOperation();
} catch (e) {
  if (e instanceof InvalidStatusCodeError) {
    // handle response-specific logic
  } else if (e instanceof CookieError) {
    // handle cookie-specific logic
  } else if (e instanceof OneUnitError) {
    // handle any OneUnit error generically
  } else {
    // unexpected, non-OneUnit error
  }
}
```

### toJSON() for logging

```ts
import { logger } from './logger';

try {
  await operation();
} catch (e) {
  if (e instanceof OneUnitError) {
    logger.error(e.toJSON());
  } else {
    logger.error({ message: (e as Error).message, stack: (e as Error).stack });
  }
}
```

### Cause chaining

```ts
import { OneUnitError } from '@oneunit/core';

try {
  await riskyOperation();
} catch (cause) {
  throw new OneUnitError('Operation failed', 'core', {
    code: 'ERR_OPERATION_FAILED',
    severity: 'high',
    cause,
  });
}
```

Access the original error via `err.cause`.

### Severity-based routing

```ts
import { OneUnitError } from '@oneunit/core';

const err = new OneUnitError('Critical failure', 'core', {
  code: 'ERR_CRITICAL',
  severity: 'critical',
});

switch (err.severity) {
  case 'critical':
    alertOnCall(err);
    break;
  case 'high':
    notifyTeam(err);
    break;
  case 'medium':
    logWarning(err);
    break;
  case 'low':
    logDebug(err);
    break;
}
```

## Categorized Error Handling

```ts
import {
  OneUnitError,
  CookieError,
  LifecycleError,
  MultipartError,
  ResponseError,
  HooksError,
  LibError,
  CoreError,
} from '@oneunit/core';

function handleError(e: unknown): void {
  if (!(e instanceof OneUnitError)) {
    console.error('Unexpected error:', (e as Error)?.message ?? String(e));
    return;
  }

  const info = e.toJSON();

  if (e instanceof CookieError) {
    console.error(`[cookie] ${info.code}: ${info.message}`);
  } else if (e instanceof LifecycleError) {
    console.error(`[lifecycle] ${info.code}: ${info.message}`);
  } else if (e instanceof MultipartError) {
    console.error(`[multipart] ${info.code}: ${info.message}`);
  } else if (e instanceof ResponseError) {
    console.error(`[response] ${info.code}: ${info.message}`);
  } else if (e instanceof HooksError) {
    console.error(`[hooks] ${info.code}: ${info.message}`);
  } else if (e instanceof LibError) {
    console.error(`[lib] ${info.code}: ${info.message}`);
  } else if (e instanceof CoreError) {
    console.error(`[core] ${info.code}: ${info.message}`);
  } else {
    console.error(`[${info.category}] ${info.code}: ${info.message}`);
  }

  if (e.cause) {
    console.error('Caused by:', e.cause.message);
  }
}
```

## Best Practices

### Do

- Throw and catch `OneUnitError` (or its subclasses) for all application errors.
- Set `category` and `code` on every error so callers can route by machine-readable values.
- Include `details` with structured context (for example, the offending status code or cookie name).
- Use `cause` to preserve the original error when wrapping failures.
- Call `toJSON()` before logging or sending errors to clients so output is consistent.
- Route by `severity` (`critical`/`high` page on-call; `low`/`medium` are logged).

### Don't

- Throw plain `Error` or strings where a `OneUnitError` is expected.
- Rely on `message` text for control flow; use `instanceof`, `category`, or `code` instead.
- Log the full `stack` to client-facing responses; use `toJSON()` which omits internal frames.
- Put secrets or PII in `details`; `ErrorInfo` may be serialized to telemetry or clients.
- Forget that `timestamp` is set at construction time, not at serialization time.

## Error Info Serialization

The `ErrorInfo` shape is the contract for client-facing APIs, logs, and telemetry:

```ts
interface ErrorInfo {
  category: ErrorCategory;
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, unknown>;
  timestamp: string;
}
```

Example client-facing body:

```json
{
  "category": "response",
  "code": "ERR_INVALID_STATUS_CODE",
  "message": "Status code 600 is outside the valid range 200-599",
  "severity": "medium",
  "details": { "status": 600 },
  "timestamp": "2026-01-15T09:30:00.000Z"
}
```

`timestamp` is an ISO-8601 string captured when the `OneUnitError` is constructed. `details` is optional and only present when the error was constructed with structured context. `stack` and `cause` are intentionally excluded from `ErrorInfo` to keep client-facing payloads small and free of internal implementation details.
