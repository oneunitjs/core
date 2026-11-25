import type {
    HookListener,
    Hooks,
    HooksOptions,
} from "./type.js";
import {
    DEFAULT_HOOKS,
    type DefaultHookName,
} from "./default-hooks.js";
import { HookNotAllowedError } from "../errors/hooks.js";

const DEFAULT_MAX_ERRORS = 100;

class HooksImpl<Context = unknown, HookName extends string = string>
    implements Hooks<Context, HookName>
{
    private readonly store = new Map<string, HookListener<Context>[]>();
    private readonly throwOnError: boolean;
    private readonly allowedHooks: Set<string> | null;
    // once-wrappers are keyed by hook name then by the original listener so
    // that reusing the same callback with `once()` on different hook names
    // does not overwrite its wrapper mapping.
    private readonly onceWrappers = new Map<string, Map<HookListener<Context>, HookListener<Context>>>();
    private readonly errors: Error[] = [];
    private readonly maxErrors: number;

    constructor(options: HooksOptions = {}) {
        this.throwOnError = options.throwOnError ?? false;
        this.allowedHooks = options.allowedHooks
            ? new Set(options.allowedHooks)
            : null;
        this.maxErrors = options.maxErrors ?? DEFAULT_MAX_ERRORS;
    }

    private validateHook(name: string): void {
        if (this.allowedHooks && !this.allowedHooks.has(name)) {
            throw new HookNotAllowedError(
                name,
                Array.from(this.allowedHooks),
            );
        }
    }

    private pushError(err: Error): void {
        this.errors.push(err);
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }
    }

    on(name: HookName, listener: HookListener<Context>): Hooks<Context, HookName> {
        this.validateHook(name as string);
        const existing = this.store.get(name as string);
        if (existing) {
            existing.push(listener);
        } else {
            this.store.set(name as string, [listener]);
        }
        return this;
    }

    use(name: HookName, listener: HookListener<Context>): Hooks<Context, HookName> {
        return this.on(name, listener);
    }

    /**
     * Remove a specific listener from a specific hook.
     *
     * Use this when you want to unsubscribe one callback from one event.
     * If the hook has no more listeners after removal, the hook entry is deleted.
     */
    off(name: HookName, listener: HookListener<Context>): Hooks<Context, HookName> {
        const byName = this.onceWrappers.get(name as string);
        const target = byName?.get(listener) ?? listener;

        const existing = this.store.get(name as string);
        if (!existing) {
            return this;
        }

        const index = existing.indexOf(target);
        if (index !== -1) {
            existing.splice(index, 1);
            if (byName) {
                byName.delete(listener);
                if (byName.size === 0) {
                    this.onceWrappers.delete(name as string);
                }
            }
        }

        if (existing.length === 0) {
            this.store.delete(name as string);
        }

        return this;
    }

    once(name: HookName, listener: HookListener<Context>): Hooks<Context, HookName> {
        this.validateHook(name as string);
        const hookName = name as string;
        const byName = this.onceWrappers.get(hookName) ?? new Map<HookListener<Context>, HookListener<Context>>();

        let onceListener: HookListener<Context> | undefined = byName.get(listener);
        if (!onceListener) {
            const wrapper: HookListener<Context> = async (context: Context) => {
                this.off(name, wrapper);
                byName.delete(listener);
                if (byName.size === 0) {
                    this.onceWrappers.delete(hookName);
                }
                await listener(context);
            };
            onceListener = wrapper;
            byName.set(listener, wrapper);
            this.onceWrappers.set(hookName, byName);
        }

        return this.on(name, onceListener!);
    }

    async emit(name: HookName, context: Context): Promise<void> {
        this.validateHook(name as string);
        const hookName = name as string;
        const list = this.store.get(hookName);
        if (!list || list.length === 0) {
            return;
        }

        // Dispatch against a snapshot so that listeners removing themselves
        // (e.g. once-wrappers) during iteration cannot skip subsequent listeners.
        const snapshot = [...list];
        for (const listener of snapshot) {
            try {
                await listener(context);
            } catch (err) {
                this.pushError(err instanceof Error ? err : new Error(String(err)));
                if (this.throwOnError) {
                    throw err;
                }
            }
        }
    }

    emitSync(name: HookName, context: Context): void {
        this.validateHook(name as string);
        const hookName = name as string;
        const list = this.store.get(hookName);
        if (!list || list.length === 0) {
            return;
        }

        const snapshot = [...list];
        for (const listener of snapshot) {
            try {
                listener(context);
            } catch (err) {
                this.pushError(err instanceof Error ? err : new Error(String(err)));
                if (this.throwOnError) {
                    throw err;
                }
            }
        }
    }

    getErrors(): Error[] {
        return [...this.errors];
    }

    has(name: HookName): boolean {
        return this.store.has(name as string);
    }

    listeners(name: HookName): HookListener<Context>[] {
        // Return a copy so callers cannot mutate the internal listener array.
        return [...(this.store.get(name as string) ?? [])];
    }

    listenerCount(name: HookName): number {
        return this.store.get(name as string)?.length ?? 0;
    }

    /**
     * Remove ALL listeners from ALL hooks.
     *
     * Use this to completely reset the hooks instance.
     */
    clear(): Hooks<Context, HookName> {
        this.store.clear();
        this.onceWrappers.clear();
        return this;
    }

    /**
     * Remove ALL listeners from a specific hook.
     *
     * Use this to unsubscribe every callback from one event.
     */
    clearHook(name: HookName): Hooks<Context, HookName> {
        this.store.delete(name as string);
        this.onceWrappers.delete(name as string);
        return this;
    }

    toJSON(): Record<string, number> {
        const result: Record<string, number> = {};
        for (const [name, list] of this.store.entries()) {
            result[name] = list.length;
        }
        return result;
    }

    supportedHooks(): readonly string[] {
        if (this.allowedHooks) {
            return Array.from(this.allowedHooks);
        }
        return [...DEFAULT_HOOKS];
    }

    isSupported(name: string): boolean {
        if (this.allowedHooks) {
            return this.allowedHooks.has(name);
        }
        return DEFAULT_HOOKS.includes(name as DefaultHookName);
    }
}

export function createHooks<Context = unknown>(options: HooksOptions = {}): Hooks<Context> {
    return new HooksImpl<Context>(options);
}

export function createHooksWithDefaults<Context = unknown>(
    options: HooksOptions = {},
): Hooks<Context, DefaultHookName> {
    return new HooksImpl<Context, DefaultHookName>({
        ...options,
        allowedHooks: options.allowedHooks ?? DEFAULT_HOOKS,
    });
}

export type { HookListener, Hooks, HooksOptions, HookAdapterSupport } from "./type.js";
export { DEFAULT_HOOKS, APPLICATION_HOOKS, LIFECYCLE_HOOKS } from "./default-hooks.js";
export type {
    DefaultHookName,
    ApplicationHookName,
    LifecycleHookName,
} from "./default-hooks.js";
