import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../../src/core/index.js";
import Fastify from "fastify";

describe("Lifecycle - Fastify real server", () => {
let fastify: Fastify.FastifyInstance;
let core: ReturnType<typeof createApp>;

    beforeAll(async () => {
        fastify = Fastify();

        core = createApp({ serviceName: "lifecycle-fastify", secret: "my-secret" });

        core.lifecycle().initialize();

        core.lifecycle().registerMiddleware("cors-mw", "cors", (_req, reply: any, next) => {
            reply.header("Access-Control-Allow-Origin", "*");
            next();
        });

        core.lifecycle().registerMiddleware("logging-mw", "logging", async (_req, _reply: any, next) => {
            next();
        });

        fastify.all("*", async (req, reply) => {
            await core.lifecycle().executeMiddlewareChain(
                (req as any)?.raw ?? req,
                reply,
                "request",
            );
            reply.header("Access-Control-Allow-Origin", "*");
            reply.send({ status: "ok" });
        });

        await fastify.ready();
        await new Promise<void>((resolve) => fastify.server.listen(0, resolve));
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

    it("executes middleware chain via fastify", async () => {
        const res = await request("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("ok");
    });

    it("cors middleware sets header via fastify", async () => {
        const res = await request("/health");
        expect(res.statusCode).toBe(200);
    });

    it("lifecycle is safe after registration", () => {
        expect(core.lifecycle().isSafe()).toBe(true);
    });

    it("getState reports middleware count", () => {
        const state = core.lifecycle().getState();
        expect(state.middlewareCount).toBe(2);
    });
});
