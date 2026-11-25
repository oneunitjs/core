import {
    createBrotliCompress,
    createDeflate,
    createGzip,
    constants,
    type BrotliOptions,
    type ZlibOptions,
} from "node:zlib";
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

const COMPRESSION_PATCHED = "__oneunit_compression_patched";

type Encoding = "gzip" | "deflate" | "br";

function parseEncodingQ(acceptEncoding: string, enc: Encoding): number {
    const regex = new RegExp(`(?:^|,\\s*)${enc}(?:\\s*;\\s*q=([0-9]*\\.?[0-9]+))?(?=,|\\s*$)`, "i");
    const match = acceptEncoding.match(regex);
    if (!match) return -1;
    return match[1] === undefined ? 1 : Number(match[1]);
}

function selectEncoding(acceptEncoding: string): Encoding | null {
    const ae = acceptEncoding.toLowerCase();
    const candidates: Encoding[] = ["br", "gzip", "deflate"];
    let best: { encoding: Encoding; q: number } | null = null;

    for (const enc of candidates) {
        const q = parseEncodingQ(ae, enc);
        if (q === 0) continue;
        if (q > 0 && (!best || q > best.q)) {
            best = { encoding: enc, q };
        }
    }

    return best ? best.encoding : null;
}

function createCompressStream(encoding: Encoding, level: number) {
    const opts: ZlibOptions & BrotliOptions = { level };
    if (encoding === "br") {
        return createBrotliCompress({
            params: { [constants.BROTLI_PARAM_QUALITY]: level },
        });
    }
    if (encoding === "gzip") {
        return createGzip(opts);
    }
    return createDeflate(opts);
}

function appendHeader(res: any, name: string, value: string): void {
    if (typeof res.getHeader === "function") {
        const existing = res.getHeader(name);
        if (existing !== undefined) {
            value = Array.isArray(existing)
                ? existing.concat([value]).join(", ")
                : `${existing}, ${value}`;
        }
    }
    if (typeof res.setHeader === "function") {
        res.setHeader(name, value);
    }
}

function normalizeEndArgs(
    chunk: any,
    enc: any,
    cb: any,
): { chunk: any; encoding: BufferEncoding | undefined; callback: (() => void) | undefined } {
    if (typeof chunk === "function") {
        return { chunk: undefined, encoding: undefined, callback: chunk };
    }
    if (typeof enc === "function") {
        return { chunk, encoding: undefined, callback: enc };
    }
    return { chunk, encoding: enc, callback: cb };
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

        const acceptEncoding = String((req as any)?.headers?.["accept-encoding"] ?? "");
        const encoding = selectEncoding(acceptEncoding);
        if (!encoding) {
            if (next) next();
            return;
        }

        const resAny = res as any;
        if (typeof resAny !== "object" || resAny === null) {
            if (next) next();
            return;
        }

        if (resAny[COMPRESSION_PATCHED]) {
            if (next) next();
            return;
        }

        // Never recompress a response that is already encoded.
        if (typeof resAny.getHeader === "function") {
            const existing = resAny.getHeader("content-encoding");
            if (existing) {
                if (next) next();
                return;
            }
        }

        if (merged.filter && !merged.filter(req, res)) {
            if (next) next();
            return;
        }

        const threshold = merged.threshold ?? 1024;
        const level = merged.level ?? 6;

        let started = false;
        let compressing = false;
        let headersSet = false;
        let ended = false;
        let compressedBytesCommitted = false;
        let transform: any = null;
        let originalWrite: any = null;
        let originalEnd: any = null;
        let pendingEndCb: (() => void) | undefined;

        let bodySize = 0;
        const buffered: Buffer[] = [];

        const ensureCompressionHeaders = (): void => {
            if (headersSet) return;
            headersSet = true;
            if (typeof resAny.setHeader === "function") {
                resAny.setHeader("Content-Encoding", encoding);
                appendHeader(resAny, "Vary", "Accept-Encoding");
                if (typeof resAny.removeHeader === "function") {
                    resAny.removeHeader("Content-Length");
                }
            }
        };

        const flushBufferedUncompressed = (): void => {
            if (buffered.length === 0) return;
            const body = Buffer.concat(buffered);
            buffered.length = 0;
            if (typeof originalWrite === "function" && !ended) {
                originalWrite(body);
            }
        };

        // Transactional: create the transform stream BEFORE committing any
        // compression headers, so stream creation failure leaves state clean.
        const startCompression = (): boolean => {
            try {
                transform = createCompressStream(encoding, level);
            } catch {
                transform = null;
                return false;
            }

            transform.on("data", (chunk: Buffer) => {
                if (typeof originalWrite === "function" && !ended) {
                    const ok = originalWrite(chunk);
                    if (ok === false && typeof transform.pause === "function") {
                        compressedBytesCommitted = true;
                        transform.pause();
                        const onDrain = (): void => {
                            transform.resume();
                            if (typeof resAny.removeListener === "function") {
                                resAny.removeListener("drain", onDrain);
                            }
                        };
                        if (typeof resAny.on === "function") {
                            resAny.on("drain", onDrain);
                        }
                    } else {
                        compressedBytesCommitted = true;
                    }
                }
            });

            transform.on("end", () => {
                ended = true;
                if (typeof originalEnd === "function") {
                    originalEnd();
                }
                const cb = pendingEndCb;
                pendingEndCb = undefined;
                if (cb) cb();
            });

            transform.on("error", () => {
                ended = true;
                try {
                    if (transform.destroy) transform.destroy();
                } catch {}
                transform = null;
                compressing = false;

                if (!compressedBytesCommitted) {
                    // No compressed bytes handed to the response: restore
                    // original headers and send buffered body uncompressed.
                    if (typeof resAny.removeHeader === "function") {
                        resAny.removeHeader("Content-Encoding");
                    }
                    flushBufferedUncompressed();
                    if (typeof originalEnd === "function") {
                        originalEnd(pendingEndCb);
                        pendingEndCb = undefined;
                    }
                } else {
                    // Compressed output already started: end safely without a
                    // mixed representation.
                    if (typeof originalEnd === "function") {
                        originalEnd();
                    }
                }
                const cb = pendingEndCb;
                pendingEndCb = undefined;
                if (cb) cb();
            });

            return true;
        };

        const maybeStartCompression = (): boolean => {
            if (compressing) return true;
            if (bodySize < threshold) return false;
            compressing = true;
            ensureCompressionHeaders();
            return startCompression();
        };

        const write = function (
            this: any,
            chunk: any,
            enc?: any,
            cb?: any,
        ): boolean {
            if (chunk === undefined && enc === undefined && cb === undefined) {
                return true;
            }

            const { chunk: buf, encoding: encName, callback } = normalizeEndArgs(
                chunk,
                enc,
                cb as any,
            );

            if (!buf) {
                if (callback) callback();
                return true;
            }

            const buffer = Buffer.isBuffer(buf)
                ? buf
                : Buffer.from(buf, encName as BufferEncoding);

            if (!started) {
                started = true;
                bodySize += buffer.length;
                buffered.push(buffer);

                if (maybeStartCompression()) {
                    if (!transform) {
                        flushBufferedUncompressed();
                        return originalWrite(buffer, encName, callback);
                    }
                    const chunks = buffered.splice(0);
                    for (const b of chunks) {
                        transform.write(b);
                    }
                    if (callback) setImmediate(callback);
                    return true;
                }
                // Still below threshold: buffer, do not write yet.
                if (callback) setImmediate(callback);
                return true;
            }

            if (compressing) {
                if (!transform) {
                    return originalWrite(buffer, encName, callback);
                }
                const ok = transform.write(buffer);
                if (callback) {
                    if (ok === false) {
                        transform.once("drain", callback);
                    } else {
                        setImmediate(callback);
                    }
                }
                return ok;
            }

            bodySize += buffer.length;
            buffered.push(buffer);
            if (maybeStartCompression() && transform) {
                const chunks = buffered.splice(0);
                for (const b of chunks) {
                    transform.write(b);
                }
            }
            if (callback) setImmediate(callback);
            return true;
        };

        const end = function (this: any, chunk?: any, enc?: any, cb?: any): void {
            const { chunk: buf, encoding: encName, callback } = normalizeEndArgs(
                chunk,
                enc,
                cb as any,
            );

            pendingEndCb = callback;

            if (buf) {
                const buffer = Buffer.isBuffer(buf)
                    ? buf
                    : Buffer.from(buf, encName as BufferEncoding);
                bodySize += buffer.length;
                if (!started) {
                    started = true;
                    buffered.push(buffer);
                } else if (compressing && transform) {
                    transform.write(buffer);
                } else {
                    buffered.push(buffer);
                }
            }

            if (!started) {
                ended = true;
                if (typeof originalEnd === "function") {
                    originalEnd(pendingEndCb);
                    pendingEndCb = undefined;
                }
                return;
            }

            if (maybeStartCompression() && transform) {
                const chunks = buffered.splice(0);
                for (const b of chunks) {
                    transform.write(b);
                }
                buffered.length = 0;
                transform.end();
                pendingEndCb = undefined;
                return;
            }

            // Below threshold or compression unavailable: send uncompressed.
            if (buffered.length > 0) {
                appendHeader(resAny, "Vary", "Accept-Encoding");
                const body = Buffer.concat(buffered);
                buffered.length = 0;
                ended = true;
                originalEnd(body, encName, pendingEndCb);
                pendingEndCb = undefined;
                return;
            }

            ended = true;
            if (typeof originalEnd === "function") {
                originalEnd(pendingEndCb);
                pendingEndCb = undefined;
            }
        };

        originalWrite = typeof resAny.write === "function" ? resAny.write.bind(resAny) : null;
        originalEnd = typeof resAny.end === "function" ? resAny.end.bind(resAny) : null;

        if (!originalWrite || !originalEnd) {
            if (next) next();
            return;
        }

        resAny.write = write;
        resAny.end = end;
        resAny[COMPRESSION_PATCHED] = true;

        if (next) next();
    };

    const base = createSecurityMiddlewareBase("compression", merged as Record<string, unknown>, coreMiddleware);

    return {
        name: base.name,
        get enabled() { return base.enabled; },
        get options() { return { ...merged }; },
        enable() { base.enable(); },
        disable() { base.disable(); },
        toggle() { base.toggle(); },
        middleware: () => base.middleware(),
        shouldCompress,
    } as CompressionMiddleware;
}
