import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
    scaffoldProject,
    isValidProjectName,
    directoryExists,
    type ScaffoldOptions,
} from "../src/create-project.js";

describe("create-project", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "create-oneunit-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe("isValidProjectName", () => {
        it("accepts valid lowercase names", () => {
            expect(isValidProjectName("my-api")).toBe(true);
            expect(isValidProjectName("myapi")).toBe(true);
            expect(isValidProjectName("a")).toBe(true);
        });

        it("rejects empty names", () => {
            expect(isValidProjectName("")).toBe(false);
        });

        it("rejects names starting with dot or underscore", () => {
            expect(isValidProjectName(".hidden")).toBe(false);
            expect(isValidProjectName("_private")).toBe(false);
        });

        it("rejects uppercase names", () => {
            expect(isValidProjectName("MyAPI")).toBe(false);
        });
    });

    describe("scaffoldProject", () => {
        it("creates express project files", () => {
            const target = path.join(tmpDir, "my-express-app");
            const options: ScaffoldOptions = {
                projectName: "my-express-app",
                framework: "express",
                targetDir: target,
            };

            scaffoldProject(options);

            expect(directoryExists(target)).toBe(true);
            expect(fs.existsSync(path.join(target, "package.json"))).toBe(true);
            expect(fs.existsSync(path.join(target, "tsconfig.json"))).toBe(true);
            expect(fs.existsSync(path.join(target, "src", "index.ts"))).toBe(true);
            expect(fs.existsSync(path.join(target, ".gitignore"))).toBe(true);
            expect(fs.existsSync(path.join(target, "README.md"))).toBe(true);

            const pkg = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
            expect(pkg.name).toBe("my-express-app");
            expect(pkg.dependencies["@oneunit/core"]).toBe("^1.0.0");
            expect(pkg.dependencies.express).toBeDefined();
        });

        it("creates fastify project files", () => {
            const target = path.join(tmpDir, "my-fastify-app");
            const options: ScaffoldOptions = {
                projectName: "my-fastify-app",
                framework: "fastify",
                targetDir: target,
            };

            scaffoldProject(options);

            expect(directoryExists(target)).toBe(true);
            const pkg = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
            expect(pkg.name).toBe("my-fastify-app");
            expect(pkg.dependencies.fastify).toBeDefined();
        });

        it("creates koa project files", () => {
            const target = path.join(tmpDir, "my-koa-app");
            const options: ScaffoldOptions = {
                projectName: "my-koa-app",
                framework: "koa",
                targetDir: target,
            };

            scaffoldProject(options);

            expect(directoryExists(target)).toBe(true);
            const pkg = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
            expect(pkg.name).toBe("my-koa-app");
            expect(pkg.dependencies.koa).toBeDefined();
        });

        it("throws if target directory already exists", () => {
            const target = path.join(tmpDir, "existing-app");
            fs.mkdirSync(target, { recursive: true });

            const options: ScaffoldOptions = {
                projectName: "existing-app",
                framework: "express",
                targetDir: target,
            };

            expect(() => scaffoldProject(options)).toThrow(/already exists/);
        });

        it("throws for invalid project name", () => {
            const target = path.join(tmpDir, "Bad Name");
            const options: ScaffoldOptions = {
                projectName: "Bad Name",
                framework: "express",
                targetDir: target,
            };

            expect(() => scaffoldProject(options)).toThrow(/Invalid project name/);
        });
    });
});
