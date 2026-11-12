import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadEnv } from "../../src/config/load-env.js";

const originalEnv = process.env;

beforeEach(() => {
    process.env = { ...originalEnv };
});

afterEach(() => {
    process.env = originalEnv;
});

describe("loadEnv", () => {
    it("loads variables from a .env file", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "loadenv-"));
        try {
            await fs.writeFile(path.join(dir, ".env"), "LOAD_VAR=loaded-value\nOTHER=1\n");

            await loadEnv({ dir });

            expect(process.env.LOAD_VAR).toBe("loaded-value");
            expect(process.env.OTHER).toBe("1");
        } finally {
            await fs.rm(dir, { recursive: true, force: true });
        }
    });

    it("loads an environment-specific file with override", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "loadenv-"));
        try {
            await fs.writeFile(path.join(dir, ".env"), "VAR=base\n");
            await fs.writeFile(path.join(dir, ".env.test"), "VAR=test-override\n");
            process.env.NODE_ENV = "test";

            await loadEnv({ dir });

            expect(process.env.VAR).toBe("test-override");
        } finally {
            await fs.rm(dir, { recursive: true, force: true });
        }
    });

    it("uses the explicit path when provided", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "loadenv-"));
        try {
            await fs.writeFile(path.join(dir, "custom.env"), "CUSTOM_VAR=custom\n");

            await loadEnv({ path: path.join(dir, "custom.env") });

            expect(process.env.CUSTOM_VAR).toBe("custom");
        } finally {
            await fs.rm(dir, { recursive: true, force: true });
        }
    });
});
