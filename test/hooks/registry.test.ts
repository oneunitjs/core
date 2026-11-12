import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHooks } from "../../src/hooks/index.js";
import express from "express";
import Fastify from "fastify";
import Koa from "koa";
import http from "node:http";

describe("Hooks - Express Real Server", () => {
    let app: express.Application;
    let server: http.Server;
    let port: number;

    beforeAll(async () => {
        app = express();
        app.use(express.json());

        const hooks = createHooks<{ path: string; method: string }>();
        const events: string[] = [];

        hooks.on("request", async (ctx) => {
            events.push(`${ctx.method} ${ctx.path}`);
        });

        app.use((req, res, next) => {
            void hooks.emit("request", { path: req.url ?? "", method: req.method ?? "" });
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, events }));
        });

        server = http.createServer(app);
        await new Promise<void>((resolve) => server.listen(0, resolve));
        port = (server.address() as any).port;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(resolve));
    });

    async function request(path: string, method: string = "GET"): Promise<{ statusCode: number; body: any }> {
        return new Promise((resolve, reject) => {
            const req = http.request(
                { hostname: "127.0.0.1", port, path, method },
                (res) => {
                    let data = "";
                    res.on("data", (chunk) => { data += chunk; });
                    res.on("end", () => {
                        let parsed: any;
                        try { parsed = JSON.parse(data); } catch { parsed = data; }
                        resolve({ statusCode: res.statusCode ?? 0, body: parsed });
                    });
                },
            );
            req.on("error", reject);
            req.end();
        });
    }

    it("hooks fire on every request via express middleware", async () => {
        await request("/api/users", "GET");
        const res = await request("/api/posts", "POST");
        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});

describe("Hooks - Fastify Real Server", () => {
    let fastify: Fastify.FastifyInstance;
    let port: number;

    beforeAll(async () => {
        fastify = Fastify();
        const hooks = createHooks<{ path: string; method: string }>();
        const events: string[] = [];

        hooks.on("request", async (ctx) => {
            events.push(`${ctx.method} ${ctx.path}`);
        });

        fastify.addHook("onRequest", async (req, reply) => {
            void hooks.emit("request", { path: req.url ?? "", method: req.method ?? "" });
        });

        fastify.get("/api/test", async () => {
            return { ok: true };
        });

        await fastify.ready();
        await new Promise<void>((resolve) => fastify.server.listen(0, resolve));
        port = (fastify.server.address() as any).port;
    });

    afterAll(async () => {
        await fastify.close();
    });

    async function request(path: string): Promise<{ statusCode: number; body: any }> {
        return fastify.inject({ method: "GET", url: path }).then((res) => ({
            statusCode: res.statusCode,
            body: JSON.parse(res.payload),
        }));
    }

    it("hooks fire on every request via fastify hook", async () => {
        const res = await request("/api/test");
        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});

describe("Hooks - Koa Real Server", () => {
    let app: Koa;
    let server: http.Server;
    let port: number;

    beforeAll(async () => {
        app = new Koa();

        const hooks = createHooks<{ path: string; method: string }>();
        const events: string[] = [];

        hooks.on("request", async (ctx) => {
            events.push(`${ctx.method} ${ctx.path}`);
        });

        app.use(async (ctx) => {
            await hooks.emit("request", { path: ctx.path, method: ctx.method });
            ctx.body = { ok: true };
        });

        server = http.createServer(app.callback());
        await new Promise<void>((resolve) => server.listen(0, resolve));
        port = (server.address() as any).port;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(resolve));
    });

    async function request(path: string): Promise<{ statusCode: number; body: any }> {
        return new Promise((resolve, reject) => {
            const req = http.request(
                { hostname: "127.0.0.1", port, path, method: "GET" },
                (res) => {
                    let data = "";
                    res.on("data", (chunk) => { data += chunk; });
                    res.on("end", () => {
                        let parsed: any;
                        try { parsed = JSON.parse(data); } catch { parsed = data; }
                        resolve({ statusCode: res.statusCode ?? 0, body: parsed });
                    });
                },
            );
            req.on("error", reject);
            req.end();
        });
    }

    it("hooks fire on every request via koa middleware", async () => {
        const res = await request("/api/items");
        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});

describe("Hooks - Framework Agnostic Unit Tests", () => {
    it("registers and emits async listeners", async () => {
        const hooks = createHooks<{ name: string }>();
        const calls: string[] = [];

        hooks.on("start", async (ctx) => {
            calls.push(`start:${ctx.name}`);
        });
        hooks.on("start", async (ctx) => {
            calls.push(`end:${ctx.name}`);
        });

        await hooks.emit("start", { name: "app" });

        expect(calls).toEqual(["start:app", "end:app"]);
    });

    it("emitSync runs listeners synchronously", () => {
        const hooks = createHooks<{ name: string }>();
        const calls: string[] = [];

        hooks.on("greet", (ctx) => {
            calls.push(`hello ${ctx.name}`);
        });

        hooks.emitSync("greet", { name: "world" });

        expect(calls).toEqual(["hello world"]);
    });

    it("once only fires once", async () => {
        const hooks = createHooks();
        const calls: string[] = [];

        hooks.once("boot", async () => {
            calls.push("booted");
        });

        await hooks.emit("boot", {});
        await hooks.emit("boot", {});

        expect(calls).toEqual(["booted"]);
        expect(hooks.listenerCount("boot")).toBe(0);
    });

    it("off removes a listener", () => {
        const hooks = createHooks();
        const cb = () => {};
        hooks.on("baz", cb);

        expect(hooks.has("baz")).toBe(true);

        hooks.off("baz", cb);
        expect(hooks.has("baz")).toBe(false);
        expect(hooks.listenerCount("baz")).toBe(0);
    });

    it("clear clears all listeners", () => {
        const hooks = createHooks();
        hooks.on("a", () => {});
        hooks.on("b", () => {});

        hooks.clear();
        expect(hooks.listenerCount("a")).toBe(0);
        expect(hooks.listenerCount("b")).toBe(0);
    });

    it("supports throwOnError option", async () => {
        const hooks = createHooks({ throwOnError: true });
        hooks.on("fail", async () => {
            throw new Error("boom");
        });

        await expect(hooks.emit("fail", {})).rejects.toThrow("boom");
    });

    it("does not throw by default when a listener fails", async () => {
        const hooks = createHooks();
        const calls: string[] = [];

        hooks.on("a", async () => {
            throw new Error("boom");
        });
        hooks.on("b", async () => {
            calls.push("ran");
        });

        await hooks.emit("a", {});
        await hooks.emit("b", {});

        expect(calls).toEqual(["ran"]);
    });

    it("toJSON returns listener counts per event", () => {
        const hooks = createHooks();
        hooks.on("a", () => {});
        hooks.on("a", () => {});
        hooks.on("b", () => {});

        expect(hooks.toJSON()).toEqual({ a: 2, b: 1 });
    });
});
