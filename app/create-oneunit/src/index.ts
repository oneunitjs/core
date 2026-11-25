import * as path from "path";
import {
    scaffoldProject,
    printNextSteps,
    type ScaffoldOptions,
    type Framework,
} from "./create-project.js";
import { promptFramework } from "./prompt.js";

type ParsedArgs = {
    project: string | undefined;
    framework: Framework | undefined;
    help: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
    const result: ParsedArgs = { project: undefined, framework: undefined, help: false };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === "--help" || arg === "-h") {
            result.help = true;
            continue;
        }

        if (arg === "--framework" || arg === "-f") {
            const next = argv[i + 1];
            if (next === undefined || next.startsWith("--")) {
                throw new Error("--framework requires a value (express, fastify, or koa)");
            }
            const framework = next as Framework;
            if (framework !== "express" && framework !== "fastify" && framework !== "koa") {
                throw new Error(
                    `Invalid framework "${framework}". Valid choices: express, fastify, koa`,
                );
            }
            result.framework = framework;
            i++;
            continue;
        }

        if (!arg.startsWith("--")) {
            if (result.project === undefined) {
                result.project = arg;
            } else {
                throw new Error(`Unexpected argument: ${arg}`);
            }
        }
    }

    return result;
}

function printHelp(): void {
    console.log(
        `Usage: create-oneunit <project> [--framework <express|fastify|koa>]

Scaffold a new project using @oneunit/core with a chosen web framework.

Arguments:
  <project>        Project directory name (required)

Options:
  -f, --framework  Web framework: express, fastify, or koa (prompted if omitted)
  -h, --help       Show this help message

Examples:
  create-oneunit my-api
  create-oneunit my-api --framework express
  create-oneunit my-api -f fastify
`,
    );
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    const parsed = parseArgs(argv);

    if (parsed.help) {
        printHelp();
        return;
    }

    if (parsed.project === undefined) {
        throw new Error("Project name is required. Usage: create-oneunit <project>");
    }

    let framework: Framework;
    if (parsed.framework !== undefined) {
        framework = parsed.framework;
    } else {
        framework = await promptFramework();
    }

    const options: ScaffoldOptions = {
        projectName: parsed.project,
        framework,
        targetDir: path.resolve(parsed.project),
    };

    scaffoldProject(options);
    printNextSteps(options.projectName, options.framework, options.targetDir);
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
