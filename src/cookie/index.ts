import {
    createExpressCookieAdapter,
} from "../adapters/cookie/express.js";
import {
    createFastifyCookieAdapter,
} from "../adapters/cookie/fastify.js";
import {
    createKoaCookieAdapter,
} from "../adapters/cookie/koa.js";
import {
    createHttpCookieAdapter,
} from "../adapters/cookie/http.js";
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