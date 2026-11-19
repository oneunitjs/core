import Busboy from "busboy";
import {
    MultipartFileTooLargeError,
    MultipartTooManyFilesError,
    MultipartTooManyFieldsError,
} from "../errors/multipart.js";
import type {
    MultipartOptions,
    MultipartResult,
    MultipartFile,
    MultipartField,
} from "./types.js";

const DEFAULT_OPTIONS: Required<Omit<MultipartOptions, "fileFilter" | "uploadDir" | "tmpdir" | "headersLimit">> = {
    maxFileSize: 10 * 1024 * 1024,
    maxFieldsSize: 10 * 1024 * 1024,
    maxFiles: 10,
    maxFields: 20,
    allowedMimeTypes: [],
    timeoutMs: 10000,
};

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
        uploadDir: options.uploadDir,
        fileFilter: options.fileFilter,
        tmpdir: options.tmpdir,
        headersLimit: options.headersLimit,
        timeoutMs: options.timeoutMs ?? 10000,
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
        let finished = false;
        let errored = false;

        const finalize = () => {
            if (finished || errored) return;
            finished = true;
            resolve({ files, fields });
        };

        const cleanup = () => {
            busboy.removeAllListeners("file");
            busboy.removeAllListeners("field");
            busboy.removeAllListeners("finish");
            busboy.removeAllListeners("error");
        };

        busboy.on("file", (fieldname: string, fileStream: any, info: { encoding: string; mimeType: string; filename: string }) => {
            if (errored) return;

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
            if (fileCount > merged.maxFiles) {
                const err = new Error(`Too many files: max ${merged.maxFiles}`);
                errored = true;
                cleanup();
                fileStream.resume();
                reject(err);
                return;
            }

            const chunks: Buffer[] = [];
            let fileSize = 0;
            let fileTooLarge = false;

            fileStream.on("data", (chunk: Buffer) => {
                if (errored || fileTooLarge) return;
                chunks.push(chunk);
                fileSize += chunk.length;
                if (fileSize > merged.maxFileSize) {
                    fileTooLarge = true;
                    const err = new Error(`File too large: max ${merged.maxFileSize} bytes`);
                    errored = true;
                    cleanup();
                    fileStream.resume();
                    reject(err);
                }
            });

            fileStream.on("end", () => {
                if (errored) return;
                if (fileTooLarge) return;
                const buffer = Buffer.concat(chunks);
                files.push({
                    fieldname,
                    originalname: filename ?? "",
                    encoding,
                    mimetype,
                    size: buffer.length,
                    buffer,
                });
            });

            fileStream.on("error", (err: Error) => {
                if (errored) return;
                errored = true;
                cleanup();
                reject(err);
            });

            fileStream.on("limit", () => {
                if (errored) return;
                fileTooLarge = true;
                errored = true;
                cleanup();
                fileStream.resume();
                reject(new MultipartFileTooLargeError(merged.maxFileSize));
            });
        });

        busboy.on("field", (fieldname: string, value: string) => {
            if (errored) return;
            fieldCount++;
            if (fieldCount > merged.maxFields) {
                const err = new Error(`Too many fields: max ${merged.maxFields}`);
                errored = true;
                cleanup();
                reject(err);
                return;
            }
            fields.push({ fieldname, value });
        });

        busboy.on("limit", (field: string) => {
            if (errored) return;
            errored = true;
            cleanup();
            if (field === "fileSize") {
                reject(new MultipartFileTooLargeError(merged.maxFileSize));
            } else if (field === "files") {
                reject(new MultipartTooManyFilesError(merged.maxFiles));
            } else if (field === "fields") {
                reject(new MultipartTooManyFieldsError(merged.maxFields));
            }
        });

        busboy.on("filesLimit", () => {
            if (errored) return;
            errored = true;
            cleanup();
            reject(new MultipartTooManyFilesError(merged.maxFiles));
        });

        busboy.on("fieldsLimit", () => {
            if (errored) return;
            errored = true;
            cleanup();
            reject(new MultipartTooManyFieldsError(merged.maxFields));
        });

        busboy.on("finish", () => {
            if (errored) return;
            finalize();
        });

        busboy.on("error", (err: Error) => {
            if (errored) return;
            errored = true;
            cleanup();
            reject(err);
        });

        // Timeout safety net
        const timeout = setTimeout(() => {
            if (!finished && !errored) {
                errored = true;
                cleanup();
                reject(new Error("Multipart parse timeout"));
            }
        }, merged.timeoutMs);

        busboy.on("finish", () => clearTimeout(timeout));
        busboy.on("error", () => clearTimeout(timeout));

        // Request abort handling
        const reqAny = req as any;
        const onAbort = () => {
            if (finished || errored) return;
            errored = true;
            cleanup();
            clearTimeout(timeout);
            reject(new Error("Request aborted"));
        };

        if (reqAny?.aborted) {
            onAbort();
        } else {
            reqAny?.on?.("close", onAbort);
            reqAny?.on?.("abort", onAbort);
        }

        (req as any)?.pipe?.(busboy);
    });
}
