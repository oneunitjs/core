/**
 * @oneunit/core - Security Module
 *
 * Security middleware for authentication, authorization, rate limiting,
 * CORS, CSRF protection, security headers, compression, and sanitization.
 *
 * ```ts
 * import { createCors, createCsrf, createHelmet, createCompression, createSanitizer } from "@oneunit/core";
 *
 * const cors = createCors({ origin: "https://example.com" });
 * app.use(cors.middleware());
 *
 * const csrf = createCsrf({ secret: "my-secret" });
 * app.use(csrf.middleware());
 * ```
 */

export {
    createCors,
    type CorsMiddleware,
    type CorsOptions,
} from "./cors.js";
export {
    createCsrf,
    type CsrfMiddleware,
    type CsrfOptions,
} from "./csrf.js";
export {
    createSanitizer,
    sanitizeHtmlContent,
    sanitizeObject,
    type SanitizeOptions,
} from "./sanitize.js";
export { createCompression, type CompressionMiddleware, type CompressionOptions } from "./compression.js";
export { createHelmet, type HelmetMiddleware, type HelmetOptions } from "./helmet.js";
export { createSecurityMiddlewareBase } from "./middleware-base.js";
export { createRateLimit, type RateLimitMiddleware, type RateLimitOptions } from "./rate-limit.js";
