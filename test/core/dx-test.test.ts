import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../../src/core/index.js";
import {
    createResponseFrameworkManager,
    createResponseManager,
    createExpressAdapter,
    createFastifyAdapter,
    createKoaAdapter,
    createHttpAdapter,
} from "../../src/response-mangement/index.js";
import express from "express";
import Fastify from "fastify";
import Koa from "koa";
import http from "node:http";

describe("createApp - Unified DX", () => {
    // ===== EXPRESS =====
    describe("Express real server", () => {
        let app: express.Application;
        let server: http.Server;
        let port: number;

        beforeAll(async () => {
            app = express();
            app.use(express.json());

            const core = createApp({ serviceName: "express-test", secret: "my-secret" });
            const health = core.health();
            health.register("db", async () => ({ status: "healthy" }));
            const hServer = {
                get: (path: string, handler: any) => {
                    app.get(path, async (_req: any, resp: any) => {
                        const reply: any = {
                            status: (code: number) => {
                                resp.status(code);
                                return reply;
                            },
                            send: (body: unknown) => {
                                resp.json(body);
                            },
                        };
                        await handler(_req, reply);
                    });
                },
                decorate: (name: string, value: unknown) => {
                    (app as any)[name] = value;
                },
            };
            await health.route(hServer as any);

            app.get("/cookie", (req, res) => {
                const cookies = core.cookies(req, res);
                cookies.set("session", "abc123", { httpOnly: true, secure: true });
                res.json({ ok: true });
            });

            app.use((req, res, next) => {
                const cors = core.security().cors({ origin: "*" });
                const mw = cors.middleware();
                mw(req, res, next);
            });

            app.get("/cors", (_req, res) => {
                res.json({ ok: true });
            });

            server = http.createServer(app);
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

        it("health via express adapter", async () => {
            const res = await request("/health");
            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe("healthy");
        });

        it("cookies via express adapter", async () => {
            const res = await request("/cookie");
            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
        });

        it("cors via express adapter", async () => {
            const res = await request("/cors");
            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
        });

        it("config API", () => {
            const core = createApp({ serviceName: "test", port: 3000 });
            const config = core.config();
            expect(config.serviceName).toBe("test");
            expect(config.port).toBe(3000);
            expect(config.isDevelopment || config.isTest).toBe(true);
            expect(config.isProduction).toBe(false);
        });

        it("hooks API", async () => {
            const core = createApp();
            const hooks = core.hooks();
            const calls: string[] = [];

            hooks.on("request", async (ctx) => {
                calls.push(`${ctx.method} ${ctx.path}`);
            });

            await hooks.emit("request", { method: "GET", path: "/api" });
            expect(calls).toEqual(["GET /api"]);
        });

        it("msgpack API", () => {
            const core = createApp();
            const msgpack = core.msgpack();
            const encoded = msgpack.encode({ hello: "world" });
            expect(encoded).toBeInstanceOf(Uint8Array);
            const decoded = msgpack.decode<{ hello: string }>(encoded);
            expect(decoded.hello).toBe("world");
        });

        it("config.toJSON()", () => {
            const core = createApp({ serviceName: "test-app", port: 9000 });
            const config = core.config();
            const json = config.toJSON();
            expect(json.serviceName).toBe("test-app");
            expect(json.port).toBe(9000);
        });
    });

    // ===== FASTIFY =====
    describe("Fastify real server", () => {
        let fastify: Fastify.FastifyInstance;
        let port: number;

        beforeAll(async () => {
            fastify = Fastify();
            const manager = createResponseManager();

            fastify.get("/ok", async (_req, reply) => {
                const adapter = createFastifyAdapter(reply);
                const rfm = createResponseFrameworkManager(manager, adapter);
                rfm.ok({ data: { id: 1 }, message: "OK" });
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

        it("response via fastify adapter", async () => {
            const res = await request("/ok");
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual({ id: 1 });
        });
    });

    // ===== KOA =====
    describe("Koa real server", () => {
        let app: Koa;
        let server: http.Server;
        let port: number;

        beforeAll(async () => {
            app = new Koa();
            const core = createApp({ serviceName: "koa-test" });

            app.use(async (ctx) => {
                if (ctx.path === "/ok") {
                    const adapter = createKoaAdapter(ctx);
                    const rfm = createResponseFrameworkManager(createResponseManager(), adapter);
                    rfm.ok({ message: "Hello from Koa" });
                }
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

        it("response via koa adapter", async () => {
            const res = await request("/ok");
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.msg).toBe("Hello from Koa");
        });
    });

    // ===== node:http =====
    describe("node:http real server", () => {
        let server: http.Server;
        let port: number;

        beforeAll(async () => {
            const manager = createResponseManager();
            server = http.createServer((req, res) => {
                const adapter = createHttpAdapter(res);
                const rfm = createResponseFrameworkManager(manager, adapter);
                if (req.url === "/ok") {
                    rfm.ok({ message: "HTTP works" });
                } else {
                    res.writeHead(404).end();
                }
            });
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

        it("response via node:http adapter", async () => {
            const res = await request("/ok");
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.msg).toBe("HTTP works");
        });
    });

    // ===== Security adapters =====
    describe("Security adapters - real frameworks", () => {
        it("CORS via express adapter", async () => {
            const app = express();
            const core = createApp();
            const cors = core.security().cors({ origin: "*" });
            const mw = cors.middleware();

            app.get("/cors", (_req, res) => {
                mw(_req, res, () => {
                    res.json({ ok: true });
                });
            });

            const testServer = http.createServer(app);
            await new Promise<void>((resolve) => testServer.listen(0, resolve));
            const p = (testServer.address() as any).port;

            const res = await new Promise<{ statusCode: number; body: any }>((resolve, reject) => {
                const req = http.request(
                    { hostname: "127.0.0.1", port: p, path: "/cors", method: "GET" },
                    (res) => {
                        let data = "";
                        res.on("data", (chunk) => { data += chunk; });
                        res.on("end", () => {
                            resolve({ statusCode: res.statusCode ?? 0, body: JSON.parse(data) });
                        });
                    },
                );
                req.on("error", reject);
                req.end();
            });

            await new Promise<void>((resolve) => testServer.close(resolve));
            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
        });

        it("CSRF via express adapter", async () => {
            const app = express();
            app.use(express.json());
            const core = createApp({ secret: "my-secret" });
            const csrf = core.security().csrf();

            app.post("/submit", (req, res) => {
                const mw = csrf.middleware();
                mw(req, res, () => {
                    res.json({ ok: true });
                });
            });

            const testServer = http.createServer(app);
            await new Promise<void>((resolve) => testServer.listen(0, resolve));
            const p = (testServer.address() as any).port;

            // Without token - should fail
            const res1 = await new Promise<{ statusCode: number }>((resolve, reject) => {
                const req = http.request(
                    { hostname: "127.0.0.1", port: p, path: "/submit", method: "POST" },
                    (res) => resolve({ statusCode: res.statusCode ?? 0 }),
                );
                req.on("error", reject);
                req.end(JSON.stringify({ data: "test" }));
            });
            expect(res1.statusCode).toBe(403);

            // With token - should pass
            const token = csrf.generateToken();
            const res2 = await new Promise<{ statusCode: number }>((resolve, reject) => {
                const req = http.request(
                    {
                        hostname: "127.0.0.1",
                        port: p,
                        path: "/submit",
                        method: "POST",
                        headers: { "x-csrf-token": token },
                    },
                    (res) => resolve({ statusCode: res.statusCode ?? 0 }),
                );
                req.on("error", reject);
                req.end(JSON.stringify({ data: "test" }));
            });
            expect(res2.statusCode).toBe(200);

            await new Promise<void>((resolve) => testServer.close(resolve));
        });
    });
});
