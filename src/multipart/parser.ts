import Busboy from "busboy";
import {
    MultipartAggregateTooLargeError,
    MultipartFileTooLargeError,
    MultipartInvalidFileTypeError,
    MultipartTooManyFilesError,
    MultipartTooManyFieldsError,
} from "../errors/multipart.js";
import type {
    MultipartOptions,
    MultipartResult,
    MultipartFile,
    MultipartField,
} from "./types.js";

import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { join } from "node:path";

const DEFAULT_OPTIONS: Required<Omit<MultipartOptions, "fileFilter" | "uploadDir" | "tmpdir" | "headersLimit" | "fileSignature" | "aggregateSizeLimit">> = {
    maxFileSize: 10 * 1024 * 1024,
    maxFieldsSize: 10 * 1024 * 1024,
    maxFiles: 10,
    maxFields: 20,
    allowedMimeTypes: [],
    timeoutMs: 10000,
};

/**
 * Sanitise a client-supplied filename so it cannot escape the upload
 * directory via path traversal (e.g. "../" or absolute paths).
 */
function sanitizeFilename(filename: string | undefined): string {
    const base = (filename ? filename.split(/[\\/]/).pop() : "upload") ?? "upload";
    return base.replace(/[^A-Za-z0-9._-]/g, "_") || "upload";
}

/**
 * Generate a unique server-side filename so concurrent uploads with the same
 * client name cannot collide or overwrite each other.
 */
function uniqueFilename(filename: string | undefined): string {
    const base = sanitizeFilename(filename);
    const dot = base.lastIndexOf(".");
    const prefix = dot === -1 ? base : base.slice(0, dot);
    const ext = dot === -1 ? "" : base.slice(dot);
    const suffix = randomBytes(16).toString("hex"); // 128-bit randomness
    return `${prefix}-${suffix}${ext}`;
}

/**
 * Check whether the captured signature prefix starts with any of the
 * allowed magic-number signatures.
 */
function matchesSignature(prefix: Buffer | null, allowed: Buffer[]): boolean {
    if (!prefix || prefix.length === 0) return false;
    return allowed.some((sig) => sig.length > 0 && prefix.length >= sig.length && prefix.subarray(0, sig.length).equals(sig));
}

export function parseMultipart(
    req: unknown,
    options: MultipartOptions = {},
    headers?: Record<string, string>,
): Promise<MultipartResult> {
    const merged: MultipartOptions & Required<Pick<MultipartOptions, "maxFileSize" | "maxFieldsSize" | "maxFiles" | "maxFields">> = {
        maxFileSize: options.maxFileSize ?? DEFAULT_OPTIONS.maxFileSize,
        maxFieldsSize: options.maxFieldsSize ?? DEFAULT_OPTIONS.maxFieldsSize,
        maxFiles: options.maxFiles ?? DEFAULT_OPTIONS.maxFiles,
        maxFields: options.maxFields ?? DEFAULT_OPTIONS.maxFields,
        allowedMimeTypes: options.allowedMimeTypes ?? DEFAULT_OPTIONS.allowedMimeTypes,
        fileSignature: options.fileSignature,
        uploadDir: options.uploadDir,
        fileFilter: options.fileFilter,
        tmpdir: options.tmpdir,
        headersLimit: options.headersLimit,
        timeoutMs: options.timeoutMs ?? 10000,
        aggregateSizeLimit: options.aggregateSizeLimit,
    };

    const effectiveHeaders = headers ?? (req as any)?.headers;

    return new Promise((resolve, reject) => {
        const busboy = Busboy({
            headers: effectiveHeaders,
            limits: {
                headerPairs: merged.headersLimit ?? 2000,
                fieldSize: merged.maxFieldsSize,
                fileSize: merged.maxFileSize,
                fields: merged.maxFields,
                files: merged.maxFiles,
            },
        });

        const files: MultipartFile[] = [];
        const fields: MultipartField[] = [];
        let fileCount = 0;
        let fieldCount = 0;
        let totalReceived = 0;
        let finished = false;
        let errored = false;
        let settled = false;
        let requestCompleted = false;
        let pendingFileOps = 0;
        const tempPaths: string[] = [];
        const activeWriteStreams = new Set<any>();
        let timeoutHandle: any = null;

        const finalize = async (): Promise<void> => {
            if (finished || settled) return;
            finished = true;

            // Wait until all pending file-write operations have completed
            // before resolving so the parser never resolves before disk
            // writes finish and file metadata is recorded.
            while (pendingFileOps > 0) {
                await new Promise((resolveTick) => setTimeout(resolveTick, 0));
            }

            if (settled) return;
            settled = true;
            for (const stream of activeWriteStreams) {
                activeWriteStreams.delete(stream);
            }
            resolve({ files, fields });
        };

        const cleanupTempFiles = async (): Promise<void> => {
            for (const path of tempPaths) {
                try {
                    const fs = await import("node:fs/promises");
                    await fs.unlink(path).catch(() => {});
                } catch {}
            }
            tempPaths.length = 0;
        };

        const destroyStreams = (): void => {
            for (const stream of activeWriteStreams) {
                try {
                    stream.destroy();
                } catch {}
            }
            activeWriteStreams.clear();
        };

        const cleanup = (): void => {
            busboy.removeAllListeners("file");
            busboy.removeAllListeners("field");
            busboy.removeAllListeners("finish");
            busboy.removeAllListeners("error");
            destroyStreams();
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
                timeoutHandle = null;
            }
        };

        const abort = async (err: Error): Promise<void> => {
            if (settled) return;
            settled = true;
            errored = true;
            cleanup();
            await cleanupTempFiles();
            reject(err);
        };

        // Ensure the upload directory exists when streaming to disk. Directory
        // creation must complete before any file stream opens, otherwise files
        // may target a nonexistent directory.
        const ensureUploadDir = async (): Promise<void> => {
            if (!merged.uploadDir) return;
            try {
                const fs = await import("node:fs/promises");
                await fs.mkdir(merged.uploadDir, { recursive: true });
            } catch (err: any) {
                throw new Error(`Unable to create upload directory: ${err.message}`);
            }
        };

        let uploadDirReady: Promise<void>;
        if (merged.uploadDir) {
            uploadDirReady = ensureUploadDir();
        } else {
            uploadDirReady = Promise.resolve();
        }

        busboy.on("file", (fieldname: string, fileStream: any, info: { encoding: string; mimeType: string; filename: string }) => {
            if (errored) {
                fileStream.resume();
                return;
            }

            const { encoding, mimeType: mimetype, filename } = info;

            const fileFilter = merged.fileFilter;
            if (fileFilter && !fileFilter({ fieldname, originalname: filename, mimetype })) {
                fileStream.resume();
                return;
            }

            const allowedMimeTypes = merged.allowedMimeTypes;
            if (allowedMimeTypes && allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(mimetype)) {
                fileStream.resume();
                return;
            }

            fileCount++;
            if (fileCount > merged.maxFiles!) {
                fileStream.resume();
                return abort(new MultipartTooManyFilesError(merged.maxFiles!));
            }

            const safeName = uniqueFilename(filename);
            const destPath = merged.uploadDir ? join(merged.uploadDir, safeName) : null;
            if (destPath) tempPaths.push(destPath);

            const chunks: Buffer[] = [];
            let fileSize = 0;
            let fileTooLarge = false;
            const maxSigLen = merged.fileSignature
                ? Math.max(...merged.fileSignature.map((sig) => sig.length))
                : 0;
            // sigPrefix starts as an empty buffer so leading bytes are
            // captured when signature validation is configured.
            let sigPrefix: Buffer | null = maxSigLen > 0 ? Buffer.alloc(0) : null;

            let writeStream: any = null;
            if (destPath) {
                try {
                    // Use exclusive creation ('wx') so concurrent uploads with
                    // the same generated name cannot overwrite each other.
                    writeStream = createWriteStream(destPath, { flags: "wx" });
                    activeWriteStreams.add(writeStream);
                    writeStream.on("error", (err: Error) => {
                        activeWriteStreams.delete(writeStream);
                        fileStream.resume();
                        return abort(err);
                    });
                } catch (err: any) {
                    fileStream.resume();
                    return abort(err);
                }
            }

            pendingFileOps += 1;

            fileStream.on("data", (chunk: Buffer) => {
                if (errored || fileTooLarge) return;

                // Capture the leading bytes for content-signature validation.
                if (maxSigLen > 0 && sigPrefix !== null && sigPrefix.length < maxSigLen) {
                    const need = maxSigLen - sigPrefix.length;
                    sigPrefix = Buffer.concat([sigPrefix, chunk.subarray(0, need)]);
                }

                fileSize += chunk.length;
                totalReceived += chunk.length;

                if (merged.aggregateSizeLimit && totalReceived > merged.aggregateSizeLimit) {
                    fileTooLarge = true;
                    errored = true;
                    fileStream.resume();
                    return abort(new MultipartAggregateTooLargeError(merged.aggregateSizeLimit!));
                }

                if (fileSize > merged.maxFileSize) {
                    fileTooLarge = true;
                    errored = true;
                    fileStream.resume();
                    return abort(new MultipartFileTooLargeError(merged.maxFileSize));
                }

                if (writeStream) {
                    if (writeStream.write(chunk) === false) {
                        fileStream.pause();
                        writeStream.once("drain", () => fileStream.resume());
                    }
                } else {
                    chunks.push(chunk);
                }
            });

            fileStream.on("end", async () => {
                if (errored) {
                    pendingFileOps = Math.max(0, pendingFileOps - 1);
                    return;
                }
                if (fileTooLarge) {
                    pendingFileOps = Math.max(0, pendingFileOps - 1);
                    return;
                }

                if (writeStream) {
                    try {
                        await new Promise<void>((resolveStream, rejectStream) => {
                            writeStream.end(() => resolveStream());
                            writeStream.on("error", rejectStream);
                        });
                    } catch (err: any) {
                        pendingFileOps = Math.max(0, pendingFileOps - 1);
                        return abort(err);
                    } finally {
                        activeWriteStreams.delete(writeStream);
                    }
                }

                // Content-signature (magic number) validation.
                if (merged.fileSignature && merged.fileSignature.length > 0 && maxSigLen > 0) {
                    if (!matchesSignature(sigPrefix, merged.fileSignature)) {
                        if (destPath) {
                            try {
                                const fs = await import("node:fs/promises");
                                await fs.unlink(destPath).catch(() => {});
                            } catch {}
                            const idx = tempPaths.indexOf(destPath);
                            if (idx !== -1) tempPaths.splice(idx, 1);
                        }
                        pendingFileOps = Math.max(0, pendingFileOps - 1);
                        return abort(new MultipartInvalidFileTypeError("File content signature does not match any allowed type"));
                    }
                }

                if (destPath) {
                    files.push({
                        fieldname,
                        originalname: filename ?? "",
                        encoding,
                        mimetype,
                        size: fileSize,
                        destination: merged.uploadDir,
                        filename: safeName,
                        path: destPath,
                    });
                } else {
                    files.push({
                        fieldname,
                        originalname: filename ?? "",
                        encoding,
                        mimetype,
                        size: fileSize,
                        buffer: Buffer.concat(chunks),
                    });
                }
                pendingFileOps = Math.max(0, pendingFileOps - 1);
            });

            fileStream.on("error", (err: Error) => {
                if (errored) return;
                errored = true;
                pendingFileOps = Math.max(0, pendingFileOps - 1);
                fileStream.resume();
                return abort(err);
            });

            fileStream.on("limit", () => {
                if (errored) return;
                fileTooLarge = true;
                errored = true;
                pendingFileOps = Math.max(0, pendingFileOps - 1);
                fileStream.resume();
                return abort(new MultipartFileTooLargeError(merged.maxFileSize));
            });
        });

        busboy.on("field", (fieldname: string, value: string) => {
            if (errored) return;
            fieldCount++;
            if (fieldCount > merged.maxFields!) {
                return abort(new Error(`Too many fields: max ${merged.maxFields}`));
            }
            fields.push({ fieldname, value });
        });

        busboy.on("limit", (field: string) => {
            if (errored) return;
            errored = true;
            cleanup();
            if (field === "fileSize") {
                return abort(new MultipartFileTooLargeError(merged.maxFileSize));
            } else if (field === "files") {
                return abort(new MultipartTooManyFilesError(merged.maxFiles));
            } else if (field === "fields") {
                return abort(new MultipartTooManyFieldsError(merged.maxFields));
            }
        });

        busboy.on("filesLimit", () => {
            if (errored) return;
            errored = true;
            cleanup();
            return abort(new MultipartTooManyFilesError(merged.maxFiles));
        });

        busboy.on("fieldsLimit", () => {
            if (errored) return;
            errored = true;
            cleanup();
            return abort(new MultipartTooManyFieldsError(merged.maxFields));
        });

        busboy.on("finish", async () => {
            if (errored) return;
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
                timeoutHandle = null;
            }
            await finalize();
        });

        busboy.on("error", (err: Error) => {
            if (errored) return;
            errored = true;
            cleanup();
            return abort(err);
        });

        // Timeout safety net. The timeout stays active until all file
        // operations finish, so a stalled write during finalization is still
        // bounded.
        timeoutHandle = setTimeout(() => {
            if (!finished && !errored) {
                errored = true;
                cleanup();
                return abort(new Error("Multipart parse timeout"));
            }
        }, merged.timeoutMs);

        // Request abort / disconnect handling. Use requestCompleted to
        // distinguish a genuinely aborted request from normal completion
        // (the `close` event can fire after a successful response). While
        // finalizing, a disconnect must still trigger cleanup.
        const reqAny = req as any;
        const onCompleted = (): void => {
            requestCompleted = true;
        };
        const onAbort = async (): Promise<void> => {
            if (requestCompleted || settled || errored) return;
            errored = true;
            cleanup();
            clearTimeout(timeoutHandle);
            await cleanupTempFiles();
            return abort(new Error("Request aborted"));
        };

        if (reqAny?.aborted) {
            void onAbort();
        } else {
            reqAny?.on?.("close", onAbort);
            reqAny?.on?.("abort", onAbort);
            reqAny?.on?.("end", onCompleted);
            reqAny?.on?.("response", onCompleted);
        }

        // Await upload directory creation before feeding the request into
        // Busboy so file streams never target a nonexistent directory.
        uploadDirReady.then(() => {
            (req as any)?.pipe?.(busboy);
        }).catch((err: Error) => {
            void abort(err);
        });
    });
}
