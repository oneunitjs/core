import { describe, it, expect } from "vitest";
import { formatBytes, formatTime, timestamp, getSystemInfo, getSystemStatus } from "../../src/lib/index.js";

describe("Lib - formatBytes", () => {
    it("should format bytes as bytes", () => {
        expect(formatBytes(0)).toBe("0 Bytes");
    });

    it("should format bytes as KB", () => {
        expect(formatBytes(1024)).toBe("1 KB");
    });

    it("should format bytes as MB", () => {
        expect(formatBytes(1048576)).toBe("1 MB");
    });

    it("should format bytes as GB", () => {
        expect(formatBytes(1073741824)).toBe("1 GB");
    });

    it("should format bytes with decimals", () => {
        expect(formatBytes(1536, 2)).toBe("1.5 KB");
    });

    it("should throw for negative bytes", () => {
        expect(() => formatBytes(-1)).toThrow(/Bytes must be positive/);
    });

    it("should throw for non-finite bytes", () => {
        expect(() => formatBytes(NaN)).toThrow(/Bytes must be a finite number/);
    });

    it("should throw for Infinity bytes", () => {
        expect(() => formatBytes(Infinity)).toThrow(/Bytes must be a finite number/);
    });
});

describe("Lib - formatTime", () => {
    it("should format time as ms", () => {
        const result = formatTime(25);
        expect(result).toMatch(/ms$/);
    });

    it("should format time as seconds", () => {
        const result = formatTime(1500);
        expect(result).toMatch(/s$/);
    });

    it("should format time as minutes", () => {
        const result = formatTime(90000);
        expect(result).toMatch(/m$/);
    });

    it("should format time as hours", () => {
        const result = formatTime(7200000);
        expect(result).toMatch(/h$/);
    });

    it("should throw for negative time", () => {
        expect(() => formatTime(-1)).toThrow(/Time must be positive/);
    });

    it("should throw for non-finite time", () => {
        expect(() => formatTime(NaN)).toThrow(/Time must be a finite number/);
    });
});

describe("Lib - timestamp", () => {
    it("should format date as ISO string", () => {
        const date = new Date("2024-01-15T10:30:00.000Z");
        expect(timestamp(date)).toBe("2024-01-15T10:30:00.000Z");
    });

    it("should throw for non-Date input", () => {
        expect(() => timestamp("not-a-date" as unknown as Date)).toThrow(/Data must be a Date object/);
    });

    it("should throw for null input", () => {
        expect(() => timestamp(null as unknown as Date)).toThrow(/Data must be a Date object/);
    });
});

describe("Lib - getSystemInfo", () => {
    it("should return system info object", () => {
        const info = getSystemInfo();
        expect(info.process).toBeDefined();
        expect(info.performance).toBeDefined();
        expect(info.memory).toBeDefined();
        expect(info.cpu).toBeDefined();
        expect(info.network).toBeDefined();
        expect(info.user).toBeDefined();
    });
});

describe("Lib - getSystemStatus", () => {
    it("should return healthy status when all checks pass", () => {
        const result = getSystemStatus(
            { cpu: { cores: 4, loadAverage: { oneMinute: 0.3 } }, memory: { usagePercent: 40 } },
            { db: { status: true }, cache: { status: true } }
        );
        expect(result).toBe("healthy");
    });

    it("should return degraded status when memory usage is high", () => {
        const result = getSystemStatus(
            { cpu: { cores: 4, loadAverage: { oneMinute: 0.3 } }, memory: { usagePercent: 60 } },
            { db: { status: true }, cache: { status: true } },
            { memory: { degraded: 50, unhealthy: 90 }, load: { degraded: 0.7, unhealthy: 1 } }
        );
        expect(result).toBe("degraded");
    });

    it("should return unhealthy status when any check fails", () => {
        const result = getSystemStatus(
            { cpu: { cores: 4, loadAverage: { oneMinute: 0.3 } }, memory: { usagePercent: 40 } },
            { db: { status: true }, cache: { status: false } }
        );
        expect(result).toBe("unhealthy");
    });

    it("should return unhealthy when CPU load is high", () => {
        const result = getSystemStatus(
            { cpu: { cores: 1, loadAverage: { oneMinute: 1.5 } }, memory: { usagePercent: 40 } },
            { db: { status: true }, cache: { status: true } },
            { memory: { degraded: 75, unhealthy: 90 }, load: { degraded: 0.7, unhealthy: 1 } }
        );
        expect(result).toBe("unhealthy");
    });

    it("should return unhealthy when memory usage is high", () => {
        const result = getSystemStatus(
            { cpu: { cores: 4, loadAverage: { oneMinute: 0.3 } }, memory: { usagePercent: 95 } },
            { db: { status: true }, cache: { status: true } },
            { memory: { degraded: 75, unhealthy: 90 }, load: { degraded: 0.7, unhealthy: 1 } }
        );
        expect(result).toBe("unhealthy");
    });

    it("should handle empty checks", () => {
        const result = getSystemStatus({ cpu: { cores: 4, loadAverage: { oneMinute: 0.3 } }, memory: { usagePercent: 40 } }, {});
        expect(result).toBe("healthy");
    });
});
