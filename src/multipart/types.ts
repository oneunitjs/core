export type MultipartFile = {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
    destination?: string;
    filename?: string;
    path?: string;
};

export type MultipartField = {
    fieldname: string;
    value: string;
};

export type MultipartResult = {
    files: MultipartFile[];
    fields: MultipartField[];
};

export type MultipartOptions = {
    /** Maximum file size in bytes (default: 10MB) */
    maxFileSize?: number;
    /** Maximum total fields size in bytes (default: 10MB) */
    maxFieldsSize?: number;
    /** Maximum number of files (default: 10) */
    maxFiles?: number;
    /** Maximum number of fields (default: 20) */
    maxFields?: number;
    /** Allowed file mimetypes (e.g. ["image/jpeg", "image/png"]). Empty array = all allowed */
    allowedMimeTypes?: string[];
    /** Upload directory for streamed files (default: memory/buffer) */
    uploadDir?: string;
    /** File filter function: return true to accept the file */
    fileFilter?: (file: { fieldname: string; originalname: string; mimetype: string }) => boolean;
    /** Temporary directory for busboy */
    tmpdir?: string;
    /** Headers limits */
    headersLimit?: number;
};

export interface MultipartMiddleware {
    name: string;
    enabled: boolean;
    options: MultipartOptions;
    enable(): void;
    disable(): void;
    toggle(): void;
    parse(req: unknown): Promise<MultipartResult>;
    middleware(): (req: unknown, res: unknown, next?: () => void) => Promise<void>;
}
