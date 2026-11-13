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

    // ===== New DX Features =====
    describe("Config sections", () => {
        it("applies security defaults globally", () => {
            const core = createApp({
                security: {
                    cors: { origin: "https://example.com", credentials: true },
                    csrf: { cookieName: "my-csrf" },
                    helmet: { hidePoweredBy: true },
                    compression: { threshold: 2048 },
                },
            });

            const cors = core.security().cors();
            expect(cors.options.origin).toBe("https://example.com");
            expect(cors.options.credentials).toBe(true);

            const csrf = core.security().csrf();
            expect(csrf.options.cookieName).toBe("my-csrf");

            const helmet = core.security().helmet();
            expect(helmet.options.hidePoweredBy).toBe(true);

            const compression = core.security().compression();
            expect(compression.options.threshold).toBe(2048);
        });

        it("per-call options override global defaults", () => {
            const core = createApp({
                security: {
                    cors: { origin: "https://default.com" },
                },
            });

            const cors = core.security().cors({ origin: "https://override.com" });
            expect(cors.options.origin).toBe("https://override.com");
        });

        it("applies cookie defaults globally", () => {
            const core = createApp({
                cookie: {
                    secure: true,
                    httpOnly: true,
                    sameSite: "strict",
                    maxAge: 7200,
                },
            });

            const serialized = core.cookies().serialize("session", "abc", {});
            expect(serialized).toContain("Secure");
            expect(serialized).toContain("HttpOnly");
            expect(serialized).toContain("SameSite=Strict");
            expect(serialized).toContain("Max-Age=7200");
        });

        it("applies multipart defaults globally", () => {
            const core = createApp({
                multipart: {
                    maxFileSize: 5 * 1024 * 1024,
                    maxFiles: 3,
                    allowedMimeTypes: ["image/png"],
                },
            });

            const mp = core.multipart();
            const middleware = mp.multipart();
            expect(middleware.options.maxFileSize).toBe(5 * 1024 * 1024);
            expect(middleware.options.maxFiles).toBe(3);
            expect(middleware.options.allowedMimeTypes).toEqual(["image/png"]);
        });

        it("applies health path default", () => {
            const core = createApp({
                health: { path: "/custom-health" },
            });

            const health = core.health();
            expect(health).toBeDefined();
        });
    });

    describe("Cached API instances", () => {
        it("returns same health API instance on repeated calls", () => {
            const core = createApp();
            const h1 = core.health();
            const h2 = core.health();
            expect(h1).toBe(h2);
        });

        it("returns same security API instance on repeated calls", () => {
            const core = createApp();
            const s1 = core.security();
            const s2 = core.security();
            expect(s1).toBe(s2);
        });

        it("returns same hooks API instance on repeated calls", () => {
            const core = createApp();
            const h1 = core.hooks();
            const h2 = core.hooks();
            expect(h1).toBe(h2);
        });

        it("returns same msgpack API instance on repeated calls", () => {
            const core = createApp();
            const m1 = core.msgpack();
            const m2 = core.msgpack();
            expect(m1).toBe(m2);
        });

        it("returns same lib API instance on repeated calls", () => {
            const core = createApp();
            const l1 = core.lib();
            const l2 = core.lib();
            expect(l1).toBe(l2);
        });

        it("returns same config API instance on repeated calls", () => {
            const core = createApp();
            const c1 = core.config();
            const c2 = core.config();
            expect(c1).toBe(c2);
        });
    });

    describe("Config getters and setters", () => {
        it("get and set config values", () => {
            const core = createApp({ serviceName: "test", port: 3000 });
            const config = core.config();

            expect(config.get("serviceName")).toBe("test");
            expect(config.get("port")).toBe(3000);

            config.set("port", 4000);
            expect(config.get("port")).toBe(4000);
            expect(config.port).toBe(4000);
        });
    });

    describe("app.use() middleware registration", () => {
        it("registers and stores middleware", () => {
            const core = createApp();
            const mw = (req: unknown, res: unknown, next?: () => void) => {
                if (next) next();
            };

            const result = core.use(mw);
            expect(result).toBe(core);
        });

        it("chains multiple use() calls", () => {
            const core = createApp();
            const mw1 = (req: unknown, res: unknown, next?: () => void) => {
                if (next) next();
            };
            const mw2 = (req: unknown, res: unknown, next?: () => void) => {
                if (next) next();
            };

            core.use(mw1).use(mw2);
        });
    });
});
