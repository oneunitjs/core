export type LifecycleMode = "easy" | "advanced" | "strict";

export interface LifecycleOptions {
    mode?: LifecycleMode;
    /** Timeout in ms for each middleware/plugin execution (default: 5000) */
    executionTimeoutMs?: number;
    /** Whether to throw on middleware/plugin errors or isolate them (default: true in strict, false otherwise) */
    throwOnError?: boolean;
    /** Max number of middleware registrations (default: 50) */
    maxMiddleware?: number;
    /** Max number of plugins (default: 50) */
    maxPlugins?: number;
    /** Allowed middleware types in easy mode (default: all) */
    allowedMiddlewareTypes?: string[];
    /** Auto-register essential middleware in easy mode (default: true) */
    autoRegisterEssential?: boolean;
}

export interface MiddlewareRegistration {
    name: string;
    type: string;
    middleware: (_req: unknown, _res: unknown, _next?: () => void) => void | Promise<void>;
    priority: number;
    conflictTypes?: string[];
    version: string;
}

export interface PluginRegistration {
    name: string;
    namespace: string;
    hooks: Record<string, Array<(_context: unknown) => void | Promise<void>>>;
    priority: number;
    version: string;
}

export interface ConflictInfo {
    type: "middleware" | "plugin" | "hook";
    name: string;
    conflictWith: string[];
    reason: string;
    severity: "warning" | "error";
}

export interface LifecycleState {
    mode: LifecycleMode;
    initialized: boolean;
    middlewareCount: number;
    pluginCount: number;
    conflicts: ConflictInfo[];
    executionCount: number;
    errorCount: number;
}

export interface MiddlewareContext {
    req: unknown;
    res: unknown;
    next: () => void;
    phase: "request" | "response" | "error";
    abort: () => void;
    aborted: boolean;
}

export interface PluginContext {
    name: string;
    namespace: string;
    emit: (_event: string, _data: unknown) => void;
    on: (_event: string, _listener: (_data: unknown) => void) => void;
}

export type MiddlewareResult = {
    success: boolean;
    aborted: boolean;
    error?: Error;
    durationMs: number;
};

export type PluginResult = {
    success: boolean;
    error?: Error;
    durationMs: number;
};

export const LIFECYCLE_MODES: LifecycleMode[] = ["easy", "advanced", "strict"];

export const DEFAULT_LIFECYCLE_OPTIONS: Required<LifecycleOptions> = {
    mode: "advanced",
    executionTimeoutMs: 5000,
    throwOnError: false,
    maxMiddleware: 50,
    maxPlugins: 50,
    allowedMiddlewareTypes: [],
    autoRegisterEssential: false,
};

export const EASY_MODE_DEFAULTS: Required<LifecycleOptions> = {
    ...DEFAULT_LIFECYCLE_OPTIONS,
    mode: "easy",
    throwOnError: true,
    autoRegisterEssential: true,
};

export const STRICT_MODE_DEFAULTS: Required<LifecycleOptions> = {
    ...DEFAULT_LIFECYCLE_OPTIONS,
    mode: "strict",
    throwOnError: true,
    executionTimeoutMs: 2000,
    maxMiddleware: 20,
    maxPlugins: 20,
};

export const ESSENTIAL_MIDDLEWARE_TYPES = [
    "cors",
    "csrf",
    "helmet",
    "compression",
    "sanitize",
] as const;

export type EssentialMiddlewareType = (typeof ESSENTIAL_MIDDLEWARE_TYPES)[number];

export const MIDDLEWARE_CONFLICT_MATRIX: Record<string, string[]> = {
    cors: ["cors"],
    csrf: ["csrf"],
    helmet: ["helmet"],
    compression: ["compression"],
    sanitize: ["sanitize"],
    multipart: ["multipart"],
};
