/**
 * @oneunit/core - Simplified DX API
 *
 * Simplified public API with chainable methods and direct access.
 *
 * ```ts
 * import { createApp } from "@oneunit/core";
 *
 * const app = createApp({
 *   serviceName: "my-api",
 *   secret: "my-secret",
 *   security: { cors: { origin: "*" }, csrf: true, helmet: true },
 *   cookie: { secure: true, sameSite: "lax" },
 *   multipart: { maxFileSize: 10 * 1024 * 1024 },
 * });
 *
 * // Direct security methods (no app.security().cors())
 * app.use(app.cors({ origin: "*" }));
 * app.use(app.csrf({ secret: "my-secret" }));
 * app.use(app.helmet());
 * app.use(app.rateLimit({ maxRequests: 100 }));
 *
 * // Cookies - auto-detects framework
 * app.cookies(req, res).set("session", "abc123", { httpOnly: true });
 *
 * // Response - auto-detects framework
 * app.response(req, res).ok({ data: { id: 1 } });
 *
 * // Health
 * app.health().register("db", async () => ({ status: "healthy" }));
 * await app.health().route(server);
 * ```
 */

import { createApp as createCoreApp, type AppOptions } from "../core.js";
import { createRateLimit } from "../security/rate-limit.js";
import type { RateLimitMiddleware, RateLimitOptions } from "../security/types.js";
import type { CorsOptions } from "../security/cors.js";
import type { CsrfOptions } from "../security/csrf.js";
import type { HelmetOptions } from "../security/helmet.js";
import type { CompressionOptions } from "../security/compression.js";
import type { SanitizeOptions } from "../security/sanitize.js";
import type { MultipartMiddleware, MultipartOptions } from "../multipart/index.js";

export interface CoreApp {
  cors: (options?: CorsOptions) => any;
  csrf: (options?: CsrfOptions) => any;
  helmet: (options?: HelmetOptions) => any;
  compression: (options?: CompressionOptions) => any;
  sanitize: (options?: SanitizeOptions) => any;
  rateLimit: (options?: RateLimitOptions) => RateLimitMiddleware;
  cookies: (req?: unknown, res?: unknown) => any;
  response: (req?: unknown, res?: unknown) => any;
  multipart: (options?: MultipartOptions) => MultipartMiddleware;
  use: (middleware: (req: unknown, res: unknown, next?: () => void) => void | Promise<void>) => CoreApp;
  apply: (middleware: any, req: unknown, res: unknown, next?: () => void) => void;
  health: () => any;
  hooks: () => any;
  config: () => any;
  lib: () => any;
  msgpack: () => any;
  lifecycle: () => any;
}

export function createApp(options?: AppOptions): CoreApp {
  const app = createCoreApp(options);

  app.lifecycle().initialize();

  const coreApp: CoreApp = {
    cors: (options) => app.security().cors(options),
    csrf: (options) => app.security().csrf(options),
    helmet: (options) => app.security().helmet(options),
    compression: (options) => app.security().compression(options),
    sanitize: (options) => app.security().sanitize(options),
    rateLimit: (options) => createRateLimit(options),

    cookies: (req?: unknown, res?: unknown) => app.cookies(req, res),

    response: (req?: unknown, res?: unknown) => app.response(req, res),

    multipart: (options?) => app.multipart().multipart(options),

    use: (middleware) => {
      app.use(middleware);
      return coreApp;
    },

    apply: (middleware, req, res, next) => {
      middleware.middleware(req, res, next);
    },

    health: () => app.health(),
    hooks: () => app.hooks(),
    config: () => app.config(),
    lib: () => app.lib(),
    msgpack: () => app.msgpack(),
    lifecycle: () => app.lifecycle(),
  };

  return coreApp;
}
