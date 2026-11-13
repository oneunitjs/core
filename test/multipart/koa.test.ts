import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createMultipart, koaMultipartMiddleware } from "../../src/multipart/index.js";
import Koa from "koa";
import http from "node:http";

describe("Multipart - Koa", () => {
    describe("Middleware unit", () => {
        it("creates koa multipart middleware", () => {
            const mw = koaMultipartMiddleware();
            expect(typeof mw).toBe("function");
        });
    });

    describe("Koa real server", () => {
        let app: Koa;
        let server: http.Server;
        let port: number;

        beforeAll(async () => {
            app = new Koa();

            app.use(async (ctx) => {
                if (ctx.path === "/upload" && ctx.method === "POST") {
                    await koaMultipartMiddleware()(ctx as any, async () => {});
                    const multipart = (ctx as any).multipart;
                    ctx.body = {
                        fields: multipart.fields,
                        files: multipart.files.map((f) => ({
                            fieldname: f.fieldname,
                            originalname: f.originalname,
                            mimetype: f.mimetype,
                            size: f.size,
                        })),
                    };
                } else {
                    ctx.status = 404;
                }
            });

            server = http.createServer(app.callback());
            await new Promise<void>((resolve) => server.listen(0, resolve));
            port = (server.address() as any).port;
        });

        afterAll(async () => {
            await new Promise<void>((resolve) => server.close(resolve));
        });

        async function upload(fields: { name: string; value: string }[], files: { name: string; filename: string; content: string; mime: string }[]): Promise<{ statusCode: number; body: any }> {
            const boundary = "----KoaBoundaryABC";
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

        it("uploads fields and files via koa", async () => {
            const res = await upload(
                [{ name: "name", value: "test-file" }],
                [{ name: "file", filename: "test.bin", content: "binary-data", mime: "application/octet-stream" }],
            );

            expect(res.statusCode).toBe(200);
            expect(res.body.fields).toEqual([{ fieldname: "name", value: "test-file" }]);
            expect(res.body.files).toHaveLength(1);
            expect(res.body.files[0].originalname).toBe("test.bin");
            expect(res.body.files[0].size).toBe(11);
        });
    });
});
