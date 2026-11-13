import { describe, it, expect } from "vitest";
import { parseMultipart } from "../../src/multipart/parser.js";
import type { MultipartOptions } from "../../src/multipart/types.js";

function makeMultipartBody(fields: { name: string; value: string }[], files: { name: string; filename: string; content: string; mime: string }[]): Buffer {
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZZ0gW";
    const parts: Buffer[] = [];

    for (const field of fields) {
        parts.push(Buffer.from(`--${boundary}\r\n`));
        parts.push(Buffer.from(`Content-Disposition: form-data; name="${field.name}"\r\n\r\n`));
        parts.push(Buffer.from(`${field.value}\r\n`));
    }

    for (const file of files) {
        parts.push(Buffer.from(`--${boundary}\r\n`));
        parts.push(Buffer.from(`Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n`));
        parts.push(Buffer.from(`Content-Type: ${file.mime}\r\n\r\n`));
        parts.push(Buffer.from(file.content));
        parts.push(Buffer.from("\r\n"));
    }

    parts.push(Buffer.from(`--${boundary}--\r\n`));

    return Buffer.concat(parts);
}

function makeRequest(headers: Record<string, string>, body: Buffer): any {
    return {
        headers,
        pipe: (dest: any) => {
            dest.write(body);
            dest.end();
            return dest;
        },
    };
}

describe("parseMultipart", () => {
    it("parses fields and files", async () => {
        const body = makeMultipartBody(
            [{ name: "username", value: "john" }],
            [{ name: "avatar", filename: "avatar.png", content: "fake-image-data", mime: "image/png" }],
        );

        const req = makeRequest(
            { "content-type": `multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZZ0gW` },
            body,
        );

        const result = await parseMultipart(req);

        expect(result.fields).toEqual([{ fieldname: "username", value: "john" }]);
        expect(result.files).toHaveLength(1);
        expect(result.files[0].fieldname).toBe("avatar");
        expect(result.files[0].originalname).toBe("avatar.png");
        expect(result.files[0].mimetype).toBe("image/png");
        expect(result.files[0].size).toBe(15);
        expect(result.files[0].buffer.toString()).toBe("fake-image-data");
    });

    it("parses multiple fields", async () => {
        const body = makeMultipartBody(
            [{ name: "title", value: "Hello" }, { name: "description", value: "World" }],
            [],
        );

        const req = makeRequest(
            { "content-type": `multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZZ0gW` },
            body,
        );

        const result = await parseMultipart(req);

        expect(result.fields).toEqual([
            { fieldname: "title", value: "Hello" },
            { fieldname: "description", value: "World" },
        ]);
        expect(result.files).toEqual([]);
    });

    it("parses multiple files", async () => {
        const body = makeMultipartBody(
            [],
            [
                { name: "file1", filename: "a.txt", content: "content-a", mime: "text/plain" },
                { name: "file2", filename: "b.txt", content: "content-b", mime: "text/plain" },
            ],
        );

        const req = makeRequest(
            { "content-type": `multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZZ0gW` },
            body,
        );

        const result = await parseMultipart(req);

        expect(result.files).toHaveLength(2);
        expect(result.files[0].originalname).toBe("a.txt");
        expect(result.files[1].originalname).toBe("b.txt");
    });

    it("enforces maxFileSize", async () => {
        const body = makeMultipartBody(
            [],
            [{ name: "big", filename: "big.txt", content: "x".repeat(200), mime: "text/plain" }],
        );

        const req = makeRequest(
            { "content-type": `multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZZ0gW` },
            body,
        );

        await expect(parseMultipart(req, { maxFileSize: 100 })).rejects.toThrow();
    });

    it("enforces allowedMimeTypes", async () => {
        const body = makeMultipartBody(
            [],
            [{ name: "exe", filename: "malware.exe", content: "binary", mime: "application/x-executable" }],
        );

        const req = makeRequest(
            { "content-type": `multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZZ0gW` },
            body,
        );

        const result = await parseMultipart(req, { allowedMimeTypes: ["image/png", "image/jpeg"] });

        expect(result.files).toEqual([]);
    });

    it("uses fileFilter to reject files", async () => {
        const body = makeMultipartBody(
            [],
            [{ name: "doc", filename: "doc.pdf", content: "pdf-data", mime: "application/pdf" }],
        );

        const req = makeRequest(
            { "content-type": `multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZZ0gW` },
            body,
        );

        const result = await parseMultipart(req, {
            fileFilter: (f) => f.mimetype !== "application/pdf",
        });

        expect(result.files).toEqual([]);
    });

    it("enforces maxFiles", async () => {
        const body = makeMultipartBody(
            [],
            [
                { name: "f1", filename: "1.txt", content: "a", mime: "text/plain" },
                { name: "f2", filename: "2.txt", content: "b", mime: "text/plain" },
                { name: "f3", filename: "3.txt", content: "c", mime: "text/plain" },
            ],
        );

        const req = makeRequest(
            { "content-type": `multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZZ0gW` },
            body,
        );

        await expect(parseMultipart(req, { maxFiles: 2 })).rejects.toThrow();
    });

    it("enforces maxFields", async () => {
        const body = makeMultipartBody(
            [
                { name: "a", value: "1" },
                { name: "b", value: "2" },
                { name: "c", value: "3" },
            ],
            [],
        );

        const req = makeRequest(
            { "content-type": `multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZZ0gW` },
            body,
        );

        await expect(parseMultipart(req, { maxFields: 2 })).rejects.toThrow();
    });

    it("returns empty result for no parts", async () => {
        const body = Buffer.from(`--boundary--\r\n`);
        const req = makeRequest(
            { "content-type": `multipart/form-data; boundary=boundary` },
            body,
        );

        const result = await parseMultipart(req);

        expect(result.files).toEqual([]);
        expect(result.fields).toEqual([]);
    });
});
