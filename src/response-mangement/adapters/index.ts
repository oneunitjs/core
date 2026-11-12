export { createExpressAdapter } from "./express.js";
export { createFastifyAdapter } from "./fastify.js";
export { createKoaAdapter } from "./koa.js";
export { createHttpAdapter } from "./http.js";

export type {
    ResponseFrameworkAdapter,
    FastifyLikeReply,
    ExpressLikeResponse,
    KoaLikeContext,
    HttpLikeServerResponse,
} from "./types.js";
