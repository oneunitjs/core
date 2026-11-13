import type {
    PluginRegistration,
    PluginContext,
    PluginResult,
    ConflictInfo,
    LifecycleOptions,
} from "./types.js";

function detectPluginConflict(
    namespace: string,
    name: string,
    existing: PluginRegistration[],
): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    for (const reg of existing) {
        if (reg.namespace === namespace && reg.name === name) {
            conflicts.push({
                type: "plugin",
                name,
                conflictWith: [reg.name],
                reason: `Plugin "${name}" already exists in namespace "${namespace}"`,
                severity: "error",
            });
        }
    }

    return conflicts;
}

export class PluginSystem {
    private readonly plugins: Map<string, PluginRegistration> = new Map();
    private readonly namespaces: Set<string> = new Set();
    private readonly maxPlugins: number;
    private readonly throwOnError: boolean;
    private readonly executionTimeoutMs: number;

    constructor(options: LifecycleOptions) {
        this.maxPlugins = options.maxPlugins ?? 50;
        this.throwOnError = options.throwOnError ?? false;
        this.executionTimeoutMs = options.executionTimeoutMs ?? 5000;
    }

    register(
        name: string,
        namespace: string,
        hooks: Record<string, Array<(_context: unknown) => void | Promise<void>>>,
        options: { priority?: number; version?: string } = {},
    ): { success: boolean; conflicts: ConflictInfo[]; error?: string } {
        if (this.plugins.size >= this.maxPlugins) {
            return {
                success: false,
                conflicts: [],
                error: `Maximum plugin limit (${this.maxPlugins}) reached`,
            };
        }

        const conflicts = detectPluginConflict(namespace, name, [...this.plugins.values()]);

        const key = `${namespace}:${name}`;

        const registration: PluginRegistration = {
            name,
            namespace,
            hooks,
            priority: options.priority ?? 0,
            version: options.version ?? "1.0.0",
        };

        this.plugins.set(key, registration);
        this.namespaces.add(namespace);

        return {
            success: conflicts.length === 0,
            conflicts,
        };
    }

    unregister(name: string, namespace: string): boolean {
        const key = `${namespace}:${name}`;
        const reg = this.plugins.get(key);
        if (!reg) return false;

        this.plugins.delete(key);

        const stillInNamespace = [...this.plugins.values()].some((p) => p.namespace === namespace);
        if (!stillInNamespace) {
            this.namespaces.delete(namespace);
        }

        return true;
    }

    get(name: string, namespace: string): PluginRegistration | undefined {
        return this.plugins.get(`${namespace}:${name}`);
    }

    list(): PluginRegistration[] {
        return [...this.plugins.values()].sort((a, b) => b.priority - a.priority);
    }

    listByNamespace(namespace: string): PluginRegistration[] {
        return this.list().filter((p) => p.namespace === namespace);
    }

    getNamespaces(): string[] {
        return [...this.namespaces];
    }

    has(name: string, namespace: string): boolean {
        return this.plugins.has(`${namespace}:${name}`);
    }

    size(): number {
        return this.plugins.size;
    }

    clear(): void {
        this.plugins.clear();
        this.namespaces.clear();
    }

    async executeHook(
        hookName: string,
        context: unknown,
    ): Promise<PluginResult[]> {
        const results: PluginResult[] = [];
        const ordered = this.list();

        for (const reg of ordered) {
            const listeners = reg.hooks[hookName];
            if (!listeners || listeners.length === 0) continue;

            const start = Date.now();

            for (const listener of listeners) {
                let timeoutId: NodeJS.Timeout | null = null;
                const timeoutPromise = new Promise<never>((_, reject) => {
                    timeoutId = setTimeout(() => {
                        reject(new Error(`Plugin "${reg.name}" hook "${hookName}" timed out`));
                    }, this.executionTimeoutMs);
                });

                try {
                    await Promise.race([
                        listener(context),
                        timeoutPromise,
                    ]);
                } catch (err) {
                    clearTimeout(timeoutId!);
                    results.push({
                        success: false,
                        error: err instanceof Error ? err : new Error(String(err)),
                        durationMs: Date.now() - start,
                    });

                    if (this.throwOnError) {
                        break;
                    }
                    continue;
                }

                clearTimeout(timeoutId!);
            }

            results.push({
                success: true,
                durationMs: Date.now() - start,
            });
        }

        return results;
    }

    async executeHookIsolated(
        hookName: string,
        context: unknown,
        namespace: string,
    ): Promise<PluginResult> {
        const start = Date.now();
        const regs = this.listByNamespace(namespace);

        for (const reg of regs) {
            const listeners = reg.hooks[hookName];
            if (!listeners || listeners.length === 0) continue;

            for (const listener of listeners) {
                let timeoutId: NodeJS.Timeout | null = null;
                const timeoutPromise = new Promise<never>((_, reject) => {
                    timeoutId = setTimeout(() => {
                        reject(new Error(`Plugin "${reg.name}" hook "${hookName}" timed out`));
                    }, this.executionTimeoutMs);
                });

                try {
                    await Promise.race([listener(context), timeoutPromise]);
                } catch (err) {
                    clearTimeout(timeoutId!);
                    return {
                        success: false,
                        error: err instanceof Error ? err : new Error(String(err)),
                        durationMs: Date.now() - start,
                    };
                }

                clearTimeout(timeoutId!);
            }
        }

        return {
            success: true,
            durationMs: Date.now() - start,
        };
    }

    createContext(name: string, namespace: string): PluginContext {
        const emit = (event: string, data: unknown) => {
            void this.executeHook(event, data);
        };

        const on = (event: string, _listener: (_data: unknown) => void) => {
            const reg = this.get(name, namespace);
            if (reg) {
                if (!reg.hooks[event]) {
                    reg.hooks[event] = [];
                }
                reg.hooks[event].push(_listener as (_context: unknown) => void | Promise<void>);
            }
        };

        return { name, namespace, emit, on };
    }
}
