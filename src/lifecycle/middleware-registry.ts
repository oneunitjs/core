import type {
    MiddlewareRegistration,
    MiddlewareContext,
    MiddlewareResult,
    ConflictInfo,
    HeaderConflict,
    LifecycleOptions,
} from "./types.js";

const MIDDLEWARE_CONFLICT_MATRIX: Record<string, string[]> = {
    cors: ["cors"],
    csrf: ["csrf"],
    helmet: ["helmet"],
    compression: ["compression"],
    sanitize: ["sanitize"],
    multipart: ["multipart"],
};

function detectConflict(
    type: string,
    name: string,
    existing: MiddlewareRegistration[],
): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    const conflictingTypes = MIDDLEWARE_CONFLICT_MATRIX[type] ?? [];

    for (const existingType of conflictingTypes) {
        const matches = existing.filter(
            (m) => m.type === existingType && m.name !== name,
        );
        if (matches.length > 0) {
            conflicts.push({
                type: "middleware",
                name,
                conflictWith: matches.map((m) => m.name),
                reason: `Middleware type "${existingType}" already registered by ${matches.map((m) => m.name).join(", ")}`,
                severity: "error",
            });
        }
    }

    return conflicts;
}

function detectHeaderConflicts(
    registrations: MiddlewareRegistration[],
): HeaderConflict[] {
    const headerToMiddlewares: Map<string, string[]> = new Map();

    for (const reg of registrations) {
        if (reg.trackHeaders) {
            for (const header of reg.trackHeaders) {
                const existing = headerToMiddlewares.get(header) ?? [];
                headerToMiddlewares.set(header, [...existing, reg.name]);
            }
        }
    }

    const conflicts: HeaderConflict[] = [];
    for (const [header, names] of headerToMiddlewares) {
        if (names.length > 1) {
            conflicts.push({
                header,
                setBy: names,
                severity: "warning",
            });
        }
    }

    return conflicts;
}

export class MiddlewareRegistry {
    private readonly middleware: Map<string, MiddlewareRegistration> = new Map();
    private readonly conflicts: ConflictInfo[] = [];
    private readonly headerConflicts: HeaderConflict[] = [];
    private readonly maxMiddleware: number;
    private readonly allowedTypes: Set<string> | null;
    private readonly executionTimeoutMs: number;

    constructor(options: LifecycleOptions) {
        this.maxMiddleware = options.maxMiddleware ?? 50;
        this.allowedTypes = options.allowedMiddlewareTypes && options.allowedMiddlewareTypes.length > 0
            ? new Set(options.allowedMiddlewareTypes)
            : null;
        this.executionTimeoutMs = options.executionTimeoutMs ?? 5000;
    }

    register(
        name: string,
        type: string,
        middleware: (_req: unknown, _res: unknown, _next?: () => void) => void | Promise<void>,
        options: { priority?: number; conflictTypes?: string[]; version?: string; trackHeaders?: string[] } = {},
    ): { success: boolean; conflicts: ConflictInfo[]; headerConflicts: HeaderConflict[]; error?: string } {
        if (this.middleware.size >= this.maxMiddleware) {
            return {
                success: false,
                conflicts: [],
                headerConflicts: [],
                error: `Maximum middleware limit (${this.maxMiddleware}) reached`,
            };
        }

        if (this.allowedTypes && !this.allowedTypes.has(type)) {
            return {
                success: false,
                conflicts: [],
                headerConflicts: [],
                error: `Middleware type "${type}" is not allowed in current mode`,
            };
        }

        const conflicts = detectConflict(type, name, [...this.middleware.values()]);

        const registration: MiddlewareRegistration = {
            name,
            type,
            middleware,
            priority: options.priority ?? 0,
            conflictTypes: options.conflictTypes,
            version: options.version ?? "1.0.0",
            trackHeaders: options.trackHeaders,
        };

        this.middleware.set(name, registration);
        this.conflicts.push(...conflicts);

        // Recompute header conflicts after each registration
        this.headerConflicts.length = 0;
        this.headerConflicts.push(...detectHeaderConflicts([...this.middleware.values()]));

        return {
            success: conflicts.length === 0,
            conflicts,
            headerConflicts: this.headerConflicts,
        };
    }

    unregister(name: string): boolean {
        const reg = this.middleware.get(name);
        if (!reg) return false;

        this.middleware.delete(name);

        this.conflicts.splice(
            0,
            this.conflicts.length,
            ...this.conflicts.filter((c) => c.name !== name && !c.conflictWith.includes(name)),
        );

        // Recompute header conflicts
        this.headerConflicts.length = 0;
        this.headerConflicts.push(...detectHeaderConflicts([...this.middleware.values()]));

        return true;
    }

    get(name: string): MiddlewareRegistration | undefined {
        return this.middleware.get(name);
    }

    list(): MiddlewareRegistration[] {
        return [...this.middleware.values()].sort((a, b) => b.priority - a.priority);
    }

    getConflicts(): ConflictInfo[] {
        return [...this.conflicts];
    }

    getHeaderConflicts(): HeaderConflict[] {
        return [...this.headerConflicts];
    }

    clear(): void {
        this.middleware.clear();
        this.conflicts.length = 0;
        this.headerConflicts.length = 0;
    }

    has(name: string): boolean {
        return this.middleware.has(name);
    }

    size(): number {
        return this.middleware.size;
    }

    async execute(
        name: string,
        ctx: MiddlewareContext,
    ): Promise<MiddlewareResult> {
        const start = Date.now();
        const reg = this.middleware.get(name);

        if (!reg) {
            return {
                success: false,
                aborted: false,
                error: new Error(`Middleware "${name}" not found`),
                durationMs: Date.now() - start,
            };
        }

        let aborted = false;
        let nextCalled = false;
        const originalNext = ctx.next;
        const wrappedNext = () => {
            nextCalled = true;
            originalNext();
        };

        // Wrap res.setHeader to track headers if trackHeaders is configured
        const res = ctx.res as any;
        const originalSetHeader = res?.setHeader;
        const setHeaders: string[] = [];

        if (reg.trackHeaders && typeof originalSetHeader === "function") {
            res.setHeader = (key: string, value: any) => {
                setHeaders.push(key.toLowerCase());
                return originalSetHeader.call(res, key, value);
            };
        }

        let timeoutId: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`Middleware "${name}" timed out`));
            }, this.executionTimeoutMs);
        });

        try {
            await Promise.race([
                (async () => {
                    await reg.middleware(ctx.req, ctx.res, wrappedNext);
                })(),
                timeoutPromise,
            ]);
        } catch (err) {
            clearTimeout(timeoutId!);
            // Restore original setHeader
            if (reg.trackHeaders && typeof originalSetHeader === "function") {
                res.setHeader = originalSetHeader;
            }
            return {
                success: false,
                aborted,
                error: err instanceof Error ? err : new Error(String(err)),
                durationMs: Date.now() - start,
            };
        }

        clearTimeout(timeoutId!);

        // Restore original setHeader
        if (reg.trackHeaders && typeof originalSetHeader === "function") {
            res.setHeader = originalSetHeader;
        }

        // If middleware didn't call next(), treat as aborting the chain
        if (!nextCalled) {
            aborted = true;
        }

        return {
            success: true,
            aborted,
            durationMs: Date.now() - start,
        };
    }

    async executeAll(
        ctx: MiddlewareContext,
    ): Promise<MiddlewareResult[]> {
        const results: MiddlewareResult[] = [];
        const ordered = this.list();

        for (const reg of ordered) {
            if (ctx.aborted) break;

            const result = await this.execute(reg.name, {
                ...ctx,
                phase: ctx.phase,
            });

            results.push(result);

            if (!result.success && !result.aborted) {
                continue;
            }

            if (result.aborted) {
                ctx.aborted = true;
                break;
            }
        }

        return results;
    }
}
