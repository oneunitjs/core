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

export interface ExpressAdapterOptions {
    autoRegisterHealthRoute?: boolean;
    tryCatchEnabled?: boolean;
    health?: { path?: string };
    framework?: string;
    serviceName?: string;
    port?: number;
    secret?: string;
    [key: string]: unknown;
}
