/**
 * Fastify middleware adapter.
 * Adapts Express-style (req, res, next) middleware to Fastify's
 * (req, reply) signature.
 */
import { BaseMiddlewareAdapter, type MiddlewareAdapterConfig } from "./base.js";
import type { MiddlewareRegistration } from "../../lifecycle/types.js";

export class FastifyMiddlewareAdapter extends BaseMiddlewareAdapter {
    readonly framework = "fastify" as const;

    constructor(config: MiddlewareAdapterConfig) {
        super(config);
    }

    adapt(): (req: any, reply: any) => void {
        const middlewareFn = this.registration.middleware;
        return async (req: any, reply: any) => {
            let nextCalled = false;
            const next = () => {
                nextCalled = true;
            };

            const adaptedRes: any = {
                setHeader: (key: string, value: string) => {
                    reply.header(key, value);
                },
                get statusCode() {
                    return reply.statusCode;
                },
                set statusCode(code: number) {
                    reply.code(code);
                },
                end: (body: any) => {
                    if (!nextCalled) {
                        reply.send(body);
                    }
                },
            };

            await middlewareFn(req.raw ?? req, adaptedRes, next);

            if (!nextCalled && !reply.sent) {
                reply.send();
            }
        };
    }
}

export function createFastifyMiddlewareAdapter(
    registration: MiddlewareRegistration,
): FastifyMiddlewareAdapter {
    const adapter = new FastifyMiddlewareAdapter({
        framework: "fastify",
        registration,
    });
    adapter.initialize();
    return adapter;
}
