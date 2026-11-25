export type FrameworkType = "express" | "fastify" | "koa" | "http";

export interface FrameworkAdapter {
    name: FrameworkType;
    detect(req: unknown, res: unknown, ctx?: unknown): boolean;
}

export interface AdaptedMiddleware {
    name: string;
    middleware: (
        req: unknown,
        res: unknown,
        next?: () => void,
    ) => void | Promise<void>;
}

export const ExpressMiddlewareAdapter: AdaptedMiddleware = {
    name: "express",
    middleware: (_req: unknown, _res: unknown, _next?: () => void): void | Promise<void> => {
        return undefined;
    },
};

export const FastifyMiddlewareAdapter: AdaptedMiddleware = {
    name: "fastify",
    middleware: (_req: unknown, _res: unknown, _next?: () => void): void | Promise<void> => {
        return undefined;
    },
};

export const KoaMiddlewareAdapter: AdaptedMiddleware = {
    name: "koa",
    middleware: (_req: unknown, _res: unknown, _next?: () => void): void | Promise<void> => {
        return undefined;
    },
};

export const HttpMiddlewareAdapter: AdaptedMiddleware = {
    name: "http",
    middleware: (_req: unknown, _res: unknown, _next?: () => void): void | Promise<void> => {
        return undefined;
    },
};
