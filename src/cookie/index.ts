import {
    createExpressCookieAdapter,
} from "../adapters/express/cookie.js";
import {
    createFastifyCookieAdapter,
} from "../adapters/fastify/cookie.js";
import {
    createKoaCookieAdapter,
} from "../adapters/koa/cookie.js";
import {
    createHttpCookieAdapter,
} from "../adapters/universal/cookie.js";
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