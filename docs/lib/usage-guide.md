# Lib — Usage Guide

@oneunit/core v1.0.0

## Overview

The Lib feature is a collection of pure utility functions for formatting, timestamps, and system introspection. It provides:

- **formatBytes()** — convert raw byte counts into human-readable units (Bytes through YB).
- **formatTime()** — convert millisecond durations into human-readable units (ms through y).
- **timestamp()** — format a Date as an ISO 8601 string.
- **getSystemInfo()** — retrieve detailed system, memory, CPU, network, and user information.
- **getSystemStatus()** — compute an overall health status ("healthy", "degraded", or "unhealthy") from system metrics, check results, and thresholds.

Lib is intended for developers building monitoring dashboards, CLI tools, or any application that needs to present system and timing information in a readable form. All functions are pure utilities with no external dependencies and no side effects beyond what getSystemInfo and getSystemStatus inherently report.

## Quick Start

```js
import { formatBytes, formatTime, timestamp } from "@oneunit/core/lib";

// Human-readable file sizes
formatBytes(1024);            // "1 KB"
formatBytes(1048576);         // "1 MB"
formatBytes(1234567890, 1);   // "1.2 GB"

// Human-readable durations
formatTime(500);              // "500 ms"
formatTime(1500);             // "1.5 s"
formatTime(3661000);          // "1.0 h"

// ISO timestamps
timestamp(new Date());        // "2026-01-01T00:00:00.000Z"
```

## formatBytes()

### Purpose

Converts a byte count into a human-readable string using binary units (Bytes, KB, MB, GB, TB, PB, EB, ZB, YB).

### Signature

```ts
function formatBytes(bytes: number, decimals?: number): string
```

- **bytes** — the number of bytes to format.
- **decimals** — optional number of decimal places (default: `2`).

### Units table

| Unit | Bytes threshold |
|------|-----------------|
| Bytes | < 1024 |
| KB | 1024 |
| MB | 1,048,576 |
| GB | 1,073,741,824 |
| TB | 1,099,511,627,776 |
| PB | 1,125,899,906,842,624 |
| EB | 1,152,921,504,606,846,976 |
| ZB | 1,180,591,620,717,411,303,424 |
| YB | 1,208,925,819,614,629,174,706,176 |

### Examples

```js
formatBytes(0);                    // "0 Bytes"
formatBytes(500);                  // "500 Bytes"
formatBytes(1024);                 // "1 KB"
formatBytes(1024 * 1024);          // "1 MB"
formatBytes(1024 ** 3, 0);         // "1 GB"
formatBytes(1024 ** 4, 3);         // "1.000 TB"
formatBytes(1234567890, 1);        // "1.2 GB"
```

### Error cases

| Error | When thrown |
|-------|-------------|
| InvalidBytesError | `bytes` is not a finite number (`NaN`, `Infinity`, `-Infinity`) |
| NegativeBytesError | `bytes` is negative |

```js
formatBytes(NaN);       // throws InvalidBytesError
formatBytes(Infinity);  // throws InvalidBytesError
formatBytes(-1);        // throws NegativeBytesError
```

## formatTime()

### Purpose

Converts a duration in milliseconds into a human-readable string using units ms, s, m, h, d, y.

### Signature

```ts
function formatTime(ms: number): string
```

- **ms** — the duration in milliseconds to format.

### Units table

| Unit | Milliseconds threshold |
|------|------------------------|
| ms | < 1000 |
| s | 1,000 |
| m | 60,000 |
| h | 3,600,000 |
| d | 86,400,000 |
| y | 31,536,000,000 |

### Examples

```js
formatTime(100);         // "100 ms"
formatTime(1500);        // "1.5 s"
formatTime(90000);       // "1.5 m"
formatTime(3661000);     // "1.0 h"
formatTime(90000000);    // "1.0 d"
formatTime(31536000000); // "1.0 y"
```

### Error cases

| Error | When thrown |
|-------|-------------|
| InvalidTimeError | `ms` is not a finite number (`NaN`, `Infinity`, `-Infinity`) |
| NegativeTimeError | `ms` is negative |

```js
formatTime(NaN);       // throws InvalidTimeError
formatTime(Infinity);  // throws InvalidTimeError
formatTime(-100);      // throws NegativeTimeError
```

## timestamp()

### Purpose

Returns an ISO 8601 string from a Date object.

### Signature

```ts
function timestamp(date: Date): string
```

- **date** — the Date to format.

### Examples

```js
timestamp(new Date("2026-01-15T10:30:00Z")); // "2026-01-15T10:30:00.000Z"
timestamp(new Date());                        // current ISO string
```

### Error cases

| Error | When thrown |
|-------|-------------|
| InvalidDateError | `date` is not a Date instance |

```js
timestamp("2026-01-01");     // throws InvalidDateError
timestamp(new Date("foo"));  // throws InvalidDateError (not a valid Date)
timestamp(null);             // throws InvalidDateError
```

Note: `new Date("foo")` creates an invalid Date object but is still a Date instance, so `timestamp()` will not throw InvalidDateError on construction — however downstream consumers may receive an invalid ISO string. Always pass a valid Date instance.

## getSystemInfo()

### Purpose

Retrieves detailed system information organized into process, performance, memory, CPU, network, and user categories.

### Signature

```ts
interface SystemInfo {
  process: {
    pid: number;
    ppid: number;
    node: string;
    version: string;
    environment: string;
    uptime: number;
  };
  performance: {
    startupTime: number;
    systemUptime: number;
    timestamp: string;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
    process: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
  };
  cpu: {
    architecture: string;
    platform: string;
    model: string;
    cores: number;
    loadAverage: { one: number; five: number; fifteen: number };
  };
  network: object;
  user: {
    username: string;
    uid: number;
    gid: number;
    shell: string;
    homedir: string;
  };
}

function getSystemInfo(): SystemInfo
```

### Fields table

| Category | Field | Description |
|----------|-------|-------------|
| process | pid | Current process ID |
| process | ppid | Parent process ID |
| process | node | Node.js executable path |
| process | version | Node.js version string |
| process | environment | NODE_ENV value |
| process | uptime | Process uptime in seconds |
| performance | startupTime | Process startup timestamp |
| performance | systemUptime | System uptime in seconds |
| performance | timestamp | Current ISO timestamp |
| memory | total | Total system memory in bytes |
| memory | free | Free system memory in bytes |
| memory | used | Used system memory in bytes |
| memory | usagePercent | Memory usage as a percentage (0–100) |
| memory.process.rss | Resident Set Size in bytes |
| memory.process.heapTotal | V8 heap total in bytes |
| memory.process.heapUsed | V8 heap used in bytes |
| memory.process.external | External memory in bytes |
| memory.process.arrayBuffers | ArrayBuffers memory in bytes |
| cpu | architecture | CPU architecture (e.g. x64, arm64) |
| cpu | platform | OS platform (e.g. linux, darwin, win32) |
| cpu | model | CPU model string |
| cpu | cores | Number of CPU cores |
| cpu.loadAverage.one | 1-minute load average |
| cpu.loadAverage.five | 5-minute load average |
| cpu.loadAverage.fifteen | 15-minute load average |
| network | — | Network interface information (object) |
| user | username | Current username |
| user | uid | User ID |
| user | gid | Group ID |
| user | shell | User shell |
| user | homedir | User home directory |

### Examples

```js
import { getSystemInfo } from "@oneunit/core/lib";

const info = getSystemInfo();

console.log(info.process.pid);           // 12345
console.log(info.memory.usagePercent);   // 42.5
console.log(info.cpu.cores);             // 8
console.log(info.user.username);         // "lucius"
```

## getSystemStatus()

### Purpose

Computes an overall system status ("healthy", "degraded", or "unhealthy") from memory usage, CPU load, and named check results.

### Signature

```ts
interface SystemStatusInput {
  system: {
    memory: { usagePercent: number };
    cpu: { cores: number; loadAverage: { oneMinute: number } };
  };
  checks: Record<string, {
    status: boolean;
    latency?: number;
    message?: string;
  }>;
  thresholds?: {
    memory: { degraded: number; unhealthy: number };
    load: { degraded: number; unhealthy: number };
  };
}

function getSystemStatus(input: SystemStatusInput): {
  status: "healthy" | "degraded" | "unhealthy";
}
```

### Default thresholds

| Threshold | degraded | unhealthy |
|-----------|----------|-----------|
| memory (usagePercent) | 80 | 90 |
| load (normalized per-core load) | 0.7 | 0.9 |

### Status logic (evaluated in order)

1. **Failed check** → if any check has `status: false`, result is `unhealthy`.
2. **Unhealthy thresholds** → if memory `usagePercent` ≥ memory unhealthy threshold, or normalized load ≥ load unhealthy threshold, result is `unhealthy`.
3. **Degraded thresholds** → if memory `usagePercent` ≥ memory degraded threshold, or normalized load ≥ load degraded threshold, result is `degraded`.
4. Otherwise → `healthy`.

### Normalized load

Normalized load is `cpu.loadAverage.oneMinute / cpu.cores`. If `cpu.cores` is zero, normalized load is `Infinity`, which triggers `unhealthy`.

### Examples

```js
import { getSystemStatus } from "@oneunit/core/lib";

// Healthy
getSystemStatus({
  system: {
    memory: { usagePercent: 40 },
    cpu: { cores: 8, loadAverage: { oneMinute: 2 } },
  },
  checks: { db: { status: true, latency: 12 } },
});
// { status: "healthy" }

// Degraded (memory above degraded threshold)
getSystemStatus({
  system: {
    memory: { usagePercent: 85 },
    cpu: { cores: 8, loadAverage: { oneMinute: 2 } },
  },
  checks: { db: { status: true } },
});
// { status: "degraded" }

// Unhealthy (failed check)
getSystemStatus({
  system: {
    memory: { usagePercent: 40 },
    cpu: { cores: 8, loadAverage: { oneMinute: 2 } },
  },
  checks: { db: { status: false, message: "connection refused" } },
});
// { status: "unhealthy" }

// Unhealthy (zero cores → normalized load is Infinity)
getSystemStatus({
  system: {
    memory: { usagePercent: 10 },
    cpu: { cores: 0, loadAverage: { oneMinute: 0 } },
  },
  checks: {},
});
// { status: "unhealthy" }

// Custom thresholds
getSystemStatus({
  system: {
    memory: { usagePercent: 70 },
    cpu: { cores: 4, loadAverage: { oneMinute: 2 } },
  },
  checks: {},
  thresholds: {
    memory: { degraded: 60, unhealthy: 80 },
    load: { degraded: 0.5, unhealthy: 0.8 },
  },
});
// { status: "degraded" }  (memory 70 ≥ 60 degraded; load 0.5 ≥ 0.5 degraded)
```

## Best Practices

### Do

- Validate inputs before calling `formatBytes()` or `formatTime()` when values come from untrusted sources, or wrap calls in try/catch to handle `InvalidBytesError`, `NegativeBytesError`, `InvalidTimeError`, and `NegativeTimeError`.
- Pass a valid `Date` instance to `timestamp()`; do not pass strings, numbers, or `null`.
- Use `getSystemStatus()` with custom thresholds when your environment has non-standard memory or load expectations (e.g. memory-constrained containers).
- Treat `getSystemInfo().network` as an opaque object; its shape may vary by platform.
- Round `usagePercent` and load values consistently when displaying them to users.

### Don't

- Do not pass `NaN`, `Infinity`, or negative values to `formatBytes()` or `formatTime()`.
- Do not assume `getSystemInfo()` returns identical fields across operating systems; `network` and `cpu.model` are platform-dependent.
- Do not rely on `getSystemStatus()` thresholds remaining the same in future versions; always specify `thresholds` explicitly if your deployment depends on specific boundaries.
- Do not divide `loadAverage.oneMinute` by `cores` without guarding against zero cores — normalized load is `Infinity` when cores is zero.

## Error Handling

| Error type | Thrown by | Condition |
|------------|-----------|-----------|
| InvalidBytesError | `formatBytes()` | `bytes` is not finite (`NaN`, `Infinity`, `-Infinity`) |
| NegativeBytesError | `formatBytes()` | `bytes` is negative |
| InvalidTimeError | `formatTime()` | `ms` is not finite (`NaN`, `Infinity`, `-Infinity`) |
| NegativeTimeError | `formatTime()` | `ms` is negative |
| InvalidDateError | `timestamp()` | `date` is not a Date instance |

### Example error handling

```js
import {
  formatBytes,
  formatTime,
  timestamp,
  InvalidBytesError,
  NegativeBytesError,
  InvalidTimeError,
  NegativeTimeError,
  InvalidDateError,
} from "@oneunit/core/lib";

try {
  const size = formatBytes(userInputBytes);
} catch (err) {
  if (err instanceof InvalidBytesError) {
    // handle non-finite input
  } else if (err instanceof NegativeBytesError) {
    // handle negative input
  }
}
```
