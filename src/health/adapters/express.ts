import type { HealthServer } from "../types.js";

export function createExpressHealthAdapter(app: any): HealthServer {
    return {
        get: (path, handler) => {
            app.get(path, async (_req: any, res: any) => {
                const reply: any = {
                    status: (code: number) => {
                        res.status(code);
                        return reply;
                    },
                    send: (body: unknown) => {
                        res.json(body);
                    },
                };
                await handler(_req, reply);
            });
        },
        decorate: (name, value) => {
            (app as any)[name] = value;
        },
    };
}

export function createFastifyHealthAdapter(server: any): HealthServer {
    return {
        get: (path, handler) => {
            server.get(path, async (_req: any, reply: any) => {
                const healthReply: any = {
                    status: (code: number) => {
                        reply.code(code);
                        return healthReply;
                    },
                    send: (body: unknown) => {
                        reply.send(body);
                    },
                };
                await handler(_req, healthReply);
            });
        },
        decorate: (name, value) => {
            server.decorate(name, value);
        },
    };
}

export function createKoaHealthAdapter(app: any): HealthServer {
    return {
        get: (path, handler) => {
            app.use(async (ctx: any, next: any) => {
                if (ctx.method !== "GET" || ctx.path !== path) {
                    await next();
                    return;
                }

                const reply: any = {
                    status: (code: number) => {
                        ctx.status = code;
                        return reply;
                    },
                    send: (body: unknown) => {
                        ctx.body = body;
                    },
                };

                await handler(ctx.request, reply);
            });
        },
        decorate: (name, value) => {
            (app as any)[name] = value;
        },
    };
}