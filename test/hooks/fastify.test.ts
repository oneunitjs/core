import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHooks } from "../../src/hooks/index.js";
import Fastify from "fastify";

describe("hooks with Fastify", () => {
    let fastify: any;
    let port: number;

    beforeAll(async () => {
        fastify = Fastify();

        // Framework-agnostic hooks used within Fastify lifecycle
        const hooks = createHooks<{ req: any; reply: any }>();
        const events: string[] = [];

        hooks.on("onRequest", async (ctx) => {
            events.push(`req:${ctx.req.method} ${ctx.req.url}`);
        });
        hooks.on("onSend", async (ctx) => {
            events.push(`send`);
        });

        fastify.addHook("onRequest", async (req, reply) => {
            await hooks.emit("onRequest", { req, reply });
        });

        fastify.addHook("onSend", async (req, reply, payload) => {
            await hooks.emit("onSend", { req, reply });
        });

        fastify.get("/hello", async () => {
            return { message: "hello" };
        });

        await fastify.ready();
        await new Promise<void>((resolve) => fastify.server.listen(0, resolve));
        port = (fastify.server.address() as any).port;
    });

    afterAll(async () => {
        await fastify.close();
    });

    it("fires hooks during Fastify request lifecycle", async () => {
        const res = await fastify.inject({ method: "GET", url: "/hello" });

        expect(res.statusCode).toBe(200);
        expect(res.payload).toContain("hello");
    });
});
