import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfigSimple, loadConfigSync } from "../../src/config/facade.js";
import { zodValidator } from "../../src/config/zod-validator.js";
import { z } from "zod";

const AppSchema = z.object({
    app: z.object({
        name: z.string().min(1).default("app"),
        port: z.number().int().min(1).max(65535).default(3000),
    }).default({ name: "app", port: 3000 }),
    database: z.object({
        url: z.string().min(1),
        pool: z.number().int().min(1).max(100).default(10),
    }).default({ url: "postgres://localhost:5432/db", pool: 10 }),
    logging: z.object({
        level: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
    }).default({ level: "info" }),
});

async function createTempDir(): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), "config-facade-"));
}

async function writeYaml(dir: string, name: string, content: string): Promise<void> {
    await fs.writeFile(path.join(dir, name), content, "utf8");
}

function originalEnvSnapshot() {
    return { ...process.env };
}

function restoreEnv(original: NodeJS.ProcessEnv) {
    for (const key of Object.keys(process.env)) {
        delete process.env[key as keyof NodeJS.ProcessEnv];
    }
    for (const [key, value] of Object.entries(original)) {
        process.env[key as keyof NodeJS.ProcessEnv] = value;
    }
}

describe("loadConfigSimple - simplified async configuration loading", () => {
    let original: NodeJS.ProcessEnv;

    beforeEach(() => {
        original = originalEnvSnapshot();
    });

    afterEach(() => {
        restoreEnv(original);
    });

    describe("Given a web service with default config directory", () => {
        it("Then it loads base config.yaml from ./config", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  name: simple-api\n  port: 5000\n");

                const config = await loadConfigSimple(zodValidator(AppSchema), {
                    configDir: dir,
                    env: "development",
                    requireEnvironmentFile: false,
                });

                expect(config.app.name).toBe("simple-api");
                expect(config.app.port).toBe(5000);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then it applies environment overlay config.<env>.yaml", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  port: 3000\n");
                await writeYaml(dir, "config.production.yaml", "app:\n  port: 8080\n");

                const config = await loadConfigSimple(zodValidator(AppSchema), {
                    configDir: dir,
                    env: "production",
                });

                expect(config.app.port).toBe(8080);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then it supports envMapping for strict type parsing", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  port: 3000\n");

                const config = await loadConfigSimple(zodValidator(AppSchema), {
                    configDir: dir,
                    env: "development",
                    requireEnvironmentFile: false,
                    envMapping: {
                        APP_PORT: { path: ["app", "port"], parse: (v) => Number(v) },
                    },
                    environment: { APP_PORT: "9000" },
                });

                expect(config.app.port).toBe(9000);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then it rejects invalid environment names", async () => {
            await expect(
                loadConfigSimple(zodValidator(AppSchema), {
                    env: "../../../etc/passwd",
                }),
            ).rejects.toThrow(/Unsafe environment name/);
        });

        it("Then it throws when required environment file is missing", async () => {
            const dir = await createTempDir();
            try {
                await expect(
                    loadConfigSimple(zodValidator(AppSchema), {
                        configDir: dir,
                        env: "production",
                        requireEnvironmentFile: true,
                    }),
                ).rejects.toThrow(/Required configuration file not found/);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });

    describe("Given NODE_ENV fallback resolution", () => {
        beforeEach(() => {
            original = originalEnvSnapshot();
        });

        afterEach(() => {
            restoreEnv(original);
        });

        it("Then it uses injected environment NODE_ENV over process.env", async () => {
            process.env.NODE_ENV = "staging";

            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  name: staging\n");

                const config = await loadConfigSimple(zodValidator(AppSchema), {
                    configDir: dir,
                    environment: { NODE_ENV: "production" },
                    requireEnvironmentFile: false,
                });

                expect(config.app.name).toBe("staging");
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });
});

describe("loadConfigSync - synchronous configuration loading", () => {
    describe("Given simple YAML startup configuration", () => {
        it("Then it loads and validates synchronously", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  name: sync-api\n  port: 7000\n");

                const config = loadConfigSync(zodValidator(AppSchema), {
                    configDir: dir,
                    env: "development",
                    requireEnvironmentFile: false,
                });

                expect(config.app.name).toBe("sync-api");
                expect(config.app.port).toBe(7000);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then it applies envMapping with strict parsers synchronously", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  port: 3000\n");

                const config = loadConfigSync(zodValidator(AppSchema), {
                    configDir: dir,
                    env: "development",
                    requireEnvironmentFile: false,
                    envMapping: {
                        APP_PORT: { path: ["app", "port"], parse: Number },
                    },
                    environment: { APP_PORT: "5000" },
                });

                expect(config.app.port).toBe(5000);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then it rejects async validators in sync mode", async () => {
            const asyncSchema = z.object({
                app: z.object({
                    name: z.string().min(1),
                }),
            });
            const asyncValidator = {
                validate: (input: unknown) => Promise.resolve(asyncSchema.parse(input)),
                validateAsync: async (input: unknown) => asyncSchema.parseAsync(input),
            };

            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  name: test\n");

                await expect(() =>
                    loadConfigSync(asyncValidator as any, {
                        configDir: dir,
                        env: "development",
                        requireEnvironmentFile: false,
                    }),
                ).toThrow(/asynchronous validators/);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then it uses schema defaults when no files exist", async () => {
            const dir = await createTempDir();
            try {
                const config = loadConfigSync(zodValidator(AppSchema), {
                    configDir: dir,
                    env: "development",
                    requireEnvironmentFile: false,
                });

                expect(config.app.name).toBe("app");
                expect(config.app.port).toBe(3000);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });
});
