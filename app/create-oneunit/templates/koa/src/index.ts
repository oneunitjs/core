import Koa from "koa";
import { createApp } from "@oneunit/core";

const app = createApp({
  serviceName: "koa-api",
  port: 3000,
  host: "localhost",
  secret: process.env.APP_SECRET,
  security: {
    cors: { origin: "*" },
    helmet: { enabled: true },
  },
  cookie: { secure: false, sameSite: "lax" },
});

const koa = new Koa();

koa.use(app.cors().middleware);
koa.use(app.helmet());

koa.use(async (ctx) => {
  if (ctx.path === "/health") {
    ctx.body = await app.health().check();
    return;
  }
  app.response(ctx.req, ctx.res).ok({ data: { message: "hello from koa + @oneunit/core" } });
});

koa.listen(app.config().port, app.config().host, () => {
  console.log(`Koa server listening on http://${app.config().host}:${app.config().port}`);
});
