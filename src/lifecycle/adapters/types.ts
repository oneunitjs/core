import type { MiddlewareRegistration } from "../types.js";

export type FrameworkType = "express" | "fastify" | "koa" | "http";

export interface FrameworkAdapter {
    framework: FrameworkType;
    adapt(_middleware: MiddlewareRegistration): any;
}

export interface AdaptedMiddleware {
    framework: FrameworkType;
    _middleware: any;
    registration: MiddlewareRegistration;
}
