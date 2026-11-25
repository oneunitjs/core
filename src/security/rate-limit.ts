/**
 * Rate limiter middleware for @oneunit/core security module.
 *
 * Implements a sliding-window rate limiter that limits the number of
 * requests per key (e.g., IP address) within a configurable time window.
 * When the limit is exceeded, the middleware returns a 429 Too Many
 * Requests response with a Retry-After header.
 *
 * Storage is bounded (maxKeys) and windows expire lazily, preventing
 * unbounded memory growth from distinct client keys. By default the client
 * IP is taken from the connection socket rather than trusting
 * X-Forwarded-For / X-Real-IP, which clients can spoof unless proxy trust is
 * explicitly configured.
 *
 * @example
 * ```ts
 * const rateLimiter = createRateLimit({
 *   windowMs: 60000, // 1 minute
 *   maxRequests: 100, // max 100 requests per window
 *   maxKeys: 10000, // bound the number of tracked keys
 *   trustProxy: false, // do not trust X-Forwarded-For / X-Real-IP
 * });
 *
 * app.use(rateLimiter.middleware());
 * ```
 */

import type { RateLimitMiddleware, RateLimitOptions, RateLimitInfo } from "./types.js";

export type { RateLimitMiddleware, RateLimitOptions };

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_MAX_KEYS = 10000;
const DEFAULT_STATUS_CODE = 429;
const DEFAULT_MESSAGE = "Too many requests";
const SWEEP_INTERVAL = 100; // sweep expired windows every N requests

/**
 * Internal window entry tracking request timestamps.
 */
class WindowEntry {
    timestamps: number[] = [];
    lastAccess = 0;

    constructor(private readonly windowMs: number) {}

    add(timestamp: number): void {
        this.timestamps.push(timestamp);
        this.lastAccess = timestamp;
        this.prune(timestamp);
    }

    /**
     * Remove one recorded timestamp (used to retract a counted request when
     * skipFailedRequests / skipSuccessfulRequests applies).
     */
    remove(timestamp: number): void {
        const idx = this.timestamps.indexOf(timestamp);
        if (idx !== -1) {
            this.timestamps.splice(idx, 1);
        }
    }

    prune(currentTime: number): void {
        const cutoff = currentTime - this.windowMs;
        while (this.timestamps.length > 0 && this.timestamps[0] <= cutoff) {
            this.timestamps.shift();
        }
    }

    get count(): number {
        return this.timestamps.length;
    }

    get oldest(): number | null {
        return this.timestamps.length > 0 ? this.timestamps[0] : null;
    }

    get isEmpty(): boolean {
        return this.timestamps.length === 0;
    }

    reset(): void {
        this.timestamps = [];
    }
}

/**
 * Creates a rate limiter middleware.
 *
 * @param options - Rate limit configuration options
 * @returns A rate limit middleware instance
 *
 * @example
 * ```ts
 * const rateLimiter = createRateLimit({
 *   windowMs: 60000, // 1 minute window
 *   maxRequests: 100, // max 100 requests per minute
 *   maxKeys: 10000,
 *   trustProxy: false,
 *   keyGenerator: (req) => {
 *     const reqAny = req as any;
 *     return reqAny.connection?.remoteAddress || 'unknown';
 *   },
 * });
 *
 * app.use(rateLimiter.middleware());
 * ```
 */
export function createRateLimit(options: RateLimitOptions = {}): RateLimitMiddleware {
    const merged: RateLimitOptions & { maxKeys: number; trustProxy: boolean } = {
        windowMs: options.windowMs ?? DEFAULT_WINDOW_MS,
        maxRequests: options.maxRequests ?? DEFAULT_MAX_REQUESTS,
        maxKeys: options.maxKeys ?? DEFAULT_MAX_KEYS,
        trustProxy: options.trustProxy ?? false,
        keyGenerator: options.keyGenerator,
        message: options.message ?? DEFAULT_MESSAGE,
        statusCode: options.statusCode ?? DEFAULT_STATUS_CODE,
        includeRetryAfter: options.includeRetryAfter ?? true,
        skipFailedRequests: options.skipFailedRequests ?? false,
        skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    };

    // Validate configuration at initialization so a misconfigured limiter
    // cannot silently allow unbounded requests or storage.
    const validatePositiveInteger = (value: unknown, name: string): number => {
        if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
            throw new Error(`rate-limit: ${name} must be a positive integer`);
        }
        return value;
    };

    validatePositiveInteger(merged.windowMs, "windowMs");
    validatePositiveInteger(merged.maxRequests, "maxRequests");
    validatePositiveInteger(merged.maxKeys, "maxKeys");

    validatePositiveInteger(merged.statusCode!, "statusCode");
    if (merged.statusCode! < 400 || merged.statusCode! > 599) {
        throw new Error("rate-limit: statusCode must be a valid HTTP status code (400-599)");
    }

    let enabled = true;
    const windows = new Map<string, WindowEntry>();
    let sweepsSinceCleanup = 0;

    function evictOldest(): void {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, window] of windows) {
            if (window.lastAccess < oldestTime) {
                oldestTime = window.lastAccess;
                oldestKey = key;
            }
        }
        if (oldestKey !== null) {
            windows.delete(oldestKey);
        }
    }

    function getWindow(key: string): WindowEntry {
        let window = windows.get(key);
        if (!window) {
            if (windows.size >= merged.maxKeys!) {
                evictOldest();
            }
            window = new WindowEntry(merged.windowMs!);
            window.lastAccess = Date.now();
            windows.set(key, window);
        }
        return window;
    }

    function sweepExpired(): void {
        const now = Date.now();
        const cutoff = now - merged.windowMs!;
        for (const [key, window] of windows) {
            window.prune(now);
            if (window.isEmpty && window.lastAccess < cutoff) {
                windows.delete(key);
            }
        }
    }

    function getKey(req: unknown): string {
        if (req === null || req === undefined) {
            return "unknown";
        }
        if (merged.keyGenerator) {
            return merged.keyGenerator(req);
        }
        const reqAny = req as any;
        // Only trust forwarding headers when proxy trust is explicitly enabled.
        // Otherwise clients can spoof X-Forwarded-For / X-Real-IP.
        if (merged.trustProxy) {
            const forwarded = reqAny.headers?.["x-forwarded-for"];
            if (forwarded) {
                const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
                const ip = String(first).split(",")[0].trim();
                if (ip) return ip;
            }
            const realIp = reqAny.headers?.["x-real-ip"];
            if (realIp) {
                const ip = Array.isArray(realIp) ? realIp[0] : realIp;
                if (ip) return String(ip).trim();
            }
        }
        return (
            reqAny.connection?.remoteAddress ||
            reqAny.socket?.remoteAddress ||
            "unknown"
        );
    }

    function attachOutcomeTracker(res: unknown, key: string, now: number): void {
        if (!(merged.skipFailedRequests || merged.skipSuccessfulRequests)) return;
        const resAny = res as any;
        if (!resAny || typeof resAny.once !== "function") return;

        let finished = false;

        const cleanup = (): void => {
            try {
                resAny.removeListener("finish", onFinish);
                resAny.removeListener("close", onClose);
            } catch {}
        };

        // Only `finish` confirms a completed response: retract the count when
        // the skip option applies to this status.
        const onFinish = (): void => {
            if (finished) return;
            finished = true;
            cleanup();
            const status = Number(resAny?.statusCode ?? 0);
            const hasStatus = status > 0;
            const skipFailed = merged.skipFailedRequests && hasStatus && status >= 400;
            const skipSuccessful = merged.skipSuccessfulRequests && hasStatus && status < 400;
            if (skipFailed || skipSuccessful) {
                const window = windows.get(key);
                if (window) {
                    window.remove(now);
                }
            }
        };

        // `close` fires on abort too: only clean up listeners here, never
        // retract the count based on an incomplete response.
        const onClose = (): void => {
            if (!finished) {
                cleanup();
            }
        };

        resAny.once("finish", onFinish);
        resAny.once("close", onClose);
    }

    function middleware(): (req: unknown, res: unknown, next?: () => void) => void {
        return (req: unknown, res: unknown, next?: () => void) => {
            if (!enabled) {
                if (next) next();
                return;
            }

            sweepsSinceCleanup += 1;
            if (sweepsSinceCleanup >= SWEEP_INTERVAL) {
                sweepsSinceCleanup = 0;
                sweepExpired();
            }

            const key = getKey(req);
            const window = getWindow(key);
            const now = Date.now();

            window.add(now);

            const remaining = Math.max(0, merged.maxRequests! - window.count);
            const resetTime = window.oldest ? window.oldest + merged.windowMs! : now + merged.windowMs!;

            // Check if rate limit exceeded
            if (window.count > merged.maxRequests!) {
                const retryAfter = Math.ceil((window.oldest! + merged.windowMs! - now) / 1000);

                if (res) {
                    const resAny = res as any;
                    resAny.statusCode = merged.statusCode!;
                    resAny.setHeader("Content-Type", "application/json");
                    resAny.setHeader("X-RateLimit-Limit", String(merged.maxRequests));
                    resAny.setHeader("X-RateLimit-Remaining", "0");
                    resAny.setHeader("X-RateLimit-Reset", String(Math.floor(resetTime / 1000)));

                    if (merged.includeRetryAfter) {
                        resAny.setHeader("Retry-After", String(Math.max(0, retryAfter)));
                    }

                    resAny.end(
                        JSON.stringify({
                            error: merged.message,
                            statusCode: merged.statusCode,
                            retryAfter: Math.max(0, retryAfter),
                        }),
                    );
                }
                return;
            }

            // Track response outcome so skipped requests can retract their count.
            attachOutcomeTracker(res, key, now);

            // Set rate limit headers on successful response
            if (res) {
                const resAny = res as any;
                resAny.setHeader("X-RateLimit-Limit", String(merged.maxRequests));
                resAny.setHeader("X-RateLimit-Remaining", String(remaining));
                resAny.setHeader("X-RateLimit-Reset", String(Math.floor(resetTime / 1000)));
            }

            if (next) next();
        };
    }

    return {
        name: "rate-limit",
        get enabled() {
            return enabled;
        },
        get options() {
            return { ...merged };
        },
        enable() {
            enabled = true;
        },
        disable() {
            enabled = false;
        },
        toggle() {
            enabled = !enabled;
        },
        middleware,
        getRateLimitInfo(key: string): RateLimitInfo | null {
            const window = windows.get(key);
            if (!window) {
                return null;
            }
            const now = Date.now();
            window.prune(now);
            const remaining = Math.max(0, merged.maxRequests! - window.count);
            const resetTime = window.oldest ? window.oldest + merged.windowMs! : now + merged.windowMs!;
            return {
                totalRequests: window.count,
                remaining,
                resetTime,
                limited: window.count >= merged.maxRequests!,
            };
        },
        resetKey(key: string): void {
            windows.delete(key);
        },
        resetAll(): void {
            windows.clear();
        },
    };
}
