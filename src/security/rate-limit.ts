/**
 * Rate limiter middleware for @oneunit/core security module.
 *
 * Implements a sliding window rate limiter that limits the number of
 * requests per key (e.g., IP address) within a configurable time window.
 * When the limit is exceeded, the middleware returns a 429 Too Many
 * Requests response with a Retry-After header.
 *
 * @example
 * ```ts
 * const rateLimiter = createRateLimit({
 *   windowMs: 60000, // 1 minute
 *   maxRequests: 100, // max 100 requests per window
 *   keyGenerator: (req) => req.headers['x-forwarded-for'] || req.connection.remoteAddress,
 * });
 *
 * app.use(rateLimiter.middleware());
 * ```
 */

import type { RateLimitMiddleware, RateLimitOptions, RateLimitInfo } from "./types.js";

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_STATUS_CODE = 429;
const DEFAULT_MESSAGE = "Too many requests";

/**
 * Internal window entry tracking request timestamps.
 */
class WindowEntry {
    timestamps: number[] = [];

    constructor(private readonly windowMs: number) {}

    add(timestamp: number): void {
        this.timestamps.push(timestamp);
        this.prune(timestamp);
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
 *   keyGenerator: (req) => {
 *     const reqAny = req as any;
 *     return reqAny.headers?.['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
 *   },
 * });
 *
 * app.use(rateLimiter.middleware());
 * ```
 */
export function createRateLimit(options: RateLimitOptions = {}): RateLimitMiddleware {
    const merged: RateLimitOptions = {
        windowMs: options.windowMs ?? DEFAULT_WINDOW_MS,
        maxRequests: options.maxRequests ?? DEFAULT_MAX_REQUESTS,
        keyGenerator: options.keyGenerator,
        message: options.message ?? DEFAULT_MESSAGE,
        statusCode: options.statusCode ?? DEFAULT_STATUS_CODE,
        includeRetryAfter: options.includeRetryAfter ?? true,
        skipFailedRequests: options.skipFailedRequests ?? false,
        skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    };

    let enabled = true;
    const windows = new Map<string, WindowEntry>();

    function getWindow(key: string): WindowEntry {
        let window = windows.get(key);
        if (!window) {
            window = new WindowEntry(merged.windowMs!);
            windows.set(key, window);
        }
        return window;
    }

    function getKey(req: unknown): string {
        if (merged.keyGenerator) {
            return merged.keyGenerator(req);
        }
        // Default: try to extract IP from common headers
        const reqAny = req as any;
        return (
            reqAny.headers?.["x-forwarded-for"] ||
            reqAny.headers?.["x-real-ip"] ||
            reqAny.connection?.remoteAddress ||
            reqAny.socket?.remoteAddress ||
            "unknown"
        );
    }

    function middleware(): (req: unknown, res: unknown, next?: () => void) => void {
        return (req: unknown, res: unknown, next?: () => void) => {
            if (!enabled) {
                if (next) next();
                return;
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
