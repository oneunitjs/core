import express from "express";
import { createApp } from "@oneunit/core";

const app = createApp({
  serviceName: "express-api",
  port: 3000,
  host: "localhost",
  secret: process.env.APP_SECRET,
  security: {
    cors: { origin: "*" },
    helmet: { enabled: true },
  },
  cookie: { secure: false, sameSite: "lax" },
});

const expressApp = express();

expressApp.use(app.cors());
expressApp.use(app.helmet());

expressApp.get("/health", async (_req, res) => {
  const result = await app.health().check();
  res.json(result);
});

expressApp.get("/", (_req, res) => {
  app.response(_req, res).ok({ data: { message: "hello from express + @oneunit/core" } });
});

expressApp.listen(app.config().port, () => {
  console.log(`Express server listening on http://${app.config().host}:${app.config().port}`);
});
