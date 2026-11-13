export { ResponseManager, createResponseManager } from "./registry.js";
export { validateStatus } from "./registry.js";

export type {
    ResponseManagementOptions,
    ResponseManagementPluginOptions,
} from "./types.js";

export type {
    ApiResponse,
    SuccessResponse,
    ErrorResponse,
    FieldError,
    ResponseOptions,
    SuccessOptions,
    ErrorOptions,
    ErrorResponseOptions,
    PaginationMeta,
    PaginatedOptions,
    RespondOptions,
    ResponseHeaders,
} from "./types.js";

export {
    HTTP_STATUS,
    ERROR_RESPONSES,
    SUCCESS_RESPONSES,
    BODYLESS_STATUSES,
    DEFAULT_RESPONSE_CONFIG,
    isBodylessStatus,
    isClientError,
    isServerError,
    isSuccess,
    isRedirection,
} from "./types.js";

export type {
    HttpStatusCode,
    HttpStatusCodeValue,
    ErrorResponseName,
    SuccessResponseName,
} from "./types.js";

export type {
    ResponseFrameworkAdapter,
    FastifyLikeReply,
    ExpressLikeResponse,
    KoaLikeContext,
    HttpLikeServerResponse,
} from "../adapters/response/types.js";

export {
    createFastifyResponseAdapter,
    createExpressResponseAdapter,
    createKoaResponseAdapter,
    createHttpResponseAdapter,
    createResponseFrameworkManager,
    ResponseFrameworkManager,
    detectResponseFramework,
    respondTo,
    ok,
    created,
    notFound,
    error,
} from "./registry.js";

// Backward-compatible aliases
export {
    createExpressResponseAdapter as createExpressAdapter,
    createFastifyResponseAdapter as createFastifyAdapter,
    createKoaResponseAdapter as createKoaAdapter,
    createHttpResponseAdapter as createHttpAdapter,
} from "./registry.js";

export type {
    DetectedResponseFramework,
} from "./registry.js";
