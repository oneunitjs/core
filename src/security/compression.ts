import { constants } from "node:zlib";
import type { CompressionOptions } from "./types.js";
export type { CompressionOptions };
import { createSecurityMiddlewareBase } from "./middleware-base.js";

const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
    threshold: 1024,
    level: 6,
    memLevel: 8,
    strategy: 0,
    windowBits: 15,
};

function selectEncoding(acceptEncoding: string): "gzip" | "deflate" | "br" | null {
    const ae = acceptEncoding.toLowerCase();
    if (ae.includes("br")) return "br";
    if (ae.includes("gzip")) return "gzip";
    if (ae.includes("deflate")) return "deflate";
    return null;
}

function compressSync(data: Buffer, encoding: "gzip" | "deflate" | "br", level: number): Buffer {
    if (encoding === "br") {
        return require("node:zlib").brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: level } });
    }
    if (encoding === "gzip") {
        return require("node:zlib").gzipSync(data, { level });
    }
    return require("node:zlib").deflateSync(data, { level });
}

export interface CompressionMiddleware {
    name: string;
    enabled: boolean;
    options: CompressionOptions;
    enable(): void;
    disable(): void;
    toggle(): void;
    middleware(): (req: unknown, res: unknown, next?: () => void) => void;
    shouldCompress(req: unknown, res: unknown): boolean;
}

export function createCompression(options: CompressionOptions = {}): CompressionMiddleware {
    const merged: CompressionOptions = {
        threshold: options.threshold ?? DEFAULT_COMPRESSION_OPTIONS.threshold,
        level: options.level ?? DEFAULT_COMPRESSION_OPTIONS.level,
        memLevel: options.memLevel ?? DEFAULT_COMPRESSION_OPTIONS.memLevel,
        strategy: options.strategy ?? DEFAULT_COMPRESSION_OPTIONS.strategy,
        windowBits: options.windowBits ?? DEFAULT_COMPRESSION_OPTIONS.windowBits,
        filter: options.filter,
    };

    function shouldCompress(req: unknown, _res: unknown): boolean {
        const acceptEncoding = (req as any)?.headers?.["accept-encoding"];
        if (!acceptEncoding) return false;
        return selectEncoding(String(acceptEncoding)) !== null;
    }

    const coreMiddleware = (req: unknown, res: unknown, next?: () => void) => {
        if (!shouldCompress(req, res)) {
            if (next) next();
            return;
        }

        const encoding = selectEncoding(String((req as any)?.headers?.["accept-encoding"] ?? ""));
        if (!encoding) {
            if (next) next();
            return;
        }

        if (typeof res !== "object" || res === null) {
            if (next) next();
            return;
        }

        const resAny = res as any;

        const chunks: Buffer[] = [];
        if (typeof resAny.write === "function" && typeof resAny.end === "function") {
            const originalEnd = resAny.end.bind(resAny);

            resAny.write = (chunk: any, ..._args: any[]): boolean => {
                if (chunk) {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                return true;
            };

            resAny.end = (chunk?: any, ...args: any[]): void => {
                if (chunk) {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                const body = Buffer.concat(chunks);

                if (body.length < (merged.threshold ?? 1024)) {
                    originalEnd(body, ...args);
                    return;
                }

                try {
                    const compressed = compressSync(body, encoding, merged.level ?? 6);
                    if (typeof resAny.setHeader === "function") {
                        resAny.setHeader("Content-Encoding", encoding);
                        resAny.setHeader("Vary", "Accept-Encoding");
                        if (typeof resAny.removeHeader === "function") {
                            resAny.removeHeader("Content-Length");
                        }
                    }
                    originalEnd(compressed, ...args);
                } catch {
                    originalEnd(body, ...args);
                }
            };
        }

        if (next) next();
    };

    const base = createSecurityMiddlewareBase("compression", merged as Record<string, unknown>, coreMiddleware);

    return {
        name: base.name,
        get enabled() { return base.enabled; },
        get options() { return base.options; },
        enable() { base.enable(); },
        disable() { base.disable(); },
        toggle() { base.toggle(); },
        middleware: () => base.middleware(),
        shouldCompress,
    } as CompressionMiddleware;
}
