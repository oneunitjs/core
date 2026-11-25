import * as fs from "fs";
import * as path from "path";

export type Framework = "express" | "fastify" | "koa";

export interface ScaffoldOptions {
    projectName: string;
    framework: Framework;
    targetDir: string;
}

export const FRAMEWORK_DEPENDENCIES: Record<Framework, string> = {
    express: "express",
    fastify: "fastify",
    koa: "koa",
};

export const FRAMEWORK_VERSIONS: Record<Framework, string> = {
    express: "^5.3.0",
    fastify: "^5.12.8",
    koa: "^3.3.0",
};

export function isValidProjectName(name: string): boolean {
    if (name.length === 0 || name.length > 214) {
        return false;
    }
    if (name.startsWith(".") || name.startsWith("_")) {
        return false;
    }
    const npmNameRegex = /^(?:@[^/]+\/)?[a-z0-9][a-z0-9._-]*[a-z0-9]$|^[a-z0-9]$/;
    return npmNameRegex.test(name);
}

export function directoryExists(dirPath: string): boolean {
    try {
        return fs.statSync(dirPath).isDirectory();
    } catch {
        return false;
    }
}

export function ensureDirectory(dirPath: string): void {
    fs.mkdirSync(dirPath, { recursive: true });
}

export function copyFile(source: string, destination: string): void {
    ensureDirectory(path.dirname(destination));
    fs.copyFileSync(source, destination);
}

export function copyTemplate(templateDir: string, targetDir: string): void {
    if (!fs.statSync(templateDir).isDirectory()) {
        throw new Error(`Template directory not found: ${templateDir}`);
    }

    function walk(src: string, dest: string): void {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                ensureDirectory(destPath);
                walk(srcPath, destPath);
            } else {
                copyFile(srcPath, destPath);
            }
        }
    }

    walk(templateDir, targetDir);
}

export function writePackageJson(targetDir: string, options: ScaffoldOptions): void {
    const { projectName, framework } = options;
    const frameworkDep = FRAMEWORK_DEPENDENCIES[framework];
    const frameworkVersion = FRAMEWORK_VERSIONS[framework];

    const packageJson = {
        name: projectName,
        version: "1.0.0",
        type: "module",
        scripts: {
            dev: "tsx watch src/index.ts",
            build: "tsc",
            start: "node dist/index.js",
        },
        dependencies: {
            "@oneunit/core": "^1.0.0",
            [frameworkDep]: frameworkVersion,
        },
        devDependencies: {
            "@types/node": "^22.0.0",
            tsx: "^4.23.15",
            typescript: "^6.0.3",
        },
    };

    const json = JSON.stringify(packageJson, null, 2) + "\n";
    fs.writeFileSync(path.join(targetDir, "package.json"), json);
}

export function scaffoldProject(options: ScaffoldOptions): void {
    const { projectName, framework, targetDir } = options;

    if (!isValidProjectName(projectName)) {
        throw new Error(
            `Invalid project name "${projectName}". Use lowercase letters, numbers, hyphens, underscores, or dots.`,
        );
    }

    if (directoryExists(targetDir)) {
        throw new Error(`Target directory already exists: ${targetDir}`);
    }

    const templateDir = path.join(
        path.dirname(new URL(import.meta.url).pathname),
        "..",
        "templates",
        framework,
    );

    if (!directoryExists(templateDir)) {
        throw new Error(`Template not found for framework "${framework}": ${templateDir}`);
    }

    ensureDirectory(targetDir);
    copyTemplate(templateDir, targetDir);
    writePackageJson(targetDir, options);
}

export function printNextSteps(projectName: string, framework: Framework, targetDir: string): void {
    const relativePath = path.relative(process.cwd(), targetDir);
    const cdCommand = relativePath === "" ? projectName : relativePath;

    console.log(`\nScaffolded ${projectName} with ${framework} at ${targetDir}`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${cdCommand}`);
    console.log(`  npm install`);
    console.log(`  npm run dev`);
    console.log();
}
