/**
 * @oneunit/core - Request Context Adapters
 *
 * Framework-specific middleware adapters for the request context system.
 * Provides seamless integration with Express, Fastify, Koa, and node:http.
 *
 * ```ts
 * import { createRequestContext } from "@oneunit/core";
 * import { createExpressContextAdapter } from "@oneunit/core";
 *
 * const ctx = createRequestContext();
 * const app = express();
 * app.use(createExpressContextAdapter(ctx).middleware());
 * ```
 */

export {
    ExpressContextAdapter,
    createExpressContextAdapter,
} from "./express.js";
export {
    FastifyContextAdapter,
    createFastifyContextAdapter,
} from "./fastify.js";
export {
    KoaContextAdapter,
    createKoaContextAdapter,
} from "./koa.js";
export {
    HttpContextAdapter,
    createHttpContextAdapter,
} from "./http.js";
export type {
    ContextAdapter,
    FrameworkName,
    ContextAdapterOptions,
} from "./types.js";
