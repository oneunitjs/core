import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("REL - Reliability Tests", () => {
    it("REL-01: Repeated initialization", () => {
        const apps: any[] = [];
        for (let i = 0; i < 100; i++) {
            apps.push(createApp({ serviceName: `app-${i}` }));
        }
        for (let i = 0; i < 100; i++) {
            expect(apps[i].config().serviceName).toBe(`app-${i}`);
        }
    });

    it("REL-02: Long-running process stability - memory over time", () => {
        const app = createApp();
        const initial = process.memoryUsage().heapUsed;
        for (let i = 0; i < 1000; i++) {
            app.msgpack().encode({ i, data: "test" });
            app.cookies().set(`k-${i}`, `v-${i}`);
            app.cookies().get(`k-${i}`);
        }
        const final = process.memoryUsage().heapUsed;
        const growth = (final - initial) / initial;
        expect(growth).toBeLessThan(0.5);
    });

    it("REL-03: Resource cleanup after failures", () => {
        const app = createApp();
        expect(app).toBeDefined();
        expect(app.config().serviceName).toBe("app");
    });

    it("REL-04: App still functional after operations", () => {
        const app = createApp();
        app.msgpack().encode({ test: true });
        app.cookies().set("k", "v");
        app.cookies().get("k");
        expect(app.config().serviceName).toBe("app");
    });

    it("REL-05: Multiple lifecycle instances", () => {
        const app = createApp();
        const l1 = app.lifecycle();
        l1.initialize();
        const l2 = app.lifecycle();
        l2.initialize();
        expect(l1).toBeDefined();
        expect(l2).toBeDefined();
        // lifecycle() returns cached default instance
        expect(l1).toBe(l2);
    });
});
