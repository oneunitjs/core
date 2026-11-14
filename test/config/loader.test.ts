import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../../src/config/loader.js";
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
    return fs.mkdtemp(path.join(os.tmpdir(), "config-test-"));
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

describe("loadConfig - real world configuration loading", () => {
    let original: NodeJS.ProcessEnv;

    beforeEach(() => {
        original = originalEnvSnapshot();
    });

    afterEach(() => {
        restoreEnv(original);
    });

    describe("Given a web API application with base config", () => {
        it("Then it loads base YAML with typed defaults", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  name: api-server\n  port: 4000\n");

                const config = await loadConfig({
                    schema: zodValidator(AppSchema),
                    configDir: dir,
                    env: "development",
                    requireEnvironmentFile: false,
                });

                expect(config.app.name).toBe("api-server");
                expect(config.app.port).toBe(4000);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then it applies environment overlay on top of base", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  name: base-app\n  port: 3000\n");
                await writeYaml(dir, "config.production.yaml", "app:\n  port: 8080\n");

                const config = await loadConfig({
                    schema: zodValidator(AppSchema),
                    configDir: dir,
                    env: "production",
                });

                expect(config.app.name).toBe("base-app");
                expect(config.app.port).toBe(8080);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then database settings merge across base and environment overlays", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "database:\n  url: postgres://localhost:5432/base\n  pool: 5\n");
                await writeYaml(dir, "config.production.yaml", "database:\n  pool: 20\n");

                const config = await loadConfig({
                    schema: zodValidator(AppSchema),
                    configDir: dir,
                    env: "production",
                });

                expect(config.database.url).toBe("postgres://localhost:5432/base");
                expect(config.database.pool).toBe(20);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });

    describe("Given missing configuration files", () => {
        it("Then it uses schema defaults when no files exist", async () => {
            const dir = await createTempDir();
            try {
                const config = await loadConfig({
                    schema: zodValidator(AppSchema),
                    configDir: dir,
                    env: "development",
                    requireEnvironmentFile: false,
                });

                expect(config.app.name).toBe("app");
                expect(config.app.port).toBe(3000);
                expect(config.logging.level).toBe("info");
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then it throws when environment file is required but missing", async () => {
            const dir = await createTempDir();
            try {
                await expect(
                    loadConfig({
                        schema: zodValidator(AppSchema),
                        configDir: dir,
                        env: "production",
                        requireEnvironmentFile: true,
                    }),
                ).rejects.toThrow(/Required configuration file not found/);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then it silently ignores missing optional environment file", async () => {
            const dir = await createTempDir();
            try {
                const config = await loadConfig({
                    schema: zodValidator(AppSchema),
                    configDir: dir,
                    env: "production",
                    requireEnvironmentFile: false,
                });

                expect(config.app.name).toBe("app");
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });

    describe("Given malformed or unsafe configuration", () => {
        it("Then it rejects invalid YAML syntax", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  - invalid: yaml: [");

                await expect(
                    loadConfig({
                        schema: zodValidator(AppSchema),
                        configDir: dir,
                        env: "development",
                        requireEnvironmentFile: false,
                    }),
                ).rejects.toThrow(/Invalid YAML/);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then it rejects YAML that is not a mapping at root", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "- item1\n- item2\n");

                await expect(
                    loadConfig({
                        schema: zodValidator(AppSchema),
                        configDir: dir,
                        env: "development",
                        requireEnvironmentFile: false,
                    }),
                ).rejects.toThrow(/must contain a YAML mapping/);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then it rejects unknown keys when schema is strict", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  name: test\n  unknownKey: value\n");

                const strictSchema = z.object({
                    app: z.object({
                        name: z.string(),
                    }).strict(),
                }).strict();

                await expect(
                    loadConfig({
                        schema: zodValidator(strictSchema),
                        configDir: dir,
                        env: "development",
                        requireEnvironmentFile: false,
                    }),
                ).rejects.toThrow();
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });

    describe("Given environment variable precedence", () => {
        it("Then environment overrides win over file values", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  port: 3000\n");

                const config = await loadConfig({
                    schema: zodValidator(AppSchema),
                    configDir: dir,
                    env: "development",
                    requireEnvironmentFile: false,
                    envOverrides: { app: { port: 9000 } },
                });

                expect(config.app.port).toBe(9000);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then CLI overrides win over environment overrides", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  port: 3000\n");

                const config = await loadConfig({
                    schema: zodValidator(AppSchema),
                    configDir: dir,
                    env: "development",
                    requireEnvironmentFile: false,
                    envOverrides: { app: { port: 8000 } },
                    cliOverrides: { app: { port: 7000 } },
                });

                expect(config.app.port).toBe(7000);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });

        it("Then interpolated environment placeholders resolve in YAML", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(
                    dir,
                    "config.yaml",
                    'app:\n  name: "${APP_NAME:default-name}"\n',
                );

                const config = await loadConfig({
                    schema: zodValidator(AppSchema),
                    configDir: dir,
                    env: "development",
                    requireEnvironmentFile: false,
                    environment: { APP_NAME: "interpolated-app" },
                });

                expect(config.app.name).toBe("interpolated-app");
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });

    describe("Given immutability guarantees", () => {
        it("Then the result is deeply frozen", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  name: immutable\n");

                const config = await loadConfig({
                    schema: zodValidator(AppSchema),
                    configDir: dir,
                    env: "development",
                    requireEnvironmentFile: false,
                });

                expect(Object.isFrozen(config)).toBe(true);
                expect(Object.isFrozen(config.app)).toBe(true);
                expect(Object.isFrozen(config.database)).toBe(true);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });

    describe("Given custom async sources", () => {
        it("Then it loads from custom sources in precedence order", async () => {
            const source1 = {
                name: "first",
                load: async () => ({ app: { port: 1000 } }),
            };
            const source2 = {
                name: "second",
                load: async () => ({ app: { port: 2000 } }),
            };

            const config = await loadConfig({
                schema: zodValidator(AppSchema),
                sources: [source1, source2],
                env: "development",
                requireEnvironmentFile: false,
            });

            expect(config.app.port).toBe(2000);
        });

        it("Then custom sources take priority over default YAML files", async () => {
            const dir = await createTempDir();
            try {
                await writeYaml(dir, "config.yaml", "app:\n  port: 3000\n");

                const customSource = {
                    name: "override",
                    load: async () => ({ app: { port: 9999 } }),
                };

                const config = await loadConfig({
                    schema: zodValidator(AppSchema),
                    configDir: dir,
                    sources: [customSource],
                    env: "development",
                    requireEnvironmentFile: false,
                });

                expect(config.app.port).toBe(9999);
            } finally {
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });
});

describe("loadConfig - NODE_ENV environment fallback", () => {
    let original: NodeJS.ProcessEnv;

    beforeEach(() => {
        original = originalEnvSnapshot();
    });

    afterEach(() => {
        restoreEnv(original);
    });

    it("Given NODE_ENV is set, Then it uses NODE_ENV as default environment", async () => {
        process.env.NODE_ENV = "production";

        const dir = await createTempDir();
        try {
            await writeYaml(dir, "config.yaml", "app:\n  name: base\n");
            await writeYaml(dir, "config.production.yaml", "app:\n  name: prod\n");

            const config = await loadConfig({
                schema: zodValidator(AppSchema),
                configDir: dir,
                requireEnvironmentFile: false,
            });

            expect(config.app.name).toBe("prod");
        } finally {
            await fs.rm(dir, { recursive: true, force: true });
        }
    });

    it("Given NODE_ENV is unset, Then it defaults to development", async () => {
        delete process.env.NODE_ENV;

        const dir = await createTempDir();
        try {
            await writeYaml(dir, "config.yaml", "app:\n  name: dev\n");
            await writeYaml(dir, "config.development.yaml", "app:\n  name: dev-override\n");

            const config = await loadConfig({
                schema: zodValidator(AppSchema),
                configDir: dir,
                requireEnvironmentFile: false,
            });

            expect(config.app.name).toBe("dev-override");
        } finally {
            await fs.rm(dir, { recursive: true, force: true });
        }
    });
});
