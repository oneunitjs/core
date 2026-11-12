import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHooks } from "../../src/hooks/index.js";
import http from "node:http";

describe("hooks with node:http (framework-agnostic)", () => {
    let server: http.Server;
    let port: number;

    beforeAll(async () => {
        // Pure node:http — hooks used directly without any framework
        const hooks = createHooks<{ req: http.IncomingMessage; res: http.ServerResponse }>();
        const events: string[] = [];

        hooks.on("request", async (ctx) => {
            events.push(`req:${ctx.req.method} ${ctx.req.url}`);
        });
        hooks.on("finish", async (ctx) => {
            events.push(`finish:${ctx.res.statusCode}`);
        });

        server = http.createServer(async (req, res) => {
            await hooks.emit("request", { req, res });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "hello" }));

            await hooks.emit("finish", { req, res });
        });

        await new Promise<void>((resolve) => server.listen(0, resolve));
        port = (server.address() as any).port;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(resolve));
    });

    it("fires hooks directly on node:http server", async () => {
        const res = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
            const req = http.request(
                { hostname: "127.0.0.1", port, path: "/hello", method: "GET" },
                (res) => {
                    let data = "";
                    res.on("data", (chunk) => { data += chunk; });
                    res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
                },
            );
            req.on("error", reject);
            req.end();
        });

        expect(res.statusCode).toBe(200);
        expect(res.body).toContain("hello");
    });
});
