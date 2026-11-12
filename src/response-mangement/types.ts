export type HttpStatusCode =
    | 100 | 101 | 102 | 103
    | 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226
    | 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308
    | 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 421 | 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451
    | 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511;

export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NON_AUTHORITATIVE_INFORMATION: 203,
    NO_CONTENT: 204,
    RESET_CONTENT: 205,
    PARTIAL_CONTENT: 206,
    MULTI_STATUS: 207,
    ALREADY_REPORTED: 208,
    IM_USED: 226,
    MULTIPLE_CHOICES: 300,
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    SEE_OTHER: 303,
    NOT_MODIFIED: 304,
    USE_PROXY: 305,
    TEMPORARY_REDIRECT: 307,
    PERMANENT_REDIRECT: 308,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    PAYMENT_REQUIRED: 402,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    NOT_ACCEPTABLE: 406,
    PROXY_AUTHENTICATION_REQUIRED: 407,
    REQUEST_TIMEOUT: 408,
    CONFLICT: 409,
    GONE: 410,
    LENGTH_REQUIRED: 411,
    PRECONDITION_FAILED: 412,
    PAYLOAD_TOO_LARGE: 413,
    URI_TOO_LONG: 414,
    UNSUPPORTED_MEDIA_TYPE: 415,
    RANGE_NOT_SATISFIABLE: 416,
    EXPECTATION_FAILED: 417,
    IM_A_TEAPOT: 418,
    MISDIRECTED_REQUEST: 421,
    UNPROCESSABLE_ENTITY: 422,
    LOCKED: 423,
    FAILED_DEPENDENCY: 424,
    TOO_EARLY: 425,
    UPGRADE_REQUIRED: 426,
    PRECONDITION_REQUIRED: 428,
    TOO_MANY_REQUESTS: 429,
    REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
    UNAVAILABLE_FOR_LEGAL_REASONS: 451,
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
    HTTP_VERSION_NOT_SUPPORTED: 505,
    VARIANT_ALSO_NEGOTIATES: 506,
    INSUFFICIENT_STORAGE: 507,
    LOOP_DETECTED: 508,
    NOT_EXTENDED: 510,
    NETWORK_AUTHENTICATION_REQUIRED: 511,
} as const;

export type HttpStatusCodeValue = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

export const BODYLESS_STATUSES: readonly HttpStatusCodeValue[] = [
    HTTP_STATUS.NO_CONTENT,
    HTTP_STATUS.RESET_CONTENT,
    HTTP_STATUS.NOT_MODIFIED,
];

export const isBodylessStatus = (status: number): boolean => {
    return BODYLESS_STATUSES.includes(status as HttpStatusCodeValue);
};

export const isClientError = (status: number): boolean => {
    return status >= 400 && status < 500;
};

export const isServerError = (status: number): boolean => {
    return status >= 500 && status < 600;
};

export const isSuccess = (status: number): boolean => {
    return status >= 200 && status < 300;
};

export const isRedirection = (status: number): boolean => {
    return status >= 300 && status < 400;
};

export type ResponseHeaders = Record<string, string | string[]>;

export interface FieldError {
    field: string;
    message: string;
    code?: string;
}

export interface SuccessResponse<T = unknown> {
    success: true;
    code: string;
    msg: string;
    data?: T;
    metadata?: Record<string, unknown>;
    errors?: never;
}

export interface ErrorResponse {
    success: false;
    code: string;
    msg: string;
    data?: never;
    metadata?: Record<string, unknown>;
    errors?: FieldError[];
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export interface ResponseOptions<T = unknown> {
    message?: string;
    data?: T;
    code?: string;
    metadata?: Record<string, unknown>;
    headers?: ResponseHeaders;
}

export interface SuccessOptions<T = unknown> extends ResponseOptions<T> {
    status?: number;
}

export interface ErrorOptions<T = unknown> extends ResponseOptions<T> {
    errors?: FieldError[];
}

export interface ErrorResponseOptions extends ErrorOptions {
    status: number;
}

export interface PaginationMeta {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface PaginatedOptions<T> extends ResponseOptions<T[]> {
    data: T[];
    pagination: PaginationMeta;
}

export interface RespondOptions<T = unknown> {
    status: number;
    response?: ResponseOptions<T>;
    errors?: FieldError[];
}

export interface ResponseManagementOptions {
    defaultSuccessMessage?: string;
    defaultErrorMessage?: string;
    includeRequestId?: boolean;
}

export type ResponseManagementPluginOptions = ResponseManagementOptions;

export const DEFAULT_RESPONSE_CONFIG: Required<Pick<ResponseManagementOptions, "defaultSuccessMessage" | "defaultErrorMessage">> = {
    defaultSuccessMessage: "Success",
    defaultErrorMessage: "Error",
};

export const ERROR_RESPONSES = {
    badRequest: { status: 400, message: "Bad request" },
    unauthorized: { status: 401, message: "Authentication required" },
    forbidden: { status: 403, message: "Access forbidden" },
    notFound: { status: 404, message: "Resource not found" },
    methodNotAllowed: { status: 405, message: "Method not allowed" },
    conflict: { status: 409, message: "Resource conflict" },
    validationError: { status: 422, message: "Validation failed" },
    tooManyRequests: { status: 429, message: "Too many requests" },
    serverError: { status: 500, message: "Internal server error" },
    badGateway: { status: 502, message: "Bad gateway" },
    serviceUnavailable: { status: 503, message: "Service unavailable" },
    gatewayTimeout: { status: 504, message: "Gateway timeout" },
} as const satisfies Record<string, { status: number; message: string }>;

export const SUCCESS_RESPONSES = {
    ok: { status: 200, message: "Success" },
    created: { status: 201, message: "Resource created successfully" },
    accepted: { status: 202, message: "Request accepted" },
} as const satisfies Record<string, { status: number; message: string }>;

export type ErrorResponseName = keyof typeof ERROR_RESPONSES;
export type SuccessResponseName = keyof typeof SUCCESS_RESPONSES;

export type {
    ResponseFrameworkAdapter,
    FastifyLikeReply,
    ExpressLikeResponse,
    KoaLikeContext,
    HttpLikeServerResponse,
} from "./adapters/types.js";
