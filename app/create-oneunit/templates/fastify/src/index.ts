import Fastify from "fastify";
import { createApp } from "@oneunit/core";

const app = createApp({
  serviceName: "fastify-api",
  port: 3000,
  host: "localhost",
  secret: process.env.APP_SECRET,
  security: {
    cors: { origin: "*" },
    helmet: { enabled: true },
  },
  cookie: { secure: false, sameSite: "lax" },
});

const fastify = Fastify({ logger: true });

fastify.register(async function (instance) {
  instance.addHook("onRequest", (req, reply, done) => {
    const middleware = app.cors();
    middleware(req.raw, reply.raw, (err?: unknown) => {
      if (err) {
        reply.send(err);
        return;
      }
      done();
    });
  });

  instance.get("/health", async () => {
    return app.health().check();
  });

  instance.get("/", async (_req, reply) => {
    const resp = app.response(_req.raw, reply.raw);
    resp.ok({ data: { message: "hello from fastify + @oneunit/core" } });
  });
});

const address = await fastify.listen({
  port: app.config().port,
  host: app.config().host,
});
console.log(`Fastify server listening on ${address}`);
