import {
    createExpressCookieAdapter,
} from "./adapters/express.js";
import {
    createFastifyCookieAdapter,
} from "./adapters/fastify.js";
import {
    createKoaCookieAdapter,
} from "./adapters/koa.js";
import {
    createHttpCookieAdapter,
} from "./adapters/http.js";
import {
    createCookieStore,
    createCookieStoreFromAdapter,
    createDetectedCookieStore,
    detectCookieFramework,
    DEFAULT_COOKIE_CONFIG,
    mergeCookieOptions,
} from "./registery.js";

export {
    createExpressCookieAdapter,
    createFastifyCookieAdapter,
    createKoaCookieAdapter,
    createHttpCookieAdapter,
    createCookieStore,
    createCookieStoreFromAdapter,
    createDetectedCookieStore,
    detectCookieFramework,
    DEFAULT_COOKIE_CONFIG,
    mergeCookieOptions,
};