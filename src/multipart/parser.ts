import Busboy from "busboy";
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
    };

    const effectiveHeaders = headers ?? (req as any)?.headers;

    return new Promise((resolve, reject) => {
        const busboy = Busboy({
            headers: effectiveHeaders,
            limits: {
                headerPairs: merged.headersLimit ?? 2000,
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
        }, 10000);

        busboy.on("finish", () => clearTimeout(timeout));
        busboy.on("error", () => clearTimeout(timeout));

        (req as any)?.pipe?.(busboy);
    });
}
