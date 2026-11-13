import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createMultipart, expressMultipartMiddleware } from "../../src/multipart/index.js";
import express from "express";
import http from "node:http";

describe("Multipart - Express", () => {
    describe("Middleware unit", () => {
        it("creates multipart middleware", () => {
            const mp = createMultipart();
            expect(mp.enabled).toBe(true);
            expect(mp.name).toBe("multipart");
        });

        it("enables and disables", () => {
            const mp = createMultipart();
            mp.disable();
            expect(mp.enabled).toBe(false);
            mp.enable();
            expect(mp.enabled).toBe(true);
            mp.toggle();
            expect(mp.enabled).toBe(false);
        });
    });

    describe("Express real server", () => {
        let app: express.Application;
        let server: http.Server;
        let port: number;

        beforeAll(async () => {
            app = express();

            app.post("/upload", expressMultipartMiddleware(), async (req, res) => {
                const multipart = (req as any).multipart;
                res.json({
                    fields: multipart.fields,
                    files: multipart.files.map((f) => ({
                        fieldname: f.fieldname,
                        originalname: f.originalname,
                        mimetype: f.mimetype,
                        size: f.size,
                    })),
                });
            });

            server = http.createServer(app);
            await new Promise<void>((resolve) => server.listen(0, resolve));
            port = (server.address() as any).port;
        });

        afterAll(async () => {
            await new Promise<void>((resolve) => server.close(resolve));
        });

        async function upload(fields: { name: string; value: string }[], files: { name: string; filename: string; content: string; mime: string }[]): Promise<{ statusCode: number; body: any }> {
            const boundary = "----TestBoundary123456";
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
            const body = Buffer.concat(parts);

            return new Promise((resolve, reject) => {
                const req = http.request(
                    {
                        hostname: "127.0.0.1",
                        port,
                        path: "/upload",
                        method: "POST",
                        headers: {
                            "content-type": `multipart/form-data; boundary=${boundary}`,
                            "content-length": body.length,
                        },
                    },
                    (res) => {
                        let data = "";
                        res.on("data", (chunk) => { data += chunk; });
                        res.on("end", () => {
                            let parsed: any;
                            try { parsed = JSON.parse(data); } catch { parsed = data; }
                            resolve({ statusCode: res.statusCode ?? 0, body: parsed });
                        });
                    },
                );
                req.on("error", reject);
                req.end(body);
            });
        }

        it("uploads fields and files via express", async () => {
            const res = await upload(
                [{ name: "username", value: "alice" }],
                [{ name: "avatar", filename: "profile.jpg", content: "image-bytes", mime: "image/jpeg" }],
            );

            expect(res.statusCode).toBe(200);
            expect(res.body.fields).toEqual([{ fieldname: "username", value: "alice" }]);
            expect(res.body.files).toHaveLength(1);
            expect(res.body.files[0].originalname).toBe("profile.jpg");
            expect(res.body.files[0].mimetype).toBe("image/jpeg");
            expect(res.body.files[0].size).toBe(11);
        });

        it("uploads multiple files via express", async () => {
            const res = await upload(
                [],
                [
                    { name: "doc1", filename: "a.pdf", content: "pdf1", mime: "application/pdf" },
                    { name: "doc2", filename: "b.pdf", content: "pdf2", mime: "application/pdf" },
                ],
            );

            expect(res.statusCode).toBe(200);
            expect(res.body.files).toHaveLength(2);
        });
    });
});
