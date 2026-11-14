import path from "node:path";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import YAML from "yaml";

import type { ConfigSource, ConfigSourceContext } from "./types.js";
import { ConfigSourceError } from "./errors.js";

const SAFE_ENVIRONMENT_NAME = /^[a-zA-Z0-9_-]+$/;

export function validateEnvironmentName(name: string): string {
    if (!SAFE_ENVIRONMENT_NAME.test(name)) {
        throw new ConfigSourceError(`Unsafe environment name: ${name}`);
    }
    return name;
}

export function parseYaml(text: string, filePath: string): unknown {
    try {
        const parsed = YAML.parse(text);

        if (parsed === null || parsed === undefined) {
            return {};
        }

        if (typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new ConfigSourceError(
                `Configuration file must contain a YAML mapping: ${filePath}`,
            );
        }

        return parsed;
    } catch (error) {
        if (error instanceof ConfigSourceError) {
            throw error;
        }
        throw new ConfigSourceError(
            `Invalid YAML in configuration file: ${filePath}`,
            { cause: error as Error },
        );
    }
}

export function readYamlSync(filePath: string, required: boolean): unknown {
    let text: string;

    try {
        text = readFileSync(filePath, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            if (required) {
                throw new ConfigSourceError(
                    `Required configuration file not found: ${filePath}`,
                );
            }
            return {};
        }
        throw new ConfigSourceError(
            `Failed to read configuration file: ${filePath}`,
            { cause: error as Error },
        );
    }

    return parseYaml(text, filePath);
}

export class YamlSource implements ConfigSource {
    constructor(
        public readonly name: string,
        private readonly filePath: string,
        private readonly required: boolean = false,
    ) {}

    async load(_context: ConfigSourceContext): Promise<unknown> {
        let text: string;

        try {
            text = await readFile(this.filePath, "utf8");
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                if (this.required) {
                    throw new ConfigSourceError(
                        `Required configuration file not found: ${this.filePath}`,
                    );
                }
                return {};
            }
            throw new ConfigSourceError(
                `Failed to read configuration file: ${this.filePath}`,
                { cause: error as Error },
            );
        }

        return parseYaml(text, this.filePath);
    }
}

export function createDefaultYamlSources(
    configDir: string,
    environment: string,
    requireEnvironmentFile: boolean,
): YamlSource[] {
    validateEnvironmentName(environment);

    return [
        new YamlSource(
            "base-file",
            path.join(configDir, "config.yaml"),
            false,
        ),
        new YamlSource(
            "environment-file",
            path.join(configDir, `config.${environment}.yaml`),
            requireEnvironmentFile,
        ),
    ];
}
