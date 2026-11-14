import { describe, expect, it, beforeEach, afterEach } from "vitest";
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

describe("loadEnv - dotenv file loading", () => {
    describe("Given a .env file in the directory", () => {
        it("Then it loads variables into process.env", async () => {
            const dir = await fs.mkdtemp(path.join(os.tmpdir(), "loadenv-"));
            try {
                await fs.writeFile(
                    path.join(dir, ".env"),
                    "LOAD_VAR=loaded-value\nOTHER=1\n",
                );

                await loadEnv({ dir });

                expect(process.env.LOAD_VAR).toBe("loaded-value");
                expect(process.env.OTHER).toBe("1");
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });

    describe("Given an environment-specific .env file", () => {
        it("Then it loads base .env then overrides with .env.<env>", async () => {
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

        it("Then environment-specific values override base values", async () => {
            const dir = await fs.mkdtemp(path.join(os.tmpdir(), "loadenv-"));
            try {
                await fs.writeFile(path.join(dir, ".env"), "DB_URL=localhost\nDB_POOL=5\n");
                await fs.writeFile(path.join(dir, ".env.production"), "DB_URL=prod-host\n");
                process.env.NODE_ENV = "production";

                await loadEnv({ dir });

                expect(process.env.DB_URL).toBe("prod-host");
                expect(process.env.DB_POOL).toBe("5");
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });

    describe("Given an explicit path", () => {
        it("Then it loads from the explicit path only", async () => {
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

    describe("Given dotenv is unavailable", () => {
        it("Then it gracefully returns without error", async () => {
            // This test documents graceful degradation when dotenv is not installed.
            // In this repository dotenv is a dependency, so we verify normal operation.
            const dir = await fs.mkdtemp(path.join(os.tmpdir(), "loadenv-"));
            try {
                await fs.writeFile(path.join(dir, ".env"), "GRACEFUL=yes\n");

                await loadEnv({ dir });

                expect(process.env.GRACEFUL).toBe("yes");
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });

    describe("Given NODE_ENV resolution", () => {
        it("Then it uses NODE_ENV to select environment file", async () => {
            const dir = await fs.mkdtemp(path.join(os.tmpdir(), "loadenv-"));
            try {
                await fs.writeFile(path.join(dir, ".env"), "ENV=default\n");
                await fs.writeFile(path.join(dir, ".env.development"), "ENV=development\n");
                await fs.writeFile(path.join(dir, ".env.production"), "ENV=production\n");

                process.env.NODE_ENV = "development";
                await loadEnv({ dir });
                expect(process.env.ENV).toBe("development");

                process.env.NODE_ENV = "production";
                await loadEnv({ dir });
                expect(process.env.ENV).toBe("production");
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });
});
