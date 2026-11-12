import { describe, it, expect } from "vitest";
import { createHealthRoute } from "../../src/health/index.js";

type HealthReply = { status: (code: number) => HealthReply; send: (body: unknown) => void; captured?: number; body?: unknown };

type RouteHandler = (request: unknown, reply: HealthReply) => void | Promise<void>;

type MockServer = {
    get: (path: string, handler: RouteHandler) => void;
    _registered: string[];
    _handler?: RouteHandler;
};

function mockServer(): MockServer {
    const registered: string[] = [];
    const server: MockServer = {
        get: (path: string, handler: RouteHandler) => {
            registered.push(path);
            if (path === "/health") {
                server._handler = handler;
            }
        },
        _registered: registered,
    };
    return server;
}

function makeReply(): HealthReply {
    let captured: number | undefined;
    let body: unknown;
    const reply: HealthReply = {
        status: (code) => {
            captured = code;
            return reply;
        },
        send: (b) => {
            body = b;
        },
    };
    Object.defineProperty(reply, "captured", { get: () => captured, enumerable: true });
    Object.defineProperty(reply, "body", { get: () => body, enumerable: true });
    return reply;
}

describe("createHealthRoute", () => {
    it("reports healthy when all checks pass", async () => {
        const registry = {
            checkAll: async () => ({
                db: { status: "healthy", latency: 5 },
                cache: { status: "healthy", latency: 2 },
            }),
            getAll: () => [
                { name: "db", check: async () => ({ status: "healthy" }), critical: true },
                { name: "cache", check: async () => ({ status: "healthy" }) },
            ],
        } as any;

        const server = mockServer();
        const route = createHealthRoute(registry, {
            path: "/health",
            serviceName: "svc",
            includeDetails: false,
        });
        await route(server);

        const reply = makeReply();
        await server._handler!({}, reply);

        expect(server._registered).toContain("/health");
        expect(reply.body).toMatchObject({
            service: "svc",
            status: "healthy",
            checks: { db: { status: "healthy" }, cache: { status: "healthy" } },
        });
        expect(reply.captured).toBe(200);
    });

    it("returns 503 when a critical provider is unhealthy", async () => {
        const registry = {
            checkAll: async () => ({
                db: { status: "unhealthy", latency: 1 },
                cache: { status: "healthy", latency: 1 },
            }),
            getAll: () => [
                { name: "db", check: async () => ({ status: "healthy" }), critical: true },
                { name: "cache", check: async () => ({ status: "healthy" }) },
            ],
        } as any;

        const server = mockServer();
        const route = createHealthRoute(registry, { path: "/health", includeDetails: false });
        await route(server);

        const reply = makeReply();
        await server._handler!({}, reply);

        expect((reply.body as any).status).toBe("unhealthy");
        expect(reply.captured).toBe(503);
    });

    it("reports degraded when a non-critical provider is degraded", async () => {
        const registry = {
            checkAll: async () => ({
                db: { status: "degraded", latency: 1 },
            }),
            getAll: () => [{ name: "db", check: async () => ({ status: "healthy" }), critical: false }],
        } as any;

        const server = mockServer();
        const route = createHealthRoute(registry, { path: "/health", includeDetails: false });
        await route(server);

        const reply = makeReply();
        await server._handler!({}, reply);

        expect((reply.body as any).status).toBe("degraded");
        expect(reply.captured).toBe(200);
    });

    it("excludes details unless includeDetails is enabled", async () => {
        const registry = {
            checkAll: async () => ({
                db: { status: "healthy", latency: 5, message: "ok" },
            }),
            getAll: () => [{ name: "db", check: async () => ({ status: "healthy" }) }],
        } as any;

        const server = mockServer();
        const route = createHealthRoute(registry, { path: "/health", includeDetails: false });
        await route(server);

        const reply = makeReply();
        await server._handler!({}, reply);

        expect((reply.body as any).checks.db).toEqual({ status: "healthy" });
    });

    it("registers a /details route when includeDetails is enabled", async () => {
        const registry = {
            checkAll: async () => ({ db: { status: "healthy" } }),
            getAll: () => [{ name: "db", check: async () => ({ status: "healthy" }) }],
        } as any;

        const registered: string[] = [];
        const server = {
            get: (path: string) => { registered.push(path); },
        } as any;

        const route = createHealthRoute(registry, { path: "/health", includeDetails: true });
        await route(server);

        expect(registered).toContain("/health");
        expect(registered).toContain("/health/details");
    });
});
