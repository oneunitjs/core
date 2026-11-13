import { describe, it, expect } from "vitest";
import { createRateLimit } from "../../src/security/rate-limit.js";

describe("Rate Limiter - Basic Rate Limiting", () => {
    it("should allow requests under the limit", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 5,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });

        const middleware = rateLimiter.middleware();
        for (let i = 0; i < 5; i++) {
            const req: any = { ip: "192.168.1.1" };
            const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
            middleware(req, res);
            expect(res.statusCode).toBe(200);
        }
    });

    it("should reject requests over the limit", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 3,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });

        const middleware = rateLimiter.middleware();
        for (let i = 0; i < 3; i++) {
            const req: any = { ip: "192.168.1.1" };
            const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
            middleware(req, res);
            expect(res.statusCode).toBe(200);
        }

        // 4th request should be blocked
        const req: any = { ip: "192.168.1.1" };
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res);
        expect(res.statusCode).toBe(429);
    });

    it("should track separate limits per key", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 2,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });

        const middleware = rateLimiter.middleware();

        // IP 1 makes 2 requests (at limit)
        const req1: any = { ip: "192.168.1.1" };
        const res1: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req1, res1);
        middleware(req1, res1);
        expect(res1.statusCode).toBe(200);

        // IP 2 should still be able to make requests
        const req2: any = { ip: "192.168.1.2" };
        const res2: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req2, res2);
        expect(res2.statusCode).toBe(200);

        // IP 1 should be blocked
        const req3: any = { ip: "192.168.1.1" };
        const res3: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req3, res3);
        expect(res3.statusCode).toBe(429);
    });
});

describe("Rate Limiter - Window Reset", () => {
    it("should reset count after window expires", async () => {
        const rateLimiter = createRateLimit({
            maxRequests: 2,
            windowMs: 50, // 50ms window for fast test
            keyGenerator: (req) => (req as any).ip || "default",
        });

        const middleware = rateLimiter.middleware();
        const req: any = { ip: "192.168.1.1" };

        // Exhaust the limit
        const res1: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res1);
        middleware(req, res1);
        expect(res1.statusCode).toBe(200);

        // Should be blocked
        const res2: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res2);
        expect(res2.statusCode).toBe(429);

        // Wait for window to expire
        await new Promise((resolve) => setTimeout(resolve, 60));

        // Should be allowed again
        const res3: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res3);
        expect(res3.statusCode).toBe(200);
    });
});

describe("Rate Limiter - Headers", () => {
    it("should set rate limit headers on response", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 5,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });

        const middleware = rateLimiter.middleware();
        const req: any = { ip: "192.168.1.1" };
        const res: any = {
            statusCode: 200,
            setHeader: (k: string, v: string) => { res[k] = v; },
            end: () => {},
        };
        middleware(req, res);

        expect(res["X-RateLimit-Limit"]).toBe("5");
        expect(res["X-RateLimit-Remaining"]).toBe("4");
        expect(res["X-RateLimit-Reset"]).toBeDefined();
    });

    it("should set Retry-After header when rate limited", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
            includeRetryAfter: true,
        });

        const middleware = rateLimiter.middleware();
        const req: any = { ip: "192.168.1.1" };
        const res: any = {
            statusCode: 200,
            setHeader: (k: string, v: string) => { res[k] = v; },
            end: () => {},
        };
        middleware(req, res);
        expect(res.statusCode).toBe(200);

        // Second request should be rate limited
        const res2: any = {
            statusCode: 200,
            setHeader: (k: string, v: string) => { res2[k] = v; },
            end: () => {},
        };
        middleware(req, res2);
        expect(res2.statusCode).toBe(429);
        expect(res2["Retry-After"]).toBeDefined();
        expect(parseInt(res2["Retry-After"], 10)).toBeGreaterThanOrEqual(0);
    });
});

describe("Rate Limiter - Configuration Options", () => {
    it("should use custom status code", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
            statusCode: 429,
        });

        const middleware = rateLimiter.middleware();
        const req: any = { ip: "192.168.1.1" };
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res);
        expect(res.statusCode).toBe(200);

        const res2: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res2);
        expect(res2.statusCode).toBe(429);
    });

    it("should use custom message", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
            message: "Too many requests, please try again later",
        });

        const middleware = rateLimiter.middleware();
        const req: any = { ip: "192.168.1.1" };
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res);
        expect(res.statusCode).toBe(200);

        const res2: any = {
            statusCode: 200,
            setHeader: () => {},
            end: (body: string) => {
                res2.body = body;
            },
        };
        middleware(req, res2);
        expect(res2.statusCode).toBe(429);
        expect(res2.body).toContain("Too many requests, please try again later");
    });

    it("should use custom key generator", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).headers?.["x-api-key"] || "default",
        });

        const middleware = rateLimiter.middleware();
        const req1: any = { headers: { "x-api-key": "key-1" } };
        const res1: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req1, res1);
        expect(res1.statusCode).toBe(200);

        // Same key should be blocked
        const req2: any = { headers: { "x-api-key": "key-1" } };
        const res2: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req2, res2);
        expect(res2.statusCode).toBe(429);

        // Different key should work
        const req3: any = { headers: { "x-api-key": "key-2" } };
        const res3: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req3, res3);
        expect(res3.statusCode).toBe(200);
    });

    it("should use default key generator when none provided", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
        });

        const middleware = rateLimiter.middleware();
        const req: any = { headers: { "x-forwarded-for": "10.0.0.1" } };
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res);
        expect(res.statusCode).toBe(200);

        const res2: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res2);
        expect(res2.statusCode).toBe(429);
    });
});

describe("Rate Limiter - Enable/Disable", () => {
    it("should allow all requests when disabled", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });
        rateLimiter.disable();

        const middleware = rateLimiter.middleware();
        const req: any = { ip: "192.168.1.1" };

        // Should allow many requests when disabled
        for (let i = 0; i < 10; i++) {
            const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
            middleware(req, res);
            expect(res.statusCode).toBe(200);
        }
    });

    it("should re-enable after disable", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });
        rateLimiter.disable();
        rateLimiter.enable();

        const middleware = rateLimiter.middleware();
        const req: any = { ip: "192.168.1.1" };
        const res1: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res1);
        expect(res1.statusCode).toBe(200);

        const res2: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res2);
        expect(res2.statusCode).toBe(429);
    });

    it("should toggle enabled state", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });
        expect(rateLimiter.enabled).toBe(true);

        rateLimiter.toggle();
        expect(rateLimiter.enabled).toBe(false);

        rateLimiter.toggle();
        expect(rateLimiter.enabled).toBe(true);
    });
});

describe("Rate Limiter - Reset", () => {
    it("should reset rate limit for a specific key", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });

        const middleware = rateLimiter.middleware();
        const req: any = { ip: "192.168.1.1" };
        const res1: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res1);
        expect(res1.statusCode).toBe(200);

        const res2: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res2);
        expect(res2.statusCode).toBe(429);

        // Reset the key
        rateLimiter.resetKey("192.168.1.1");

        const res3: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res3);
        expect(res3.statusCode).toBe(200);
    });

    it("should reset all rate limits", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });

        const middleware = rateLimiter.middleware();

        // Exhaust multiple keys
        const req1: any = { ip: "192.168.1.1" };
        const req2: any = { ip: "192.168.1.2" };
        const res1: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const res2: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req1, res1);
        middleware(req2, res2);

        const res1b: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const res2b: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req1, res1b);
        middleware(req2, res2b);
        expect(res1b.statusCode).toBe(429);
        expect(res2b.statusCode).toBe(429);

        // Reset all
        rateLimiter.resetAll();

        const res1c: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        const res2c: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req1, res1c);
        middleware(req2, res2c);
        expect(res1c.statusCode).toBe(200);
        expect(res2c.statusCode).toBe(200);
    });
});

describe("Rate Limiter - Info", () => {
    it("should return rate limit info for a key", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 5,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });

        const middleware = rateLimiter.middleware();
        const req: any = { ip: "192.168.1.1" };
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware(req, res);

        const info = rateLimiter.getRateLimitInfo("192.168.1.1");
        expect(info).not.toBeNull();
        expect(info?.totalRequests).toBe(1);
        expect(info?.remaining).toBe(4);
        expect(info?.limited).toBe(false);
    });

    it("should return null for unknown key", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 5,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });

        const info = rateLimiter.getRateLimitInfo("192.168.1.99");
        expect(info).toBeNull();
    });
});
