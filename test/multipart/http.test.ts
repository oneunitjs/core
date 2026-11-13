import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createMultipart, httpMultipartMiddleware } from "../../src/multipart/index.js";
import http from "node:http";

describe("Multipart - node:http", () => {
    describe("Middleware unit", () => {
        it("creates http multipart middleware", () => {
            const mw = httpMultipartMiddleware();
            expect(typeof mw).toBe("function");
        });
    });

    describe("node:http real server", () => {
        let server: http.Server;
        let port: number;

        beforeAll(async () => {
            server = http.createServer(async (req, res) => {
                if (req?.url === "/upload" && req?.method === "POST") {
                    await httpMultipartMiddleware()(req, res);
                    if ((res as any).headersSent) return;
                    const multipart = (req as any).multipart;
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        fields: multipart.fields,
                        files: multipart.files.map((f) => ({
                            fieldname: f.fieldname,
                            originalname: f.originalname,
                            mimetype: f.mimetype,
                            size: f.size,
                        })),
                    }));
                } else {
                    res.writeHead(404).end();
                }
            });
            await new Promise<void>((resolve) => server.listen(0, resolve));
            port = (server.address() as any).port;
        });

        afterAll(async () => {
            await new Promise<void>((resolve) => server.close(resolve));
        });

        async function upload(fields: { name: string; value: string }[], files: { name: string; filename: string; content: string; mime: string }[]): Promise<{ statusCode: number; body: any }> {
            const boundary = "----HttpBoundaryXYZ";
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

        it("uploads fields and files via node:http", async () => {
            const res = await upload(
                [{ name: "key", value: "value" }],
                [{ name: "bin", filename: "blob.dat", content: "blob-content", mime: "application/octet-stream" }],
            );

            expect(res.statusCode).toBe(200);
            expect(res.body.fields).toEqual([{ fieldname: "key", value: "value" }]);
            expect(res.body.files).toHaveLength(1);
            expect(res.body.files[0].originalname).toBe("blob.dat");
            expect(res.body.files[0].size).toBe(12);
        });

        it("returns 400 on parse error", async () => {
            const boundary = "----BadBoundary";
            const body = Buffer.from(`--${boundary}\r\n`);

            return new Promise((resolve, reject) => {
                const req = http.request(
                    {
                        hostname: "127.0.0.1",
                        port,
                        path: "/upload",
                        method: "POST",
                        headers: {
                            "content-type": `multipart/form-data; boundary=${boundary}`,
                        },
                    },
                    (res) => {
                        let data = "";
                        res.on("data", (chunk) => { data += chunk; });
                        res.on("end", () => {
                            resolve({ statusCode: res.statusCode ?? 0, body: data });
                        });
                    },
                );
                req.on("error", reject);
                req.end(body);
            }).then((res) => {
                expect(res.statusCode).toBe(400);
            });
        });
    });
});
