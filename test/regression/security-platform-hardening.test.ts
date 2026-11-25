import { describe, expect, it } from "vitest";
import { createCsrf } from "../../src/security/csrf.js";
import { createHelmet } from "../../src/security/helmet.js";
import { createHealthRoute } from "../../src/health/route.js";
import { resolveConfig } from "../../src/config/resolver.js";

type Reply = {
    status: (code: number) => Reply;
    send: (body: unknown) => void;
    statusCode?: number;
    body?: unknown;
};

function makeReply(): Reply {
    const reply: Reply = {
        status(code) {
            reply.statusCode = code;
            return reply;
        },
        send(body) {
            reply.body = body;
        },
    };
    return reply;
}

function makeHealthServer() {
    const handlers = new Map<string, (request: unknown, reply: Reply) => unknown>();
    return {
        handlers,
        get(path: string, handler: (request: unknown, reply: Reply) => unknown) {
            handlers.set(path, handler);
        },
        decorate() {},
    };
}

describe("security regression coverage", () => {
    it("issues a session-bound CSRF token that the same session can submit", () => {
        const csrf = createCsrf({
            secret: "test-only-secret-that-is-long-enough",
            sessionId: (request: any) => request.session.id,
        });
        const safeResponse: any = {
            headers: {},
            setHeader(name: string, value: unknown) {
                this.headers[name] = value;
            },
            getHeader(name: string) {
                return this.headers[name];
            },
        };

        csrf.middlewareWithToken()(
            { method: "GET", session: { id: "session-a" }, headers: {} },
            safeResponse,
        );

        const token = safeResponse.headers["X-CSRF-Token"];
        expect(token).toMatch(/^[0-9a-f]{64}\.[0-9a-f]{64}$/);
        expect(safeResponse.headers["Set-Cookie"]).toContain(`_csrf=${token}`);

        let nextCalled = false;
        const unsafeResponse: any = {
            statusCode: 200,
            end(body: string) {
                this.body = body;
            },
        };
        csrf.middlewareWithToken()(
            {
                method: "POST",
                session: { id: "session-a" },
                headers: {
                    "x-csrf-token": token,
                    cookie: `_csrf=${token}`,
                },
            },
            unsafeResponse,
            () => {
                nextCalled = true;
            },
        );

        expect(nextCalled).toBe(true);
        expect(unsafeResponse.statusCode).toBe(200);
    });

    it("rejects a CSRF token replayed in a different session", () => {
        const csrf = createCsrf({
            secret: "test-only-secret-that-is-long-enough",
            sessionId: (request: any) => request.session.id,
        });
        const token = csrf.generateToken("session-a");
        let nextCalled = false;
        const response: any = {
            statusCode: 200,
            end(body: string) {
                this.body = body;
            },
        };

        csrf.middlewareWithToken()(
            {
                method: "POST",
                session: { id: "session-b" },
                headers: {
                    "x-csrf-token": token,
                    cookie: `_csrf=${token}`,
                },
            },
            response,
            () => {
                nextCalled = true;
            },
        );

        expect(nextCalled).toBe(false);
        expect(response.statusCode).toBe(403);
    });

    it("does not emit an empty HSTS header when HSTS is enabled with true", () => {
        const headers = createHelmet({ hsts: true }).headers();
        expect(headers["Strict-Transport-Security"]).toMatch(/^max-age=\d+/);
    });
});

describe("health route criticality regression coverage", () => {
    async function invokeRoute(results: Record<string, { status: string }>, critical: boolean) {
        const registry = {
            checkAll: async () => results,
            getAll: () => [{ name: "dependency", critical, check: async () => ({ status: "healthy" }) }],
        } as any;
        const server = makeHealthServer();
        await createHealthRoute(registry)(server as any);
        const reply = makeReply();
        await server.handlers.get("/health")!({}, reply);
        return reply;
    }

    it("returns 503 for an unhealthy critical provider", async () => {
        const reply = await invokeRoute({ dependency: { status: "unhealthy" } }, true);
        expect(reply.statusCode).toBe(503);
        expect((reply.body as any).status).toBe("unhealthy");
    });

    it("degrades rather than failing readiness for an unhealthy non-critical provider", async () => {
        const reply = await invokeRoute({ dependency: { status: "unhealthy" } }, false);
        expect(reply.statusCode).toBe(200);
        expect((reply.body as any).status).toBe("degraded");
    });

    it("returns healthy for an empty provider registry", async () => {
        const registry = { checkAll: async () => ({}), getAll: () => [] } as any;
        const server = makeHealthServer();
        await createHealthRoute(registry)(server as any);
        const reply = makeReply();
        await server.handlers.get("/health")!({}, reply);
        expect(reply.statusCode).toBe(200);
        expect((reply.body as any).status).toBe("healthy");
    });
});

describe("configuration resolver regression coverage", () => {
    it("does not alias mutable Map values from defaults", () => {
        const original = new Map([["feature", { enabled: true }]]);
        const resolved = resolveConfig({
            defaults: { flags: original },
            sources: [],
            envOverrides: {},
            cliOverrides: {},
        }) as any;

        expect(resolved.flags).toBeInstanceOf(Map);
        expect(resolved.flags).not.toBe(original);
        resolved.flags.set("another", true);
        expect(original.has("another")).toBe(false);
    });

    it("preserves Date values instead of converting them to plain objects", () => {
        const date = new Date("2025-01-02T03:04:05.000Z");
        const resolved = resolveConfig({
            defaults: { createdAt: date },
            sources: [],
            envOverrides: {},
            cliOverrides: {},
        }) as any;

        expect(resolved.createdAt).toBeInstanceOf(Date);
        expect(resolved.createdAt.toISOString()).toBe(date.toISOString());
        expect(resolved.createdAt).not.toBe(date);
    });

    it("does not merge inherited properties from source objects", () => {
        const source = Object.create({ inherited: "must-not-leak" });
        source.visible = "allowed";
        const resolved = resolveConfig({
            defaults: {},
            sources: [source],
            envOverrides: {},
            cliOverrides: {},
        }) as any;

        expect(resolved.visible).toBe("allowed");
        expect(Object.prototype.hasOwnProperty.call(resolved, "inherited")).toBe(false);
    });
});
