export type HookListener<Context = unknown> = (context: Context) => void | Promise<void>;

export interface HooksOptions {
    throwOnError?: boolean;
    allowedHooks?: readonly string[];
}

export interface Hooks<Context = unknown, HookName extends string = string> {
    on(name: HookName, listener: HookListener<Context>): Hooks<Context, HookName>;
    use(name: HookName, listener: HookListener<Context>): Hooks<Context, HookName>;
    off(name: HookName, listener: HookListener<Context>): Hooks<Context, HookName>;
    once(name: HookName, listener: HookListener<Context>): Hooks<Context, HookName>;
    emit(name: HookName, context: Context): Promise<void>;
    emitSync(name: HookName, context: Context): void;
    has(name: HookName): boolean;
    listeners(name: HookName): HookListener<Context>[];
    listenerCount(name: HookName): number;
    clear(): Hooks<Context, HookName>;
    clearHook(name: HookName): Hooks<Context, HookName>;
    toJSON(): Record<string, number>;
    supportedHooks(): readonly string[];
    isSupported(name: string): boolean;
}

export interface HookAdapterSupport {
    supported: readonly string[];
    unsupported?: readonly string[];
}
