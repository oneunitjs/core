import { Readable } from "node:stream";
import type {
    MultipartOptions,
    MultipartMiddleware,
    MultipartResult,
} from "./types.js";
import { parseMultipart } from "./parser.js";
import { MultipartDisabledError } from "../errors/multipart.js";

const DEFAULT_MULTIPART_OPTIONS: MultipartOptions = {};

export function createMultipart(options: MultipartOptions = {}): MultipartMiddleware {
    const merged: MultipartOptions = {
        maxFileSize: options.maxFileSize,
        maxFieldsSize: options.maxFieldsSize,
        maxFiles: options.maxFiles,
        maxFields: options.maxFields,
        allowedMimeTypes: options.allowedMimeTypes,
        uploadDir: options.uploadDir,
        fileFilter: options.fileFilter,
        tmpdir: options.tmpdir,
        headersLimit: options.headersLimit,
    };

    let enabled = true;

    async function parse(req: unknown): Promise<MultipartResult> {
        if (!enabled) {
            throw new MultipartDisabledError();
        }
        return parseMultipart(req, merged);
    }

    function middleware(): (req: unknown, res: unknown, next?: (err?: Error) => void) => Promise<void> {
        return async (req: unknown, res: unknown, next?: (err?: Error) => void) => {
            if (!enabled) {
                if (next) next();
                return;
            }

            try {
                const result = await parseMultipart(req, merged);
                (req as any).multipart = result;
                if (next) next();
            } catch (err: any) {
                if (next) {
                    next(err);
                } else {
                    throw err;
                }
            }
        };
    }

    return {
        name: "multipart",
        get enabled() { return enabled; },
        get options() { return { ...merged }; },
        enable() { enabled = true; },
        disable() { enabled = false; },
        toggle() { enabled = !enabled; },
        parse,
        middleware,
    };
}

export function expressMultipartMiddleware(options: MultipartOptions = {}) {
    const mp = createMultipart(options);
    return mp.middleware();
}

export function fastifyMultipartMiddleware(options: MultipartOptions = {}) {
    const mp = createMultipart(options);
    return async (req: unknown, reply: unknown) => {
        const reqAny = req as any;
        const raw = reqAny?.raw ?? reqAny;
        let source: unknown = raw;
        let headers: Record<string, string> | undefined;

        // If body was already parsed as a buffer by Fastify, create a readable stream from it
        if (Buffer.isBuffer(reqAny?.body)) {
            source = Readable.from([reqAny.body]);
            headers = reqAny?.headers ?? {};
        }

        const result = await parseMultipart(source, mp.options as unknown as MultipartOptions, headers);
        reqAny.multipart = result;
    };
}

export function koaMultipartMiddleware(options: MultipartOptions = {}) {
    const mp = createMultipart(options);
    return async (ctx: unknown, next: () => void | Promise<void>) => {
        const result = await mp.parse((ctx as any)?.req);
        (ctx as any).multipart = result;
        if (next) await next();
    };
}

export function httpMultipartMiddleware(options: MultipartOptions = {}) {
    const mp = createMultipart(options);
    return async (req: unknown, res: unknown, next?: (err?: Error) => void) => {
        try {
            const result = await mp.parse(req);
            (req as any).multipart = result;
            if (next) next();
        } catch (err: any) {
            if (next) {
                next(err);
            } else {
                if (typeof res === "object" && res !== null) {
                    const resAny = res as any;
                    if (typeof resAny.writeHead === "function") {
                        resAny.writeHead(400, { "Content-Type": "application/json" });
                    }
                    if (typeof resAny.end === "function") {
                        resAny.end(JSON.stringify({ error: err?.message ?? "Multipart parse error" }));
                    }
                }
            }
        }
    };
}

export { parseMultipart };
