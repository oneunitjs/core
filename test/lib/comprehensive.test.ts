import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("LIB - System Utilities", () => {
    it("LIB-01: formatBytes() human-readable output", () => {
        const app = createApp();
        const lib = app.lib();
        expect(lib.formatBytes(0)).toBe("0 Bytes");
        expect(lib.formatBytes(1024)).toContain("KB");
        expect(lib.formatBytes(1024 * 1024)).toContain("MB");
    });

    it("LIB-02: formatTime() human-readable output", () => {
        const app = createApp();
        const lib = app.lib();
        expect(lib.formatTime(500)).toContain("ms");
        expect(lib.formatTime(5000)).toContain("s");
    });

    it("LIB-03: timestamp() ISO-8601 format", () => {
        const app = createApp();
        const lib = app.lib();
        const ts = lib.timestamp(new Date());
        expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("LIB-04: getSystemInfo() returns platform data", () => {
        const app = createApp();
        const lib = app.lib();
        const info = lib.getSystemInfo();
        expect(info).toBeDefined();
    });

    it("LIB-05: getSystemStatus() aggregates metrics", () => {
        const app = createApp();
        const lib = app.lib();
        const status = lib.getSystemStatus(
            { memory: { usagePercent: 50 }, cpu: { cores: 1, loadAverage: { oneMinute: 0.5 } } },
            {},
        );
        expect(status).toBeDefined();
        expect(["healthy", "degraded", "unhealthy"]).toContain(status);
    });

    it("LIB-06: Lib API has formatBytes", () => {
        const app = createApp();
        const lib = app.lib();
        expect(typeof lib.formatBytes).toBe("function");
    });

    it("LIB-07: Lib API has formatTime", () => {
        const app = createApp();
        const lib = app.lib();
        expect(typeof lib.formatTime).toBe("function");
    });
});
