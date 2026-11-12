import { describe, it, expect } from "vitest";
import { formatBytes, formatTime, timestamp } from "../../src/lib/formatter.js";
import { getSystemInfo } from "../../src/lib/system.js";
import {
    getSystemStatus,
    DEFAULT_THRESHOLDS,
    type SystemStatus,
} from "../../src/lib/system-status.js";

describe("formatBytes", () => {
    it("formats bytes correctly", () => {
        expect(formatBytes(0)).toBe("0 Bytes");
        expect(formatBytes(1024)).toBe("1 KB");
        expect(formatBytes(1536)).toBe("1.5 KB");
        expect(formatBytes(1048576)).toBe("1 MB");
    });

    it("throws on negative bytes", () => {
        expect(() => formatBytes(-1)).toThrow("Bytes must be positive");
    });

    it("throws on non-finite bytes", () => {
        expect(() => formatBytes(NaN)).toThrow("Bytes must be a finite number");
    });
});

describe("formatTime", () => {
    it("formats milliseconds", () => {
        expect(formatTime(25)).toBe("25ms");
        expect(formatTime(1500)).toBe("1.5s");
        expect(formatTime(90000)).toBe("1.5m");
        expect(formatTime(7200000)).toBe("2h");
    });

    it("throws on negative time", () => {
        expect(() => formatTime(-1)).toThrow("Time must be positive");
    });
});

describe("timestamp", () => {
    it("formats a Date to ISO string", () => {
        const date = new Date("2022-01-01T00:00:00.000Z");
        expect(timestamp(date)).toBe("2022-01-01T00:00:00.000Z");
    });

    it("throws on non-Date", () => {
        expect(() => timestamp("not a date" as any)).toThrow("Data must be a Date object");
    });
});

describe("getSystemStatus", () => {
    it("returns healthy when all checks pass and resources are normal", () => {
        const status: SystemStatus = getSystemStatus(
            { memory: { usagePercent: 50 }, cpu: { cores: 4, loadAverage: { oneMinute: 0.5 } } },
            { memory: { status: true }, cpu: { status: true } },
            DEFAULT_THRESHOLDS,
        );
        expect(status).toBe("healthy");
    });

    it("returns unhealthy when a check fails", () => {
        const status: SystemStatus = getSystemStatus(
            { memory: { usagePercent: 50 }, cpu: { cores: 4, loadAverage: { oneMinute: 0.5 } } },
            { memory: { status: false } },
            DEFAULT_THRESHOLDS,
        );
        expect(status).toBe("unhealthy");
    });

    it("returns unhealthy when memory is critically high", () => {
        const status: SystemStatus = getSystemStatus(
            { memory: { usagePercent: 95 }, cpu: { cores: 4, loadAverage: { oneMinute: 0.5 } } },
            { memory: { status: true }, cpu: { status: true } },
            DEFAULT_THRESHOLDS,
        );
        expect(status).toBe("unhealthy");
    });

    it("returns degraded when memory is moderately high", () => {
        const status: SystemStatus = getSystemStatus(
            { memory: { usagePercent: 80 }, cpu: { cores: 4, loadAverage: { oneMinute: 0.5 } } },
            { memory: { status: true }, cpu: { status: true } },
            DEFAULT_THRESHOLDS,
        );
        expect(status).toBe("degraded");
    });

    it("returns unhealthy when load is critically high", () => {
        const status: SystemStatus = getSystemStatus(
            { memory: { usagePercent: 50 }, cpu: { cores: 4, loadAverage: { oneMinute: 5 } } },
            { memory: { status: true }, cpu: { status: true } },
            DEFAULT_THRESHOLDS,
        );
        expect(status).toBe("unhealthy");
    });
});

describe("getSystemInfo", () => {
    it("returns system information", () => {
        const info = getSystemInfo();

        expect(info.process.pid).toBeGreaterThan(0);
        expect(info.process.node).toBeDefined();
        expect(info.process.environment).toBeDefined();
        expect(info.memory.total).toBeDefined();
        expect(info.memory.usagePercent).toBeGreaterThanOrEqual(0);
        expect(info.cpu.cores).toBeGreaterThan(0);
        expect(info.cpu.model).toBeDefined();
        expect(info.user.username).toBeDefined();
    });
});
