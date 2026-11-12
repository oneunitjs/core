import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHealthProvider, expressHealth } from "../../../src/index.js";
import express from "express";
import http from "node:http";

describe("expressHealth", () => {
    let server: http.Server;
    let port: number;

    beforeAll(async () => {
        const app = express();
        const health = expressHealth(app, { path: "/health", serviceName: "api" });
        health.registry.register(createHealthProvider("db", async () => ({ status: "healthy" }), true));

        server = http.createServer(app);
        await new Promise<void>((resolve) => server.listen(0, resolve));
        port = (server.address() as any).port;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(resolve));
    });

    async function request(path: string): Promise<{ statusCode: number; body: any }> {
        return new Promise((resolve, reject) => {
            const req = http.request(
                { hostname: "127.0.0.1", port, path, method: "GET" },
                (res) => {
                    let data = "";
                    res.on("data", (chunk) => { data += chunk; });
                    res.on("end", () => {
                        resolve({ statusCode: res.statusCode ?? 0, body: JSON.parse(data) });
                    });
                },
            );
            req.on("error", reject);
            req.end();
        });
    }

    it("responds 200 with healthy status", async () => {
        const res = await request("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.service).toBe("api");
        expect(res.body.status).toBe("healthy");
    });

    it("responds 503 when critical check fails", async () => {
        const app2 = express();
        const health2 = expressHealth(app2, { path: "/health" });
        health2.registry.register(createHealthProvider("db", async () => ({ status: "unhealthy" }), true));

        const server2 = http.createServer(app2);
        await new Promise<void>((resolve) => server2.listen(0, resolve));
        const port2 = (server2.address() as any).port;

        const res = await new Promise<{ statusCode: number; body: any }>((resolve, reject) => {
            const req = http.request(
                { hostname: "127.0.0.1", port: port2, path: "/health", method: "GET" },
                (res) => {
                    let data = "";
                    res.on("data", (chunk) => { data += chunk; });
                    res.on("end", () => {
                        resolve({ statusCode: res.statusCode ?? 0, body: JSON.parse(data) });
                    });
                },
            );
            req.on("error", reject);
            req.end();
        });

        expect(res.statusCode).toBe(503);
        expect(res.body.status).toBe("unhealthy");

        await new Promise<void>((resolve) => server2.close(resolve));
    });
});
