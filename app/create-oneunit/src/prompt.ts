import * as readline from "readline";

export type Framework = "express" | "fastify" | "koa";

export const FRAMEWORKS: Framework[] = ["express", "fastify", "koa"];

export interface PromptResult {
    framework: Framework;
}

export function promptFramework(): Promise<Framework> {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const options = FRAMEWORKS.map((f, i) => `  ${i + 1}) ${f}`).join("\n");

        rl.question(
            `Choose a web framework:\n${options}\nDefault (1) express: `,
            (answer: string) => {
                rl.close();
                const trimmed = answer.trim();
                let choice: number;

                if (trimmed === "") {
                    choice = 1;
                } else {
                    choice = Number.parseInt(trimmed, 10);
                    if (!Number.isFinite(choice) || choice < 1 || choice > FRAMEWORKS.length) {
                        reject(
                            new Error(
                                `Invalid framework choice "${trimmed}". Valid choices: 1-${FRAMEWORKS.length}`,
                            ),
                        );
                        return;
                    }
                }

                resolve(FRAMEWORKS[choice - 1]);
            },
        );
    });
}
