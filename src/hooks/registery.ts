import type {
    HookListener,
    Hooks,
    HooksOptions,
    HookAdapterSupport,
} from "./type.js";
import {
    DEFAULT_HOOKS,
    APPLICATION_HOOKS,
    LIFECYCLE_HOOKS,
    type DefaultHookName,
    type ApplicationHookName,
    type LifecycleHookName,
} from "./default-hooks.js";

class HooksImpl<Context = unknown, HookName extends string = string>
    implements Hooks<Context, HookName>
{
    private readonly store = new Map<string, HookListener<Context>[]>();
    private readonly throwOnError: boolean;
    private readonly allowedHooks: Set<string> | null;

    constructor(options: HooksOptions = {}) {
        this.throwOnError = options.throwOnError ?? false;
        this.allowedHooks = options.allowedHooks
            ? new Set(options.allowedHooks)
            : null;
    }

    private validateHook(name: string): void {
        if (this.allowedHooks && !this.allowedHooks.has(name)) {
            throw new Error(
                `Hook "${name}" is not allowed. Allowed hooks: ${Array.from(this.allowedHooks).join(", ")}`,
            );
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
        const existing = this.store.get(name as string);
        if (!existing) {
            return this;
        }

        const index = existing.indexOf(listener);
        if (index !== -1) {
            existing.splice(index, 1);
        }

        if (existing.length === 0) {
            this.store.delete(name as string);
        }

        return this;
    }

    once(name: HookName, listener: HookListener<Context>): Hooks<Context, HookName> {
        this.validateHook(name as string);
        const onceListener: HookListener<Context> = async (context) => {
            this.off(name, onceListener);
            await listener(context);
        };

        return this.on(name, onceListener);
    }

    async emit(name: HookName, context: Context): Promise<void> {
        this.validateHook(name as string);
        const list = this.store.get(name as string);
        if (!list || list.length === 0) {
            return;
        }

        for (const listener of list) {
            try {
                await listener(context);
            } catch (err) {
                if (this.throwOnError) {
                    throw err;
                }
            }
        }
    }

    emitSync(name: HookName, context: Context): void {
        this.validateHook(name as string);
        const list = this.store.get(name as string);
        if (!list || list.length === 0) {
            return;
        }

        for (const listener of list) {
            try {
                listener(context);
            } catch (err) {
                if (this.throwOnError) {
                    throw err;
                }
            }
        }
    }

    has(name: HookName): boolean {
        return this.store.has(name as string);
    }

    listeners(name: HookName): HookListener<Context>[] {
        return this.store.get(name as string) ?? [];
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
        return this;
    }

    /**
     * Remove ALL listeners from a specific hook.
     *
     * Use this to unsubscribe every callback from one event.
     */
    clearHook(name: HookName): Hooks<Context, HookName> {
        this.store.delete(name as string);
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
