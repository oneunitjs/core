import {
    DEFAULT_LIFECYCLE_OPTIONS,
    EASY_MODE_DEFAULTS,
    STRICT_MODE_DEFAULTS,
    type LifecycleMode,
    type LifecycleOptions,
    type LifecycleState,
    type MiddlewareRegistration,
    type PluginRegistration,
    type ConflictInfo,
    type MiddlewareContext,
    type MiddlewareResult,
    type PluginResult,
    type HeaderConflict,
} from "./types.js";
import { MiddlewareRegistry } from "./middleware-registry.js";
import { PluginSystem } from "./plugin-system.js";
import type { FrameworkType } from "../adapters/types.js";

export class LifecycleManager {
    private mode: LifecycleMode;
    private readonly options: Required<LifecycleOptions>;
    private readonly middleware: MiddlewareRegistry;
    private readonly plugins: PluginSystem;
    private initialized = false;
    private executionCount = 0;
    private errorCount = 0;

    constructor(options: LifecycleOptions = {}) {
        const base = options.mode === "easy" ? EASY_MODE_DEFAULTS : options.mode === "strict" ? STRICT_MODE_DEFAULTS : DEFAULT_LIFECYCLE_OPTIONS;

        this.options = {
            ...base,
            ...options,
        };
        this.mode = this.options.mode;
        this.middleware = new MiddlewareRegistry(this.options);
        this.plugins = new PluginSystem(this.options);
    }

    getMode(): LifecycleMode {
        return this.mode;
    }

    setMode(_mode: LifecycleMode): { success: boolean; conflicts: ConflictInfo[]; error?: string } {
        if (this.initialized && _mode !== this.mode) {
            this.mode = _mode;

            if (_mode === "easy") {
                this.options.throwOnError = true;
                this.options.autoRegisterEssential = true;
            } else if (_mode === "strict") {
                this.options.throwOnError = true;
                this.options.executionTimeoutMs = 2000;
                this.options.maxMiddleware = 20;
                this.options.maxPlugins = 20;
            } else {
                this.options.throwOnError = false;
                this.options.autoRegisterEssential = false;
            }

            return {
                success: true,
                conflicts: [],
            };
        }

        this.mode = _mode;
        return { success: true, conflicts: [] };
    }

    initialize(): { success: boolean; conflicts: ConflictInfo[]; error?: string } {
        if (this.initialized) {
            return { success: true, conflicts: [], error: "Already initialized" };
        }

        this.initialized = true;

        if (this.options.autoRegisterEssential && this.mode === "easy") {
            // Easy mode auto-registers safe defaults (no-op placeholders, user overrides)
            return {
                success: true,
                conflicts: [],
            };
        }

        return { success: true, conflicts: [] };
    }

    registerMiddleware(
        name: string,
        type: string,
        middleware: (_req: unknown, _res: unknown, _next?: () => void) => void | Promise<void>,
        options?: { priority?: number; conflictTypes?: string[]; version?: string; trackHeaders?: string[] },
    ): { success: boolean; conflicts: ConflictInfo[]; headerConflicts: HeaderConflict[]; error?: string } {
        if (!this.initialized) {
            return { success: false, conflicts: [], headerConflicts: [], error: "Lifecycle not initialized" };
        }

        const result = this.middleware.register(name, type, middleware, options);

        if (!result.success && this.options.throwOnError) {
            return {
                success: false,
                conflicts: result.conflicts,
                headerConflicts: result.headerConflicts,
                error: result.error ?? `Middleware "${name}" registration failed`,
            };
        }

        return result;
    }

    unregisterMiddleware(name: string): boolean {
        return this.middleware.unregister(name);
    }

    registerPlugin(
        name: string,
        namespace: string,
        hooks: Record<string, Array<(_context: unknown) => void | Promise<void>>>,
        options?: { priority?: number; version?: string },
    ): { success: boolean; conflicts: ConflictInfo[]; error?: string } {
        if (!this.initialized) {
            return { success: false, conflicts: [], error: "Lifecycle not initialized" };
        }

        const result = this.plugins.register(name, namespace, hooks, options);

        if (!result.success && this.options.throwOnError) {
            return {
                success: false,
                conflicts: result.conflicts,
                error: result.error ?? `Plugin "${name}" registration failed`,
            };
        }

        return result;
    }

    unregisterPlugin(name: string, namespace: string): boolean {
        return this.plugins.unregister(name, namespace);
    }

    async executeMiddleware(
        name: string,
        req: unknown,
        res: unknown,
        phase: "request" | "response" | "error" = "request",
    ): Promise<MiddlewareResult> {
        this.executionCount++;

        const ctx: MiddlewareContext = {
            req,
            res,
            next: () => { ctx.aborted = true; },
            phase,
            abort: () => { ctx.aborted = true; },
            aborted: false,
        };

        const result = await this.middleware.execute(name, ctx);

        if (!result.success) {
            this.errorCount++;
        }

        return result;
    }

    async executeMiddlewareChain(
        req: unknown,
        res: unknown,
        _phase: "request" | "response" | "error" = "request",
    ): Promise<MiddlewareResult[]> {
        this.executionCount++;

        const ctx: MiddlewareContext = {
            req,
            res,
            next: () => {},
            phase: "request",
            abort: () => { ctx.aborted = true; },
            aborted: false,
        };

        const results = await this.middleware.executeAll(ctx);

        for (const result of results) {
            if (!result.success) {
                this.errorCount++;
            }
        }

        return results;
    }

    async executeHook(
        hookName: string,
        context: unknown,
    ): Promise<PluginResult[]> {
        this.executionCount++;
        return this.plugins.executeHook(hookName, context);
    }

    async executeHookIsolated(
        hookName: string,
        context: unknown,
        namespace: string,
    ): Promise<PluginResult> {
        this.executionCount++;
        return this.plugins.executeHookIsolated(hookName, context, namespace);
    }

    getState(): LifecycleState {
        return {
            mode: this.mode,
            initialized: this.initialized,
            middlewareCount: this.middleware.size(),
            pluginCount: this.plugins.size(),
            conflicts: this.middleware.getConflicts(),
            headerConflicts: this.middleware.getHeaderConflicts(),
            executionCount: this.executionCount,
            errorCount: this.errorCount,
        };
    }

    getMiddlewareList(): MiddlewareRegistration[] {
        return this.middleware.list();
    }

    getPluginList(): PluginRegistration[] {
        return this.plugins.list();
    }

    getNamespaces(): string[] {
        return this.plugins.getNamespaces();
    }

    hasMiddleware(name: string): boolean {
        return this.middleware.has(name);
    }

    hasPlugin(name: string, namespace: string): boolean {
        return this.plugins.has(name, namespace);
    }

    clear(): void {
        this.middleware.clear();
        this.plugins.clear();
        this.initialized = false;
        this.executionCount = 0;
        this.errorCount = 0;
    }

    createPluginContext(name: string, namespace: string) {
        return this.plugins.createContext(name, namespace);
    }

    /**
     * Create a framework-specific middleware function that executes the lifecycle
     * middleware chain. Use this as framework middleware (Express app.use, Fastify
     * hook, Koa middleware, node:http request listener).
     */
    createLifecycleMiddleware(_framework: FrameworkType = "express"): any {
        const registrations = this.middleware.list();

        // Create a combined middleware that runs all registered middleware in order
        return async (req: any, res: any, next?: any) => {
            let chainAborted = false;
            const ctx: MiddlewareContext = {
                req,
                res,
                next: () => { chainAborted = true; },
                phase: "request",
                abort: () => { chainAborted = true; },
                aborted: false,
            };

            for (const reg of registrations) {
                if (chainAborted) break;

                const result = await this.middleware.execute(reg.name, {
                    ...ctx,
                    phase: ctx.phase,
                });

                if (!result.success && !result.aborted) {
                    continue;
                }

                if (result.aborted) {
                    chainAborted = true;
                    break;
                }
            }

            // If using Express-style next, call it unless aborted
            if (next && !chainAborted) {
                next();
            }
        };
    }

    isSafe(): boolean {
        const state = this.getState();
        return state.conflicts.filter((c) => c.severity === "error").length === 0;
    }

    getValidationReport(): {
        safe: boolean;
        conflicts: ConflictInfo[];
        headerConflicts: HeaderConflict[];
        warnings: ConflictInfo[];
        errors: ConflictInfo[];
    } {
        const conflicts = this.middleware.getConflicts();
        const headerConflicts = this.middleware.getHeaderConflicts();
        return {
            safe: conflicts.filter((c) => c.severity === "error").length === 0 && headerConflicts.length === 0,
            conflicts,
            headerConflicts,
            warnings: conflicts.filter((c) => c.severity === "warning"),
            errors: conflicts.filter((c) => c.severity === "error"),
        };
    }
}
