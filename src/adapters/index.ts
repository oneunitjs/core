/**
 * Centralized adapter module for @oneunit/core.
 *
 * All adapter implementations (cookie, response, middleware, health) are
 * consolidated here with a unified architectural pattern based on abstract
 * base classes. This eliminates code duplication across framework-specific
 * implementations and enforces a consistent interface.
 *
 * Adapter Categories:
 *  - Cookie: Read/write HTTP cookies across frameworks
 *  - Response: Send HTTP responses across frameworks
 *  - Middleware: Adapt lifecycle middleware to framework middleware
 *  - Health: Register health check routes on framework servers
 *
 * Supported Frameworks: express, fastify, koa, http
 */

// Types (shared across all adapter categories)
export type {
    BaseAdapter,
    FrameworkName,
    AdapterConfig,
    AdapterRegistrationResult,
    AdapterEntry,
    AdapterError,
    AdapterNotFoundError,
    AdapterAlreadyRegisteredError,
    AdapterNotInitializedError,
} from "./types.js";

// Registry
export { AdapterRegistry, defaultAdapterRegistry } from "./registry.js";

// Cookie adapters
export {
    ExpressCookieAdapter,
    createExpressCookieAdapter,
    FastifyCookieAdapter,
    createFastifyCookieAdapter,
    KoaCookieAdapter,
    createKoaCookieAdapter,
    HttpCookieAdapter,
    createHttpCookieAdapter,
    type BaseCookieAdapter,
    type CookieAdapterConfig,
} from "./cookie/index.js";

// Response adapters
export {
    ExpressResponseAdapter,
    createExpressResponseAdapter,
    FastifyResponseAdapter,
    createFastifyResponseAdapter,
    KoaResponseAdapter,
    createKoaResponseAdapter,
    HttpResponseAdapter,
    createHttpResponseAdapter,
    type BaseResponseAdapter,
    type ResponseAdapterConfig,
    type SendPayload,
} from "./response/index.js";

// Middleware adapters
export {
    ExpressMiddlewareAdapter,
    createExpressMiddlewareAdapter,
    FastifyMiddlewareAdapter,
    createFastifyMiddlewareAdapter,
    KoaMiddlewareAdapter,
    createKoaMiddlewareAdapter,
    HttpMiddlewareAdapter,
    createHttpMiddlewareAdapter,
    type BaseMiddlewareAdapter,
    type MiddlewareAdapterConfig,
} from "./middleware/index.js";

// Health adapters
export {
    ExpressHealthAdapter,
    createExpressHealthAdapter,
    FastifyHealthAdapter,
    createFastifyHealthAdapter,
    KoaHealthAdapter,
    createKoaHealthAdapter,
    HttpHealthAdapter,
    createHttpHealthAdapter,
    type BaseHealthAdapter,
    type HealthAdapterConfig,
    type HealthAdapterResult,
} from "./health/index.js";
