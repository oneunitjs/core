import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createMultipart, fastifyMultipartMiddleware } from "../../src/multipart/index.js";
import Fastify from "fastify";

describe("Multipart - Fastify", () => {
    describe("Middleware unit", () => {
        it("creates fastify multipart middleware", () => {
            const mw = fastifyMultipartMiddleware();
            expect(typeof mw).toBe("function");
        });
    });

    describe("Fastify real server", () => {
        let fastify: Fastify.FastifyInstance;
        let port: number;

        beforeAll(async () => {
            fastify = Fastify();

            fastify.addContentTypeParser("multipart/form-data", { parseAs: "buffer" }, (_req, body, done) => {
                done(null, body);
            });

            fastify.post("/upload", async (req, reply) => {
                try {
                    await fastifyMultipartMiddleware()(req, reply);
                    const multipart = (req as any).multipart;
                    reply.send({
                        fields: multipart.fields,
                        files: multipart.files.map((f) => ({
                            fieldname: f.fieldname,
                            originalname: f.originalname,
                            mimetype: f.mimetype,
                            size: f.size,
                        })),
                    });
                } catch (err: any) {
                    console.error("FASTIFY ERROR:", err);
                    reply.status(500).send({ error: err?.message ?? String(err) });
                }
            });

            await fastify.ready();
            await new Promise<void>((resolve) => fastify.server.listen(0, resolve));
            port = (fastify.server.address() as any).port;
        });

        afterAll(async () => {
            await fastify.close();
        });

        async function upload(fields: { name: string; value: string }[], files: { name: string; filename: string; content: string; mime: string }[]): Promise<{ statusCode: number; body: any }> {
            const boundary = "----FastifyBoundary789";
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

            return fastify.inject({
                method: "POST",
                url: "/upload",
                headers: {
                    "content-type": `multipart/form-data; boundary=${boundary}`,
                },
                body,
            }).then((res) => ({
                statusCode: res.statusCode,
                body: JSON.parse(res.payload),
            }));
        }

        it("uploads fields and files via fastify", async () => {
            const res = await upload(
                [{ name: "title", value: "My File" }],
                [{ name: "upload", filename: "data.txt", content: "hello world", mime: "text/plain" }],
            );

            expect(res.statusCode).toBe(200);
            expect(res.body.fields).toEqual([{ fieldname: "title", value: "My File" }]);
            expect(res.body.files).toHaveLength(1);
            expect(res.body.files[0].originalname).toBe("data.txt");
            expect(res.body.files[0].size).toBe(11);
        });
    });
});
