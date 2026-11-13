import type {
    SuccessOptions,
    ErrorOptions,
    ErrorResponseOptions,
    PaginatedOptions,
    RespondOptions,
    ResponseManagementOptions,
    SuccessResponse,
    ErrorResponse,
    FieldError,
    HttpStatusCodeValue,
    ErrorResponseName,
    SuccessResponseName,
    PaginationMeta,
    ResponseHeaders,
    ResponseFrameworkAdapter,
    FastifyLikeReply,
    ExpressLikeResponse,
    KoaLikeContext,
    HttpLikeServerResponse,
} from "./types.js";
// eslint-disable-next-line no-duplicate-imports -- verbatimModuleSyntax requires separate type/value imports
import {
    HTTP_STATUS,
    isBodylessStatus,
    isClientError,
    isServerError,
    isSuccess,
    isRedirection,
    DEFAULT_RESPONSE_CONFIG,
} from "./types.js";
import {
    createExpressAdapter,
    createFastifyAdapter,
    createKoaAdapter,
    createHttpAdapter,
} from "./adapters/index.js";

export { createExpressAdapter, createFastifyAdapter, createKoaAdapter, createHttpAdapter };

export class ResponseManager {
    private readonly defaultSuccessMessage: string;
    private readonly defaultErrorMessage: string;

    constructor(options: ResponseManagementOptions = {}) {
        this.defaultSuccessMessage = options.defaultSuccessMessage ?? DEFAULT_RESPONSE_CONFIG.defaultSuccessMessage;
        this.defaultErrorMessage = options.defaultErrorMessage ?? DEFAULT_RESPONSE_CONFIG.defaultErrorMessage;
    }

    success<T = unknown>(options: SuccessOptions<T> = {}): SuccessResponse<T> {
        const status = options.status ?? HTTP_STATUS.OK;
        validateStatus(status, "success");

        return {
            success: true,
            code: String(status),
            msg: options.message ?? this.defaultSuccessMessage,
            data: options.data,
            metadata: options.metadata,
        } as SuccessResponse<T>;
    }

    error(options: ErrorResponseOptions): ErrorResponse {
        validateStatus(options.status, "error");

        return {
            success: false,
            code: String(options.status),
            msg: options.message ?? this.defaultErrorMessage,
            data: options.data,
            metadata: options.metadata,
            errors: options.errors,
        } as ErrorResponse;
    }

    paginated<T = unknown>(options: PaginatedOptions<T>): SuccessResponse<T[]> {
        const pagination = validatePagination(options.pagination);

        return {
            success: true,
            code: "200",
            msg: options.message ?? this.defaultSuccessMessage,
            data: options.data,
            metadata: { pagination },
        } as SuccessResponse<T[]>;
    }

    static pagination(total: number, page: number, pageSize: number): PaginationMeta {
        return validatePagination({ total, page, pageSize });
    }
}

function validatePagination(
    pagination: Pick<PaginationMeta, "total" | "page" | "pageSize">,
): PaginationMeta {
    if (
        !Number.isSafeInteger(pagination.total) ||
        pagination.total < 0
    ) {
        throw new RangeError("total must be a non-negative integer");
    }

    if (
        !Number.isSafeInteger(pagination.page) ||
        pagination.page < 1
    ) {
        throw new RangeError("page must be a positive integer");
    }

    if (
        !Number.isSafeInteger(pagination.pageSize) ||
        pagination.pageSize < 1
    ) {
        throw new RangeError("pageSize must be a positive integer");
    }

    return {
        total: pagination.total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(pagination.total / pagination.pageSize),
    };
}

export function validateStatus(
    status: number,
    allowedRange: "success" | "error" | "any",
): void {
    if (!Number.isInteger(status) || status < 200 || status > 599) {
        throw new RangeError(`Invalid HTTP status: ${status}`);
    }

    if (allowedRange === "success") {
        if (!isSuccess(status) || isBodylessStatus(status)) {
            throw new RangeError("Invalid success response status");
        }
    }

    if (allowedRange === "error") {
        if (!isClientError(status) && !isServerError(status)) {
            throw new RangeError("Invalid error response status");
        }
    }
}

export function createResponseManager(options: ResponseManagementOptions = {}): ResponseManager {
    return new ResponseManager(options);
}

export function createResponseFrameworkManager(
    manager: ResponseManager,
    adapter: ResponseFrameworkAdapter
): ResponseFrameworkManager {
    return new ResponseFrameworkManager(manager, adapter);
}

export class ResponseFrameworkManager {
    private manager: ResponseManager;
    private adapter: ResponseFrameworkAdapter;

    constructor(manager: ResponseManager, adapter: ResponseFrameworkAdapter) {
        this.manager = manager;
        this.adapter = adapter;
    }

    get adapterName(): string {
        return this.adapter.name;
    }

    private sendEnvelope(
        status: number,
        body: unknown,
        extraHeaders?: ResponseHeaders,
    ): void {
        const headers: ResponseHeaders = { "content-type": "application/json" };

        if (extraHeaders) {
            for (const [key, value] of Object.entries(extraHeaders)) {
                if (key.toLowerCase() === "content-type") {
                    continue;
                }
                headers[key] = value;
            }
        }

        this.adapter.send({
            status,
            body,
            headers,
        });
    }

    success(options: SuccessOptions = {}): void {
        const response = this.manager.success(options);
        const status = options.status ?? HTTP_STATUS.OK;
        this.sendEnvelope(status, response, options.headers);
    }

    error(options: ErrorResponseOptions): void {
        const response = this.manager.error(options);
        this.sendEnvelope(options.status, response, options.headers);
    }

    paginated<T = unknown>(options: PaginatedOptions<T>): void {
        const response = this.manager.paginated(options);
        this.sendEnvelope(HTTP_STATUS.OK, response, options.headers);
    }

    respond<T = unknown>(options: RespondOptions<T>): void {
        const { status, response = {}, errors } = options;

        validateStatus(status, "any");

        if (isRedirection(status) && status !== HTTP_STATUS.NOT_MODIFIED) {
            throw new RangeError("Use redirect handling for 3xx responses");
        }

        if (isBodylessStatus(status)) {
            if (hasEnvelopeContent(response as Record<string, unknown>) || errors !== undefined) {
                throw new RangeError(`${status} responses cannot include this response envelope`);
            }
            this.adapter.send({
                status,
                body: undefined,
                headers: {},
            });
            return;
        }

        if (status >= 400) {
            const responseWithErrors = response as ErrorOptions<T> & { errors?: FieldError[] };
            if (responseWithErrors.errors !== undefined && errors !== undefined) {
                throw new RangeError(
                    "Pass field errors either as `response.errors` or as `errors`, not both",
                );
            }
            this.sendEnvelope(
                status,
                this.manager.error({
                    ...response,
                    ...(errors !== undefined ? { errors } : {}),
                    status,
                }),
                response.headers,
            );
            return;
        }

        if (errors !== undefined || (response as ErrorOptions<T> & { errors?: FieldError[] }).errors !== undefined) {
            throw new RangeError("Field errors are only valid on 4xx/5xx responses");
        }

        this.sendEnvelope(
            status,
            this.manager.success({ ...response, status } as SuccessOptions<T>),
            response.headers,
        );
    }

    ok<T = unknown>(options: SuccessOptions<T> = {}): void {
        this.respond({
            status: HTTP_STATUS.OK,
            response: options,
        });
    }

    created<T = unknown>(options: SuccessOptions<T> = {}): void {
        this.respond({
            status: HTTP_STATUS.CREATED,
            response: options,
        });
    }

    accepted<T = unknown>(options: SuccessOptions<T> = {}): void {
        this.respond({
            status: HTTP_STATUS.ACCEPTED,
            response: options,
        });
    }

    noContent(): void {
        this.adapter.send({
            status: HTTP_STATUS.NO_CONTENT,
            body: undefined,
            headers: {},
        });
    }

    badRequest<T = unknown>(options?: ErrorOptions<T>): void {
        this.respond({
            status: HTTP_STATUS.BAD_REQUEST,
            response: options,
        });
    }

    unauthorized<T = unknown>(options?: ErrorOptions<T>): void {
        this.respond({
            status: HTTP_STATUS.UNAUTHORIZED,
            response: options,
        });
    }

    forbidden<T = unknown>(options?: ErrorOptions<T>): void {
        this.respond({
            status: HTTP_STATUS.FORBIDDEN,
            response: options,
        });
    }

    notFound<T = unknown>(options?: ErrorOptions<T>): void {
        this.respond({
            status: HTTP_STATUS.NOT_FOUND,
            response: options,
        });
    }

    conflict<T = unknown>(options?: ErrorOptions<T>): void {
        this.respond({
            status: HTTP_STATUS.CONFLICT,
            response: options,
        });
    }

    unprocessable<T = unknown>(options?: ErrorOptions<T>): void {
        this.respond({
            status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
            response: options,
        });
    }

    internalServerError<T = unknown>(options?: ErrorOptions<T>): void {
        this.respond({
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            response: options,
        });
    }

    notImplemented<T = unknown>(options?: ErrorOptions<T>): void {
        this.respond({
            status: HTTP_STATUS.NOT_IMPLEMENTED,
            response: options,
        });
    }

    badGateway<T = unknown>(options?: ErrorOptions<T>): void {
        this.respond({
            status: HTTP_STATUS.BAD_GATEWAY,
            response: options,
        });
    }

    serviceUnavailable<T = unknown>(options?: ErrorOptions<T>): void {
        this.respond({
            status: HTTP_STATUS.SERVICE_UNAVAILABLE,
            response: options,
        });
    }

    gatewayTimeout<T = unknown>(options?: ErrorOptions<T>): void {
        this.respond({
            status: HTTP_STATUS.GATEWAY_TIMEOUT,
            response: options,
        });
    }
}

function hasEnvelopeContent(obj: Record<string, unknown>): boolean {
    return obj !== undefined && obj !== null && Object.keys(obj).length > 0;
}

export function respondTo<T = unknown>(
    manager: ResponseManager,
    adapter: ResponseFrameworkAdapter,
    options: RespondOptions<T>
): void {
    createResponseFrameworkManager(manager, adapter).respond(options);
}

export function ok<T = unknown>(
    manager: ResponseManager,
    adapter: ResponseFrameworkAdapter,
    options: SuccessOptions<T> = {}
): void {
    createResponseFrameworkManager(manager, adapter).ok(options);
}

export function created<T = unknown>(
    manager: ResponseManager,
    adapter: ResponseFrameworkAdapter,
    options: SuccessOptions<T> = {}
): void {
    createResponseFrameworkManager(manager, adapter).created(options);
}

export function notFound<T = unknown>(
    manager: ResponseManager,
    adapter: ResponseFrameworkAdapter,
    options: ErrorOptions<T> = {}
): void {
    createResponseFrameworkManager(manager, adapter).notFound(options);
}

export function error(
    manager: ResponseManager,
    adapter: ResponseFrameworkAdapter,
    options: ErrorResponseOptions
): void {
    createResponseFrameworkManager(manager, adapter).error(options);
}

export type {
    FastifyLikeReply,
    ExpressLikeResponse,
    KoaLikeContext,
    HttpLikeServerResponse,
    HttpStatusCodeValue,
    ErrorResponseName,
    SuccessResponseName,
};

export interface DetectedResponseFramework {
    framework: "express" | "fastify" | "koa" | "http" | "unknown";
    confidence: "high" | "low";
}

export function detectResponseFramework(
    req: any = undefined,
    res: any = undefined,
    ctx: any = undefined,
): DetectedResponseFramework {
    if (ctx?.cookies) {
        return { framework: "koa", confidence: "high" };
    }

    if (res?.raw?.send && res?.code) {
        return { framework: "fastify", confidence: "high" };
    }

    if (res?.status && res?.json && res?.send) {
        return { framework: "express", confidence: "high" };
    }

    if (req?.headers?.cookie) {
        return { framework: "express", confidence: "low" };
    }

    if (res?.setHeader) {
        return { framework: "http", confidence: "low" };
    }

    return { framework: "unknown", confidence: "low" };
}
