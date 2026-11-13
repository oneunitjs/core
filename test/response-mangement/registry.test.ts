import { describe, it, expect, beforeEach } from "vitest";
import {
    createResponseManager,
    createResponseFrameworkManager,
    createExpressResponseAdapter,
    createFastifyResponseAdapter,
    createKoaResponseAdapter,
    createHttpResponseAdapter,
} from "../../src/response-mangement/index.js";

describe("Response Manager - Success Responses", () => {
    let manager: ReturnType<typeof createResponseManager>;

    beforeEach(() => {
        manager = createResponseManager();
    });

    it("should create OK response", () => {
        const response = manager.success({ data: { id: 1 } });
        expect(response.success).toBe(true);
        expect(response.code).toBe("200");
        expect(response.data).toEqual({ id: 1 });
    });

    it("should use default message when none provided", () => {
        const response = manager.success({});
        expect(response.msg).toBe("Success");
    });

    it("should use custom message when provided", () => {
        const response = manager.success({ message: "Custom success" });
        expect(response.msg).toBe("Custom success");
    });
});

describe("Response Manager - Error Responses", () => {
    let manager: ReturnType<typeof createResponseManager>;

    beforeEach(() => {
        manager = createResponseManager();
    });

    it("should create Bad Request response", () => {
        const response = manager.error({ status: 400, message: "Invalid input" });
        expect(response.success).toBe(false);
        expect(response.code).toBe("400");
        expect(response.msg).toBe("Invalid input");
    });

    it("should create Unauthorized response", () => {
        const response = manager.error({ status: 401, message: "Auth required" });
        expect(response.success).toBe(false);
        expect(response.code).toBe("401");
    });

    it("should create Forbidden response", () => {
        const response = manager.error({ status: 403, message: "Access denied" });
        expect(response.success).toBe(false);
        expect(response.code).toBe("403");
    });

    it("should create Not Found response", () => {
        const response = manager.error({ status: 404, message: "Resource not found" });
        expect(response.success).toBe(false);
        expect(response.code).toBe("404");
    });

    it("should create Internal Server Error response", () => {
        const response = manager.error({ status: 500, message: "Server error" });
        expect(response.success).toBe(false);
        expect(response.code).toBe("500");
    });

    it("should include field errors in response", () => {
        const response = manager.error({ status: 400, message: "Validation failed", errors: [{ field: "email", message: "Invalid email" }, { field: "password", message: "Too short" }] });
        expect(response.errors).toHaveLength(2);
        expect(response.errors?.[0].field).toBe("email");
        expect(response.errors?.[1].field).toBe("password");
    });
});

describe("Response Framework Manager - Express Adapter", () => {
    it("should send response via Express adapter", () => {
        const manager = createResponseManager();
        const adapter = createExpressResponseAdapter({
            set: (key: string, value: string) => { res[key] = value; },
            status: (code: number) => { res.statusCode = code; return res; },
            json: (body: unknown) => { res.body = body; },
            end: () => {},
            type: (t: string) => { res.type = t; return res; },
            headersSent: false,
        } as any);
        const res: any = {};
        const rfm = createResponseFrameworkManager(manager, adapter);
        rfm.ok({ data: { id: 1 } });
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ success: true, code: "200", msg: "Success", data: { id: 1 } });
    });

    it("should send error response via Express adapter", () => {
        const manager = createResponseManager();
        const adapter = createExpressResponseAdapter({
            set: (key: string, value: string) => { res[key] = value; },
            status: (code: number) => { res.statusCode = code; return res; },
            json: (body: unknown) => { res.body = body; },
            end: () => {},
            type: (t: string) => { res.type = t; return res; },
            headersSent: false,
        } as any);
        const res: any = {};
        const rfm = createResponseFrameworkManager(manager, adapter);
        rfm.notFound({ message: "Not found" });
        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe("404");
    });

    it("should send no content response via Express adapter", () => {
        const manager = createResponseManager();
        const adapter = createExpressResponseAdapter({
            set: () => {},
            status: (code: number) => { res.statusCode = code; return res; },
            json: () => {},
            end: () => { res.ended = true; },
            type: (t: string) => { return res; },
            headersSent: false,
        } as any);
        const res: any = {};
        const rfm = createResponseFrameworkManager(manager, adapter);
        rfm.noContent();
        expect(res.statusCode).toBe(204);
        expect(res.ended).toBe(true);
    });
});

describe("Response Framework Manager - Fastify Adapter", () => {
    it("should send response via Fastify adapter", () => {
        const manager = createResponseManager();
        const adapter = createFastifyResponseAdapter({
            sent: false,
            code: (code: number) => { res.statusCode = code; return res; },
            header: (key: string, value: string) => { res[key] = value; return res; },
            send: (body: unknown) => { res.body = body; },
            type: (t: string) => { return res; },
        } as any);
        const res: any = {};
        const rfm = createResponseFrameworkManager(manager, adapter);
        rfm.ok({ data: { id: 1 } });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe("Response Framework Manager - Koa Adapter", () => {
    it("should send response via Koa adapter", () => {
        const manager = createResponseManager();
        const ctx: any = { body: null, status: 200, set: () => {} };
        const adapter = createKoaResponseAdapter(ctx);
        const rfm = createResponseFrameworkManager(manager, adapter);
        rfm.ok({ data: { id: 1 } });
        expect(ctx.status).toBe(200);
        expect(ctx.body.success).toBe(true);
    });
});

describe("Response Framework Manager - HTTP Adapter", () => {
    it("should send response via HTTP adapter", () => {
        const manager = createResponseManager();
        const adapter = createHttpResponseAdapter({
            writeHead: (code: number, headers: Record<string, string>) => { res.statusCode = code; res.headers = headers; },
            end: (data?: string) => { res.body = data; },
        } as any);
        const res: any = {};
        const rfm = createResponseFrameworkManager(manager, adapter);
        rfm.ok({ data: { id: 1 } });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('"success":true');
    });
});

describe("Response Framework Manager - Try/Catch Wrapper", () => {
    it("should catch handler errors and send error response", async () => {
        const manager = createResponseManager();
        const adapter = createExpressResponseAdapter({
            set: () => {},
            status: (code: number) => { res.statusCode = code; return res; },
            json: (body: unknown) => { res.body = body; },
            end: () => {},
            type: () => res,
            headersSent: false,
        } as any);
        const res: any = {};
        const rfm = createResponseFrameworkManager(manager, adapter, {
            tryCatchEnabled: true,
            defaultErrorStatusCode: 500,
        });
        const failingHandler = async (_req: unknown, res: unknown) => {
            throw new Error("Database connection failed");
        };
        const safeHandler = rfm.wrapHandler(failingHandler);
        await safeHandler({}, res);
        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.msg).toBe("Database connection failed");
    });

    it("should not wrap handler when tryCatchEnabled is false", async () => {
        const manager = createResponseManager();
        const adapter = createExpressResponseAdapter({
            set: () => {},
            status: (code: number) => { res.statusCode = code; return res; },
            json: (body: unknown) => { res.body = body; },
            end: () => {},
            type: () => res,
            headersSent: false,
        } as any);
        const res: any = {};
        const rfm = createResponseFrameworkManager(manager, adapter, {
            tryCatchEnabled: false,
        });
        const failingHandler = async (_req: unknown, res: unknown) => { throw new Error("Database connection failed"); };
        const safeHandler = rfm.wrapHandler(failingHandler);
        await expect(safeHandler({}, res)).rejects.toThrow("Database connection failed");
    });
});
