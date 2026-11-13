import { OneUnitError } from "./base.js";
import type { OneUnitErrorOptions } from "./types.js";

export class MultipartError extends OneUnitError {
    constructor(message: string, options?: OneUnitErrorOptions) {
        super(message, { category: "multipart", code: "MULTIPART_ERROR", ...options });
        this.name = "MultipartError";
    }
}

export class MultipartDisabledError extends MultipartError {
    constructor(options?: OneUnitErrorOptions) {
        super("Multipart middleware is disabled", {
            code: "MULTIPART_DISABLED",
            ...options,
        });
        this.name = "MultipartDisabledError";
    }
}

export class MultipartFileTooLargeError extends MultipartError {
    constructor(maxFileSize: number, options?: OneUnitErrorOptions) {
        super(`File too large: max ${maxFileSize} bytes`, {
            code: "MULTIPART_FILE_TOO_LARGE",
            details: { maxFileSize },
            ...options,
        });
        this.name = "MultipartFileTooLargeError";
    }
}

export class MultipartTooManyFilesError extends MultipartError {
    constructor(maxFiles: number, options?: OneUnitErrorOptions) {
        super(`Too many files: max ${maxFiles}`, {
            code: "MULTIPART_TOO_MANY_FILES",
            details: { maxFiles },
            ...options,
        });
        this.name = "MultipartTooManyFilesError";
    }
}

export class MultipartTooManyFieldsError extends MultipartError {
    constructor(maxFields: number, options?: OneUnitErrorOptions) {
        super(`Too many fields: max ${maxFields}`, {
            code: "MULTIPART_TOO_MANY_FIELDS",
            details: { maxFields },
            ...options,
        });
        this.name = "MultipartTooManyFieldsError";
    }
}

export class MultipartInvalidMimeTypeError extends MultipartError {
    constructor(mimetype: string, options?: OneUnitErrorOptions) {
        super(`Invalid MIME type: ${mimetype}`, {
            code: "MULTIPART_INVALID_MIME_TYPE",
            details: { mimetype },
            ...options,
        });
        this.name = "MultipartInvalidMimeTypeError";
    }
}

export class MultipartParseTimeoutError extends MultipartError {
    constructor(options?: OneUnitErrorOptions) {
        super("Multipart parse timeout", {
            code: "MULTIPART_PARSE_TIMEOUT",
            ...options,
        });
        this.name = "MultipartParseTimeoutError";
    }
}
