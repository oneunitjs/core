import type { CompressionOptions } from "./types.js";
export type { CompressionOptions };

const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
    threshold: 1024,
    level: 6,
    memLevel: 8,
    strategy: 0,
    windowBits: 15,
};

export interface CompressionMiddleware {
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

    let enabled = true;

    function shouldCompress(req: unknown, res: unknown): boolean {
        if (!enabled) return false;

        if (merged.filter) {
            return merged.filter(req, res);
        }

        const acceptEncoding = (req as any)?.headers?.["accept-encoding"];
        if (!acceptEncoding) return false;

        return /(gzip|deflate|br)/.test(String(acceptEncoding));
    }

    function middleware(): (req: unknown, res: unknown, next?: () => void) => void {
        return (req: unknown, res: unknown, next?: () => void) => {
            if (!enabled) {
                if (next) next();
                return;
            }

            if (!shouldCompress(req, res)) {
                if (next) next();
                return;
            }

            if (typeof res === "object" && res !== null) {
                if ("setHeader" in res) {
                    (res as any).setHeader("Content-Encoding", "gzip");
                }
                if ("setHeader" in res) {
                    (res as any).setHeader("Vary", "Accept-Encoding");
                }
            }

            if (next) next();
        };
    }

    return {
        get enabled() { return enabled; },
        get options() { return { ...merged }; },
        enable() { enabled = true; },
        disable() { enabled = false; },
        toggle() { enabled = !enabled; },
        middleware,
        shouldCompress,
    };
}
