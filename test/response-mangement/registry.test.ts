import { describe, it, expect } from "vitest";
import {
    ResponseManager,
    createResponseManager,
    HTTP_STATUS,
    ERROR_RESPONSES,
    SUCCESS_RESPONSES,
    BODYLESS_STATUSES,
    createResponseFrameworkManager,
    createExpressResponseAdapter,
    createFastifyResponseAdapter,
    createKoaResponseAdapter,
    createHttpResponseAdapter,
} from "../../src/response-mangement/index.js";

describe("HTTP_STATUS", () => {
    it("has standard HTTP status codes", () => {
        expect(HTTP_STATUS.OK).toBe(200);
        expect(HTTP_STATUS.CREATED).toBe(201);
        expect(HTTP_STATUS.NOT_FOUND).toBe(404);
        expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    });
});

describe("ResponseManager", () => {
    it("creates a successful response", () => {
        const manager = new ResponseManager();
        const response = manager.success({ status: 201, data: { id: 1 }, message: "Created" });

        expect(response.success).toBe(true);
        expect(response.code).toBe("201");
        expect(response.msg).toBe("Created");
        expect(response.data).toEqual({ id: 1 });
    });

    it("uses default service message", () => {
        const manager = new ResponseManager();
        const response = manager.success({ data: { id: 1 } });

        expect(response.msg).toBe("Success");
    });

    it("creates an error response", () => {
        const manager = new ResponseManager();
        const response = manager.error({
            status: 404,
            message: "Not found",
            errors: [{ field: "email", message: "Email not found" }],
        });

        expect(response.success).toBe(false);
        expect(response.code).toBe("404");
        expect(response.msg).toBe("Not found");
        expect(response.errors).toEqual([{ field: "email", message: "Email not found" }]);
    });

    it("creates a paginated response", () => {
        const manager = new ResponseManager();
        const response = manager.paginated({
            data: [{ id: 1 }],
            pagination: ResponseManager.pagination(10, 1, 10),
        });

        expect(response.success).toBe(true);
        expect(response.data).toEqual([{ id: 1 }]);
        expect(response.metadata?.pagination).toEqual({
            total: 10,
            page: 1,
            pageSize: 10,
            totalPages: 1,
        });
    });

    it("validates pagination", () => {
        expect(() =>
            ResponseManager.pagination(10, 0, 10)
        ).toThrow(RangeError);
        expect(() =>
            ResponseManager.pagination(10, 1, 0)
        ).toThrow(RangeError);
    });

    it("validates status codes", () => {
        const manager = new ResponseManager();
        expect(() => manager.success({ status: 999 } as any)).toThrow(RangeError);
        expect(() => manager.error({ status: 999 })).toThrow(RangeError);
    });

    it("rejects body for bodyless statuses", () => {
        const manager = new ResponseManager();
        expect(() => manager.success({ status: 204 } as any)).toThrow(RangeError);
        expect(() => manager.success({ status: 304 } as any)).toThrow(RangeError);
    });
});

describe("createResponseManager", () => {
    it("creates a manager with custom options", () => {
        const manager = createResponseManager({
            defaultSuccessMessage: "Custom success",
            defaultErrorMessage: "Custom error",
        });

        const response = manager.success({});
        expect(response.msg).toBe("Custom success");

        const error = manager.error({ status: 400 });
        expect(error.msg).toBe("Custom error");
    });
});

describe("createResponseFrameworkManager with Express adapter", () => {
    it("sends success response", () => {
        let statusCode: number | undefined;
        let body: unknown;
        let headers: Record<string, string> | undefined;

        const res: any = {
            status: (code: number) => { statusCode = code; return res; },
            json: (b: unknown) => { body = b; return res; },
            send: () => res,
            end: () => res,
            set: (name: string, value: string) => { headers = { [name]: value }; return res; },
            type: () => res,
            get: () => undefined,
            removeHeader: () => {},
        };

        const adapter = createExpressResponseAdapter(res);
        const manager = new ResponseManager();
        const rfm = createResponseFrameworkManager(manager, adapter);

        rfm.success({ status: 201, data: { id: 1 }, message: "Created" });

        expect(statusCode).toBe(201);
        expect(body).toEqual({ success: true, code: "201", msg: "Created", data: { id: 1 } });
        expect(headers).toEqual({ "content-type": "application/json" });
    });

    it("sends error response", () => {
        let statusCode: number | undefined;
        let body: unknown;

        const res: any = {
            status: (code: number) => { statusCode = code; return res; },
            json: (b: unknown) => { body = b; return res; },
            send: () => res,
            end: () => res,
            set: () => res,
            type: () => res,
            get: () => undefined,
            removeHeader: () => {},
        };

        const adapter = createExpressResponseAdapter(res);
        const manager = new ResponseManager();
        const rfm = createResponseFrameworkManager(manager, adapter);

        rfm.error({ status: 404, message: "Not found" });

        expect(statusCode).toBe(404);
        expect(body).toEqual({ success: false, code: "404", msg: "Not found" });
    });

    it("sends no content response", () => {
        let statusCode: number | undefined;

        const res: any = {
            status: (code: number) => { statusCode = code; return res; },
            send: () => res,
            end: () => res,
            json: () => res,
            set: () => res,
            type: () => res,
            get: () => undefined,
            removeHeader: () => {},
        };

        const adapter = createExpressResponseAdapter(res);
        const manager = new ResponseManager();
        const rfm = createResponseFrameworkManager(manager, adapter);

        rfm.noContent();

        expect(statusCode).toBe(204);
    });
});

describe("createResponseFrameworkManager with Fastify adapter", () => {
    it("sends success response", () => {
        let statusCode: number | undefined;
        let body: unknown;

        const reply: any = {
            code: (code: number) => { statusCode = code; return reply; },
            send: (b: unknown) => { body = b; return reply; },
            header: () => reply,
            type: () => reply,
            getHeader: () => undefined,
            removeHeader: () => {},
        };

        const adapter = createFastifyResponseAdapter(reply);
        const manager = new ResponseManager();
        const rfm = createResponseFrameworkManager(manager, adapter);

        rfm.ok({ message: "Hello", data: { x: 1 } });

        expect(statusCode).toBe(200);
        expect(body).toEqual({ success: true, code: "200", msg: "Hello", data: { x: 1 } });
    });
});

describe("createResponseFrameworkManager with Koa adapter", () => {
    it("sends success response", () => {
        let body: unknown;

        const ctx: any = {
            status: 200,
            body: undefined,
            set: () => {},
            append: () => {},
            get: () => undefined,
            remove: () => {},
            type: "text/plain",
            request: { id: "req-123" },
        };

        const adapter = createKoaResponseAdapter(ctx);
        const manager = new ResponseManager();
        const rfm = createResponseFrameworkManager(manager, adapter);

        rfm.ok({ message: "Hello" });

        expect(ctx.status).toBe(200);
        expect(ctx.body).toEqual({ success: true, code: "200", msg: "Hello" });
    });
});

describe("createResponseFrameworkManager with node:http adapter", () => {
    it("sends success response", () => {
        let statusCode: number | undefined;
        let headers: Record<string, string> | undefined;
        let body: string | undefined;

        const res: any = {
            writeHead: (code: number, h?: Record<string, string>) => {
                statusCode = code;
                headers = h;
            },
            end: (data?: string) => { body = data; },
            getHeader: () => undefined,
            removeHeader: () => {},
            request: { id: "req-123" },
        };

        const adapter = createHttpResponseAdapter(res);
        const manager = new ResponseManager();
        const rfm = createResponseFrameworkManager(manager, adapter);

        rfm.ok({ message: "Hello" });

        expect(statusCode).toBe(200);
        expect(body).toContain('"msg":"Hello"');
        expect(headers).toEqual({ "content-type": "application/json" });
    });
});

describe("ERROR_RESPONSES and SUCCESS_RESPONSES", () => {
    it("has standard error responses", () => {
        expect(ERROR_RESPONSES.notFound).toEqual({ status: 404, message: "Resource not found" });
        expect(ERROR_RESPONSES.unauthorized).toEqual({ status: 401, message: "Authentication required" });
    });

    it("has standard success responses", () => {
        expect(SUCCESS_RESPONSES.ok).toEqual({ status: 200, message: "Success" });
        expect(SUCCESS_RESPONSES.created).toEqual({ status: 201, message: "Resource created successfully" });
    });

    it("respond method handles error status", () => {
        let statusCode: number | undefined;
        let body: unknown;

        const res: any = {
            status: (code: number) => { statusCode = code; return res; },
            json: (b: unknown) => { body = b; return res; },
            send: () => res,
            end: () => res,
            set: () => res,
            type: () => res,
            get: () => undefined,
            removeHeader: () => {},
        };

        const adapter = createExpressResponseAdapter(res);
        const manager = new ResponseManager();
        const rfm = createResponseFrameworkManager(manager, adapter);

        rfm.respond({ status: 404, response: { message: "Custom not found" } });

        expect(statusCode).toBe(404);
        expect(body).toEqual({ success: false, code: "404", msg: "Custom not found" });
    });
});
