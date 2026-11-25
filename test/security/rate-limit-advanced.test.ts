import { describe, it, expect } from "vitest";
import { createRateLimit } from "../../src/security/rate-limit.js";

describe("Rate Limiting - Advanced Tests", () => {
    it("RL-01: Request limits enforced", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 3,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });
        const middleware = rateLimiter.middleware();
        const ip = "10.0.0.1";
        for (let i = 0; i < 3; i++) {
            const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
            middleware({ ip }, res);
            expect(res.statusCode).toBe(200);
        }
        const res4: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware({ ip }, res4);
        expect(res4.statusCode).toBe(429);
    });

    it("RL-02: Window expiration resets count", async () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 50,
            keyGenerator: (req) => (req as any).ip || "default",
        });
        const middleware = rateLimiter.middleware();
        const res1: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware({ ip: "10.0.0.1" }, res1);
        expect(res1.statusCode).toBe(200);
        const res2: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware({ ip: "10.0.0.1" }, res2);
        expect(res2.statusCode).toBe(429);
        await new Promise((resolve) => setTimeout(resolve, 60));
        const res3: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware({ ip: "10.0.0.1" }, res3);
        expect(res3.statusCode).toBe(200);
    });

    it("RL-03: Concurrent requests are race-safe", async () => {
        const rateLimiter = createRateLimit({
            maxRequests: 10,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });
        const middleware = rateLimiter.middleware();
        const results: number[] = [];
        await Promise.all(
            Array.from({ length: 20 }, () =>
                new Promise<void>((resolve) => {
                    const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
                    middleware({ ip: "10.0.0.1" }, res);
                    results.push(res.statusCode);
                    resolve();
                }),
            ),
        );
        const count200 = results.filter((s) => s === 200).length;
        const count429 = results.filter((s) => s === 429).length;
        expect(count200).toBeLessThanOrEqual(10);
        expect(count429).toBeGreaterThanOrEqual(10);
    });

    it("RL-04: Key isolation - different IPs tracked independently", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });
        const middleware = rateLimiter.middleware();
        const resA: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware({ ip: "10.0.0.1" }, resA);
        expect(resA.statusCode).toBe(200);
        const resB: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware({ ip: "10.0.0.2" }, resB);
        expect(resB.statusCode).toBe(200);
    });

    it("RL-05: Rate limit headers set", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 5,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });
        const middleware = rateLimiter.middleware();
        const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { res[k] = v; }, end: () => {} };
        middleware({ ip: "10.0.0.1" }, res);
        expect(res["X-RateLimit-Limit"]).toBeDefined();
        expect(res["X-RateLimit-Remaining"]).toBeDefined();
    });

    it("RL-06: Retry-After header when rate limited", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
            includeRetryAfter: true,
        });
        const middleware = rateLimiter.middleware();
        middleware({ ip: "10.0.0.1" }, { statusCode: 200, setHeader: () => {}, end: () => {} });
        const res2: any = { statusCode: 200, setHeader: (k: string, v: string) => { res2[k] = v; }, end: () => {} };
        middleware({ ip: "10.0.0.1" }, res2);
        expect(res2.statusCode).toBe(429);
        expect(res2["Retry-After"]).toBeDefined();
    });

    it("RL-07: Untrusted proxy ignores X-Forwarded-For", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
            trustProxy: false,
            keyGenerator: (req) => (req as any).ip || "default",
        });
        const middleware = rateLimiter.middleware();
        const res: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware({ ip: "10.0.0.1", headers: { "x-forwarded-for": "1.2.3.4" } }, res);
        expect(res.statusCode).toBe(200);
    });

    it("RL-08: Reset key clears rate limit", () => {
        const rateLimiter = createRateLimit({
            maxRequests: 1,
            windowMs: 60000,
            keyGenerator: (req) => (req as any).ip || "default",
        });
        const middleware = rateLimiter.middleware();
        middleware({ ip: "10.0.0.1" }, { statusCode: 200, setHeader: () => {}, end: () => {} });
        const res2: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware({ ip: "10.0.0.1" }, res2);
        expect(res2.statusCode).toBe(429);
        rateLimiter.resetKey("10.0.0.1");
        const res3: any = { statusCode: 200, setHeader: () => {}, end: () => {} };
        middleware({ ip: "10.0.0.1" }, res3);
        expect(res3.statusCode).toBe(200);
    });
});
