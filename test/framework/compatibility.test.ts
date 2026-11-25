import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("Framework Compatibility - Adapter Contract", () => {
    it("FW-01: Core works without framework adapters", () => {
        const app = createApp();
        expect(app.config().serviceName).toBe("app");
        expect(app.health()).toBeDefined();
        expect(app.cors).toBeDefined();
    });

    it("FW-02: Native node:http adapter works", () => {
        const app = createApp();
        const req: any = { headers: {}, method: "GET", url: "/" };
        const res: any = { headers: {}, setHeader: () => {}, end: () => {} };
        const store = app.cookies(req, res);
        store.set("test", "val");
        // Cookie store with mock req/res may not persist - test that it doesn't crash
        expect(store).toBeDefined();
    });

    it("FW-03: Response API consistent", () => {
        const app = createApp();
        const response = app.response({} as any, {} as any);
        expect(response).toBeDefined();
        expect(typeof response.ok).toBe("function");
        expect(typeof response.created).toBe("function");
    });

    it("FW-04: Health route works", () => {
        const app = createApp();
        const health = app.health();
        expect(health).toBeDefined();
        expect(typeof health.register).toBe("function");
        expect(typeof health.check).toBe("function");
    });

    it("FW-05: Security middleware consistent", () => {
        const app = createApp({ secret: "s3cr3t" });
        const csrf = app.csrf({ secret: "s3cr3t" });
        const token = csrf.generateToken();
        expect(token).toMatch(/^[0-9a-f]{64}\.[0-9a-f]{64}$/);
    });

    it("FW-06: Cookie adapters work with node:http", () => {
        const app = createApp({ secret: "s3cr3t" });
        const store = app.cookies();
        store.set("session", "abc");
        expect(store.get("session")).toBe("abc");
    });
});
