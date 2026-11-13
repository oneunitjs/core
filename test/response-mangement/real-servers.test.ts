import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createResponseFrameworkManager, createResponseManager, createExpressResponseAdapter, createFastifyResponseAdapter, createKoaResponseAdapter, createHttpResponseAdapter } from "../../src/response-mangement/index.js";
import express from "express";
import Fastify from "fastify";
import Koa from "koa";
import http from "node:http";

describe("Response Management — Real Framework Servers", () => {
    // ===== EXPRESS =====
    describe("Express real server", () => {
        let app: express.Application;
        let server: http.Server;
        let port: number;

        beforeAll(async () => {
            app = express();
            app.use(express.json());

            const manager = createResponseManager();

            app.get("/ok", (_req, res) => {
                const adapter = createExpressResponseAdapter(res);
                const rfm = createResponseFrameworkManager(manager, adapter);
                rfm.ok({ data: { id: 1 }, message: "Created successfully" });
            });

            app.get("/notfound", (_req, res) => {
                const adapter = createExpressResponseAdapter(res);
                const rfm = createResponseFrameworkManager(manager, adapter);
                rfm.notFound({ message: "Resource not found" });
            });

            app.post("/created", (_req, res) => {
                const adapter = createExpressResponseAdapter(res);
                const rfm = createResponseFrameworkManager(manager, adapter);
                rfm.created({ message: "Resource created", data: { id: 42 } });
            });

            app.get("/badrequest", (_req, res) => {
                const adapter = createExpressResponseAdapter(res);
                const rfm = createResponseFrameworkManager(manager, adapter);
                rfm.badRequest({ message: "Invalid input" });
            });

            app.get("/nocontent", (_req, res) => {
                const adapter = createExpressResponseAdapter(res);
                const rfm = createResponseFrameworkManager(manager, adapter);
                rfm.noContent();
            });

            server = http.createServer(app);
            await new Promise<void>((resolve) => server.listen(0, resolve));
            port = (server.address() as any).port;
        });

        afterAll(async () => {
            await new Promise<void>((resolve) => server.close(resolve));
        });

        async function request(path: string, method: string = "GET", body?: any): Promise<{ statusCode: number; body: any }> {
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
                if (body) req.write(JSON.stringify(body));
                req.end();
            });
        }

        it("ok() returns 200 with success envelope", async () => {
            const res = await request("/ok");
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.code).toBe("200");
            expect(res.body.msg).toBe("Created successfully");
            expect(res.body.data).toEqual({ id: 1 });
        });

        it("notFound() returns 404 with error envelope", async () => {
            const res = await request("/notfound");
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe("404");
            expect(res.body.msg).toBe("Resource not found");
        });

        it("created() returns 201", async () => {
            const res = await request("/created", "POST");
            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.code).toBe("201");
            expect(res.body.msg).toBe("Resource created");
            expect(res.body.data).toEqual({ id: 42 });
        });

        it("badRequest() returns 400", async () => {
            const res = await request("/badrequest");
            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe("400");
        });

        it("noContent() returns 204", async () => {
            const res = await request("/nocontent");
            expect(res.statusCode).toBe(204);
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
                const adapter = createFastifyResponseAdapter(reply);
                const rfm = createResponseFrameworkManager(manager, adapter);
                rfm.ok({ data: { id: 1 }, message: "OK" });
            });

            fastify.get("/notfound", async (_req, reply) => {
                const adapter = createFastifyResponseAdapter(reply);
                const rfm = createResponseFrameworkManager(manager, adapter);
                rfm.notFound({ message: "Not found" });
            });

            fastify.get("/internalerror", async (_req, reply) => {
                const adapter = createFastifyResponseAdapter(reply);
                const rfm = createResponseFrameworkManager(manager, adapter);
                rfm.internalServerError({ message: "Something went wrong" });
            });

            fastify.get("/nocontent", async (_req, reply) => {
                const adapter = createFastifyResponseAdapter(reply);
                const rfm = createResponseFrameworkManager(manager, adapter);
                rfm.noContent();
            });

            await fastify.ready();
            await new Promise<void>((resolve) => fastify.server.listen(0, resolve));
            port = (fastify.server.address() as any).port;
        });

        afterAll(async () => {
            await fastify.close();
        });

        async function request(path: string, method: string = "GET", body?: any): Promise<{ statusCode: number; body: any }> {
            return fastify.inject({ method, url: path, body }).then((res) => {
                let parsed: any;
                try { parsed = JSON.parse(res.payload); } catch { parsed = res.payload; }
                return { statusCode: res.statusCode, body: parsed };
            });
        }

        it("ok() returns 200 with success envelope", async () => {
            const res = await request("/ok");
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.code).toBe("200");
            expect(res.body.msg).toBe("OK");
            expect(res.body.data).toEqual({ id: 1 });
        });

        it("notFound() returns 404 with error envelope", async () => {
            const res = await request("/notfound");
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe("404");
            expect(res.body.msg).toBe("Not found");
        });

        it("internalServerError() returns 500", async () => {
            const res = await request("/internalerror");
            expect(res.statusCode).toBe(500);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe("500");
            expect(res.body.msg).toBe("Something went wrong");
        });

        it("noContent() returns 204", async () => {
            const res = await request("/nocontent");
            expect(res.statusCode).toBe(204);
        });
    });

    // ===== KOA =====
    describe("Koa real server", () => {
        async function makeRequest(path: string, method: string = "GET", body?: any): Promise<{ statusCode: number; body: any }> {
            const app = new Koa();
            const manager = createResponseManager();

            app.use(async (ctx) => {
                if (ctx.path === path) {
                    const adapter = createKoaResponseAdapter(ctx);
                    const rfm = createResponseFrameworkManager(manager, adapter);
                    if (path === "/ok") {
                        rfm.ok({ data: { id: 1 }, message: "OK" });
                    } else if (path === "/notfound") {
                        rfm.notFound({ message: "Not found" });
                    } else if (ctx.path === "/unauthorized") {
                        rfm.unauthorized({ message: "Authentication required" });
                    }
                }
            });

            const testServer = http.createServer(app.callback());
            await new Promise<void>((resolve) => testServer.listen(0, resolve));
            const testPort = (testServer.address() as any).port;

            const res = await new Promise<{ statusCode: number; body: any }>((resolve, reject) => {
                const req = http.request(
                    { hostname: "127.0.0.1", port: testPort, path, method },
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
                if (body) req.write(JSON.stringify(body));
                req.end();
            });

            await new Promise<void>((resolve) => testServer.close(resolve));
            return res;
        }

        it("ok() returns 200 with success envelope", async () => {
            const res = await makeRequest("/ok");
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.code).toBe("200");
            expect(res.body.msg).toBe("OK");
            expect(res.body.data).toEqual({ id: 1 });
        });

        it("notFound() returns 404 with error envelope", async () => {
            const res = await makeRequest("/notfound");
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe("404");
            expect(res.body.msg).toBe("Not found");
        });

        it("unauthorized() returns 401", async () => {
            const res = await makeRequest("/unauthorized");
            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe("401");
            expect(res.body.msg).toBe("Authentication required");
        });
    });

    // ===== node:http =====
    describe("node:http real server", () => {
        let server: http.Server;
        let port: number;

        beforeAll(async () => {
            const manager = createResponseManager();

            server = http.createServer((req, res) => {
                const adapter = createHttpResponseAdapter(res);
                const rfm = createResponseFrameworkManager(manager, adapter);
                if (req.url === "/ok") {
                    rfm.ok({ data: { id: 1 }, message: "OK" });
                } else if (req.url === "/notfound") {
                    rfm.notFound({ message: "Not found" });
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

        it("ok() returns 200 with success envelope", async () => {
            const res = await request("/ok");
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.msg).toBe("OK");
            expect(res.body.data).toEqual({ id: 1 });
        });

        it("notFound() returns 404 with error envelope", async () => {
            const res = await request("/notfound");
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.msg).toBe("Not found");
        });

        it("noContent() returns 204", async () => {
            const manager = createResponseManager();
            let testServer: http.Server;
            let testPort: number;

            testServer = http.createServer((req, res) => {
                const adapter = createHttpResponseAdapter(res);
                const rfm = createResponseFrameworkManager(manager, adapter);
                if (req.url === "/nocontent") {
                    rfm.noContent();
                } else {
                    res.writeHead(404).end();
                }
            });
            await new Promise<void>((resolve) => testServer.listen(0, resolve));
            testPort = (testServer.address() as any).port;

            const res = await new Promise<{ statusCode: number }>((resolve, reject) => {
                const req = http.request(
                    { hostname: "127.0.0.1", port: testPort, path: "/nocontent", method: "GET" },
                    (res) => resolve({ statusCode: res.statusCode ?? 0 }),
                );
                req.on("error", reject);
                req.end();
            });

            await new Promise<void>((resolve) => testServer.close(resolve));
            expect(res.statusCode).toBe(204);
        });
    });
});
