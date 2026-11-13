import type { MiddlewareRegistration } from "../types.js";
import type { FrameworkAdapter } from "./types.js";

export class FastifyMiddlewareAdapter implements FrameworkAdapter {
    readonly framework = "fastify" as const;

    adapt(middleware: MiddlewareRegistration): any {
        return async (req: any, reply: any) => {
            let nextCalled = false;
            const next = () => {
                nextCalled = true;
            };

            // Adapt Fastify reply to look like Express res
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

            await middleware.middleware(req.raw ?? req, adaptedRes, next);

            if (!nextCalled) {
                // Middleware didn't call next, send response if not already sent
                if (!reply.sent) {
                    reply.send();
                }
            }
        };
    }
}
