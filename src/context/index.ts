/**
 * @oneunit/core - Request Context
 *
 * Request-scoped storage using Node.js AsyncLocalStorage.
 */

export {
    createRequestContext,
} from "./registery.js";
export {
    ExpressContextAdapter,
    createExpressContextAdapter,
    FastifyContextAdapter,
    createFastifyContextAdapter,
    KoaContextAdapter,
    createKoaContextAdapter,
    HttpContextAdapter,
    createHttpContextAdapter,
} from "./adapters/index.js";
export type {
    RequestContext,
    RequestContextOptions,
} from "./types.js";
export type {
    ContextAdapter,
    FrameworkName,
    ContextAdapterOptions,
} from "./adapters/types.js";
