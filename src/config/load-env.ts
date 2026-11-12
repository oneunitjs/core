import path from "node:path";
import { envFile } from "./env.js";
import type { LoadEnvOptions, DotenvConfig } from "./type.js";

export async function loadEnv(options: LoadEnvOptions = {}): Promise<void> {
    let dotenv: DotenvConfig;

  try {
    const mod = await import("dotenv") as {
      config?: (opts: { path: string; override?: boolean }) => void;
      default?: { config: (opts: { path: string; override?: boolean }) => void };
    };
    dotenv = {
      config: mod.config ?? mod.default?.config,
    } as { config: (opts: { path: string; override?: boolean }) => void };
    if (typeof dotenv.config !== "function") {
      return;
    }
  } catch {
    return;
  }

  const dir = options.dir ?? process.cwd();

  if (options.path) {
    dotenv.config({ path: options.path, override: true });
    return;
  }

  dotenv.config({ path: path.join(dir, ".env") });
  dotenv.config({ path: envFile(dir), override: true });
}
