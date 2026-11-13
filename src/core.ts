/**
 * @oneunit/core - Unified Public API
 *
 * Single entry point for all framework capabilities.
 *
 * ```ts
 * import { createApp } from "@oneunit/core";
 *
 * // Simple usage with global config defaults
 * const app = createApp({
 *   serviceName: "my-api",
 *   port: 3000,
 *   secret: "my-secret",
 *   security: {
 *     cors: { origin: "https://example.com" },
 *     csrf: { enabled: true },
 *     helmet: { enabled: true },
 *   },
 *   cookie: { secure: true, sameSite: "lax" },
 *   multipart: { maxFileSize: 10 * 1024 * 1024 },
 * });
 *
 * // Cached API instances (same object every call)
 * app.health().register("db", async () => ({ status: "healthy" }));
 * await app.health().route(expressApp);
 *
 * app.security().cors({ origin: "*" }).middleware(req, res, next);
 * app.security().csrf({ secret: "my-secret" }).middleware(req, res, next);
 *
 * // Cookies auto-detects framework; req/res optional if framework is set
 * const cookies = app.cookies(req, res);
 * cookies.set("session", "abc123", { httpOnly: true });
 *
 * // Express-style middleware registration
 * app.use(corsMiddleware);
 * app.use(csrfMiddleware);
 * ```
 */

import type {
    HealthCheckResult,
    HealthServer,
    HealthRouteOptions,
} from "./health/types.js";
import type {
    DetectedHealthEnvironment,
} from "./health/system-health.js";

import {
    createHealthRegistry,
    createHealthRoute,
    createSystemHealthProvider,
    createDockerHealthProvider,
    createKubernetesHealthProvider,
    detectHealthEnvironment,
} from "./health/index.js";

import {
    createHooks,
} from "./hooks/index.js";

import type {
    HookListener,
} from "./hooks/type.js";

import {
    createConfig,
} from "./config/index.js";

import {
    createCookieStore,
    createDetectedCookieStore,
    DEFAULT_COOKIE_CONFIG,
} from "./cookie/index.js";
import type {
    CookieOptions,
    CookieConfig,
} from "./cookie/types.js";
import type {
    CorsOptions,
    SecurityMiddleware,
    CsrfOptions,
    HelmetOptions,
    CompressionOptions,
    SanitizeOptions,
} from "./security/types.js";
import type {
    CreateConfigOptions,
} from "./config/type.js";
import type {
    MultipartOptions,
} from "./multipart/types.js";

import {
    createCors,
    createCsrf,
    createHelmet,
    createCompression,
    createSanitizer,
} from "./security/index.js";

import {
    createMultipart,
    type MultipartMiddleware,
} from "./multipart/index.js";

import {
    LifecycleManager,
    type LifecycleOptions,
    type LifecycleState,
    type LifecycleMode,
    type MiddlewareRegistration,
    type PluginRegistration,
    type ConflictInfo,
    type MiddlewareResult,
    type PluginResult,
    type PluginContext,
} from "./lifecycle/index.js";

import {
    createMsgPack,
} from "./msgpack/index.js";

import {
    createResponseManager,
    createResponseFrameworkManager,
    createExpressAdapter,
    createFastifyAdapter,
    createKoaAdapter,
    createHttpAdapter,
    detectResponseFramework,
} from "./response-mangement/index.js";
import type {
    ResponseOptions,
    ErrorOptions,
    RespondOptions,
} from "./response-mangement/types.js";

import {
    formatBytes,
    formatTime,
    timestamp,
    getSystemInfo,
    getSystemStatus,
    type SystemInfo,
    type SystemMetrics,
    type HealthChecks,
    type SystemThresholds,
    type SystemStatus,
} from "./lib/index.js";

export interface SecurityDefaults {
    cors?: CorsOptions;
    csrf?: CsrfOptions;
    helmet?: HelmetOptions;
    compression?: CompressionOptions;
    sanitize?: SanitizeOptions;
}

export interface App {
    health(): HealthAPI;
    hooks(): HooksAPI;
    config(): ConfigAPI;
    cookies(_req?: unknown, _res?: unknown): CookieStoreAPI;
    security(): SecurityAPI;
    msgpack(): MsgPackAPI;
    multipart(): MultipartAPI;
    lifecycle(): LifecycleAPI;
    response(_req?: unknown, _res?: unknown): ResponseAPI;
    lib(): LibAPI;
    use(_middleware: (_req: unknown, _res: unknown, _next?: () => void) => void | Promise<void>): App;
}

export interface HealthAPI {
    register(_name: string, _check: () => HealthCheckResult | Promise<HealthCheckResult>, _critical?: boolean): void;
    check(): Promise<Record<string, HealthCheckResult>>;
    route(_server: HealthServer): Promise<void>;
    registerSystem(_options?: { critical?: boolean }): void;
    registerDocker(_options?: { critical?: boolean; timeoutMs?: number; includeContainers?: boolean }): void;
    registerKubernetes(_options?: { critical?: boolean; timeoutMs?: number; includePods?: boolean }): void;
    detectEnvironment(): DetectedHealthEnvironment;
}

export interface HooksAPI {
    on(_name: string, _listener: HookListener): HooksAPI;
    use(_name: string, _listener: HookListener): HooksAPI;
    off(_name: string, _listener: HookListener): HooksAPI;
    once(_name: string, _listener: HookListener): HooksAPI;
    emit(_name: string, _context: unknown): Promise<void>;
    emitSync(_name: string, _context: unknown): void;
    has(_name: string): boolean;
    listeners(_name: string): HookListener[];
    listenerCount(_name: string): number;
    clear(): HooksAPI;
    clearHook(_name: string): HooksAPI;
    toJSON(): Record<string, number>;
}

export interface ConfigAPI {
    readonly port: number;
    readonly host: string;
    readonly serviceName: string;
    readonly nodeEnv: string;
    readonly isDevelopment: boolean;
    readonly isProduction: boolean;
    readonly isTest: boolean;
    toJSON(): Record<string, unknown>;
    set(_key: string, _value: unknown): void;
    get(_key: string): unknown;
}

export interface CookieStoreAPI {
    get(_name: string): string | undefined;
    set(_name: string, _value: string, _options?: CookieOptions): CookieStoreAPI;
    delete(_name: string, _options?: { path?: string; domain?: string }): CookieStoreAPI;
    has(_name: string): boolean;
    all(): Record<string, string>;
    clear(): CookieStoreAPI;
    setSigned(_name: string, _value: string, _options?: CookieOptions): CookieStoreAPI;
    setEncrypted(_name: string, _value: string, _options?: CookieOptions): CookieStoreAPI;
    getSigned(_name: string): string | undefined;
    getEncrypted(_name: string): string | null;
    serialize(_name: string, _value: string, _options?: CookieOptions): string;
    parse(_cookieHeader: string): Record<string, string>;
}

export interface SecurityAPI {
    cors(_options?: CorsOptions): SecurityMiddleware;
    csrf(_options?: CsrfOptions): SecurityMiddleware;
    helmet(_options?: HelmetOptions): SecurityMiddleware;
    compression(_options?: CompressionOptions): SecurityMiddleware;
    sanitize(_options?: SanitizeOptions): Sanitizer;
}

export interface Sanitizer {
    sanitize(_html: string, _options?: SanitizeOptions): string;
    sanitizeObject(_obj: Record<string, unknown>, _options?: SanitizeOptions): Record<string, unknown>;
}

export interface MultipartAPI {
    multipart(_options?: MultipartOptions): MultipartMiddleware;
}

export interface LifecycleAPI {
    mode(): LifecycleMode;
    setMode(_mode: LifecycleMode): { success: boolean; conflicts: ConflictInfo[]; error?: string };
    initialize(): { success: boolean; conflicts: ConflictInfo[]; error?: string };
    registerMiddleware(
        _name: string,
        _type: string,
        _middleware: (req: unknown, res: unknown, next?: () => void) => void | Promise<void>,
        _options?: { priority?: number; conflictTypes?: string[]; version?: string },
    ): { success: boolean; conflicts: ConflictInfo[]; error?: string };
    unregisterMiddleware(_name: string): boolean;
    registerPlugin(
        _name: string,
        _namespace: string,
        _hooks: Record<string, Array<(context: unknown) => void | Promise<void>>>,
        _options?: { priority?: number; version?: string },
    ): { success: boolean; conflicts: ConflictInfo[]; error?: string };
    unregisterPlugin(_name: string, _namespace: string): boolean;
    executeMiddleware(
        _name: string,
        _req: unknown,
        _res: unknown,
        _phase?: "request" | "response" | "error",
    ): Promise<MiddlewareResult>;
    executeMiddlewareChain(
        _req: unknown,
        _res: unknown,
        _phase?: "request" | "response" | "error",
    ): Promise<MiddlewareResult[]>;
    executeHook(
        _hookName: string,
        _context: unknown,
    ): Promise<PluginResult[]>;
    executeHookIsolated(
        _hookName: string,
        _context: unknown,
        _namespace: string,
    ): Promise<PluginResult>;
    getState(): LifecycleState;
    getMiddlewareList(): MiddlewareRegistration[];
    getPluginList(): PluginRegistration[];
    getNamespaces(): string[];
    hasMiddleware(_name: string): boolean;
    hasPlugin(_name: string, _namespace: string): boolean;
    clear(): void;
    isSafe(): boolean;
    getValidationReport(): {
        safe: boolean;
        conflicts: ConflictInfo[];
        warnings: ConflictInfo[];
        errors: ConflictInfo[];
    };
    createPluginContext(_name: string, _namespace: string): PluginContext;
}

export interface MsgPackAPI {
    encode(_value: unknown): Uint8Array;
    decode<T = unknown>(_data: Uint8Array | ArrayBuffer): T;
    encodeSync(_value: unknown): Uint8Array;
    decodeSync<T = unknown>(_data: Uint8Array | ArrayBuffer): T;
}

export interface ResponseAPI {
    ok<T = unknown>(_options?: ResponseOptions<T>): void;
    success<T = unknown>(_options?: ResponseOptions<T>): void;
    created<T = unknown>(_options?: ResponseOptions<T>): void;
    accepted<T = unknown>(_options?: ResponseOptions<T>): void;
    noContent(): void;
    badRequest<T = unknown>(_options?: ErrorOptions<T>): void;
    unauthorized<T = unknown>(_options?: ErrorOptions<T>): void;
    forbidden<T = unknown>(_options?: ErrorOptions<T>): void;
    notFound<T = unknown>(_options?: ErrorOptions<T>): void;
    conflict<T = unknown>(_options?: ErrorOptions<T>): void;
    unprocessable<T = unknown>(_options?: ErrorOptions<T>): void;
    internalServerError<T = unknown>(_options?: ErrorOptions<T>): void;
    respond<T = unknown>(_options: RespondOptions<T>): void;
}

export interface LibAPI {
    formatBytes(_bytes: number, _decimals?: number): string;
    formatTime(_ms: number): string;
    timestamp(_date: Date): string;
    getSystemInfo(): SystemInfo;
    getSystemStatus(_system: SystemMetrics, _checks: HealthChecks, _thresholds?: SystemThresholds): SystemStatus;
}

export interface AppOptions {
    serviceName?: string;
    port?: number;
    host?: string;
    nodeEnv?: string;
    secret?: string;
    framework?: "express" | "fastify" | "koa" | "http";

    security?: SecurityDefaults;
    cookie?: CookieConfig;
    multipart?: MultipartOptions;
    health?: {
        path?: string;
    };
    lifecycle?: LifecycleOptions;
}

export function createApp(options?: AppOptions): App {
    const {
        serviceName = "app",
        port = 3000,
        host = "localhost",
        nodeEnv,
        secret,
        security = {},
        cookie = {},
        multipart = {},
        health = {},
    } = options ?? {};

    const configOptions: CreateConfigOptions = {
        port,
        host,
        serviceName,
        nodeEnv,
    };

    const config = createConfig(configOptions);

    const configAPI: ConfigAPI = {
        get port() { return config.port; },
        get host() { return config.host; },
        get serviceName() { return config.serviceName; },
        get nodeEnv() { return config.nodeEnv; },
        get isDevelopment() { return config.isDevelopment; },
        get isProduction() { return config.isProduction; },
        get isTest() { return config.isTest; },
        toJSON() {
            return config.toJSON() as unknown as Record<string, unknown>;
        },
        set(key, value) {
            (config as any)[key] = value;
        },
        get(key) {
            return (config as any)[key];
        },
    };

    const healthRegistry = createHealthRegistry();
    const healthRoute = createHealthRoute(healthRegistry, {
        path: health.path ?? "/health",
        serviceName,
    } as HealthRouteOptions);

    const healthAPI: HealthAPI = {
        register(name, check, critical) {
            healthRegistry.register({ name, check, critical });
        },
        async check() {
            return healthRegistry.checkAll();
        },
        async route(_server) {
            await (healthRoute as unknown as (_server: HealthServer) => Promise<void>)(_server);
        },
        registerSystem(options) {
            healthRegistry.register(createSystemHealthProvider(options));
        },
        registerDocker(options) {
            healthRegistry.register(createDockerHealthProvider(options));
        },
        registerKubernetes(options) {
            healthRegistry.register(createKubernetesHealthProvider(options));
        },
        detectEnvironment() {
            return detectHealthEnvironment();
        },
    };

    const hooks = createHooks();

    const hooksAPI: HooksAPI = {
        on(name, listener) {
            hooks.on(name, listener);
            return hooksAPI;
        },
        use(name, listener) {
            hooks.on(name, listener);
            return hooksAPI;
        },
        off(name, listener) {
            hooks.off(name, listener);
            return hooksAPI;
        },
        once(name, listener) {
            hooks.once(name, listener);
            return hooksAPI;
        },
        async emit(name, context) {
            await hooks.emit(name, context);
        },
        emitSync(name, context) {
            hooks.emitSync(name, context);
        },
        has(name) {
            return hooks.has(name);
        },
        listeners(name) {
            return hooks.listeners(name);
        },
        listenerCount(name) {
            return hooks.listenerCount(name);
        },
        clear() {
            hooks.clear();
            return hooksAPI;
        },
        clearHook(name) {
            hooks.clearHook(name);
            return hooksAPI;
        },
        toJSON() {
            return hooks.toJSON();
        },
    };

    const cookieConfig: CookieConfig = {
        secret,
        ...DEFAULT_COOKIE_CONFIG,
        ...cookie,
    };

    let cachedCookieStore: ReturnType<typeof createDetectedCookieStore> | null = null;
    let cachedCookieReqRes: { req: unknown; res: unknown } | null = null;

    function buildCookieAPI(store: ReturnType<typeof createDetectedCookieStore>): CookieStoreAPI {
        return {
            get(name) { return store.get(name); },
            set(name, value, options) {
                store.set(name, value, options);
                return api;
            },
            delete(name, options) {
                store.delete(name, options);
                return api;
            },
            has(name) { return store.has(name); },
            all() { return store.all(); },
            clear() {
                store.clear();
                return api;
            },
            setSigned(name, value, options) {
                store.setSigned(name, value, options);
                return api;
            },
            setEncrypted(name, value, options) {
                store.setEncrypted(name, value, options);
                return api;
            },
            getSigned(name) { return store.getSigned(name); },
            getEncrypted(name) { return store.getEncrypted(name); },
            serialize(name, value, options) {
                return store.serialize(name, value, options);
            },
            parse(cookieHeader) {
                return store.parse(cookieHeader);
            },
        };
    }

    let api: CookieStoreAPI;

    const cookieStoreAPI = (req?: unknown, res?: unknown): CookieStoreAPI => {
        if (req && res) {
            cachedCookieReqRes = { req, res };
            cachedCookieStore = createDetectedCookieStore(req, res, undefined, cookieConfig);
            api = buildCookieAPI(cachedCookieStore);
            return api;
        }

        if (cachedCookieStore && cachedCookieReqRes) {
            api = buildCookieAPI(cachedCookieStore);
            return api;
        }

        cachedCookieStore = createCookieStore(cookieConfig) as ReturnType<typeof createDetectedCookieStore>;
        cachedCookieReqRes = { req: undefined, res: undefined };
        api = buildCookieAPI(cachedCookieStore);
        return api;
    };

    const securityAPI: SecurityAPI = {
        cors(options) {
            const merged: CorsOptions = { ...security.cors, ...options };
            return createCors(merged);
        },
        csrf(options) {
            const merged: CsrfOptions = { ...security.csrf, ...options, secret: options?.secret ?? secret };
            return createCsrf(merged);
        },
        helmet(options) {
            const merged: HelmetOptions = { ...security.helmet, ...options };
            return createHelmet(merged);
        },
        compression(options) {
            const merged: CompressionOptions = { ...security.compression, ...options };
            return createCompression(merged);
        },
        sanitize(options) {
            const merged: SanitizeOptions = { ...security.sanitize, ...options };
            return createSanitizer(merged);
        },
    };

    const multipartAPI: MultipartAPI = {
        multipart(options) {
            const merged: MultipartOptions = { ...multipart, ...options };
            return createMultipart(merged);
        },
    };

    const lifecycleManager = new LifecycleManager({
        mode: options?.lifecycle?.mode ?? "advanced",
        executionTimeoutMs: options?.lifecycle?.executionTimeoutMs,
        throwOnError: options?.lifecycle?.throwOnError,
        maxMiddleware: options?.lifecycle?.maxMiddleware,
        maxPlugins: options?.lifecycle?.maxPlugins,
        allowedMiddlewareTypes: options?.lifecycle?.allowedMiddlewareTypes,
        autoRegisterEssential: options?.lifecycle?.autoRegisterEssential,
    });

    lifecycleManager.initialize();

    const lifecycleAPI: LifecycleAPI = {
        mode() { return lifecycleManager.getMode(); },
        setMode(mode) { return lifecycleManager.setMode(mode); },
        initialize() { return lifecycleManager.initialize(); },
        registerMiddleware(name, type, middleware, opts) {
            return lifecycleManager.registerMiddleware(name, type, middleware, opts);
        },
        unregisterMiddleware(name) { return lifecycleManager.unregisterMiddleware(name); },
        registerPlugin(name, namespace, hooks, opts) {
            return lifecycleManager.registerPlugin(name, namespace, hooks, opts);
        },
        unregisterPlugin(name, namespace) { return lifecycleManager.unregisterPlugin(name, namespace); },
        async executeMiddleware(name, req, res, phase) {
            return lifecycleManager.executeMiddleware(name, req, res, phase);
        },
        async executeMiddlewareChain(req, res, phase) {
            return lifecycleManager.executeMiddlewareChain(req, res, phase);
        },
        async executeHook(hookName, context) {
            return lifecycleManager.executeHook(hookName, context);
        },
        async executeHookIsolated(hookName, context, namespace) {
            return lifecycleManager.executeHookIsolated(hookName, context, namespace);
        },
        getState() { return lifecycleManager.getState(); },
        getMiddlewareList() { return lifecycleManager.getMiddlewareList(); },
        getPluginList() { return lifecycleManager.getPluginList(); },
        getNamespaces() { return lifecycleManager.getNamespaces(); },
        hasMiddleware(name) { return lifecycleManager.hasMiddleware(name); },
        hasPlugin(name, namespace) { return lifecycleManager.hasPlugin(name, namespace); },
        clear() { lifecycleManager.clear(); },
        isSafe() { return lifecycleManager.isSafe(); },
        getValidationReport() { return lifecycleManager.getValidationReport(); },
        createPluginContext(name, namespace) {
            return lifecycleManager.createPluginContext(name, namespace);
        },
    };

    const msgpack = createMsgPack();

    const msgpackAPI: MsgPackAPI = {
        encode(value: unknown) { return msgpack.encode(value); },
        decode<T = unknown>(data: Uint8Array | ArrayBuffer) { return msgpack.decode<T>(data as any); },
        encodeSync(value: unknown) { return msgpack.encodeSync(value); },
        decodeSync<T>(data: Uint8Array | ArrayBuffer) { return msgpack.decodeSync<T>(data as any); },
    };

    let cachedResponseAdapter: any = null;
    let cachedResponseReqRes: { req: unknown; res: unknown } | null = null;

    const responseAPI = (req?: unknown, res?: unknown): ResponseAPI => {
        if (req && res) {
            cachedResponseReqRes = { req, res };
            const detected = detectResponseFramework(
                (req as any)?.headers,
                res as any,
                (res as any)?.ctx,
            );

            let adapter: any;
            if (detected.framework === "koa") {
                adapter = createKoaAdapter(res as any);
            } else if (detected.framework === "express") {
                adapter = createExpressAdapter(res as any);
            } else if (detected.framework === "http") {
                adapter = createHttpAdapter(res as any);
            } else {
                adapter = createFastifyAdapter(res as any);
            }
            cachedResponseAdapter = adapter;
        } else if (cachedResponseAdapter && cachedResponseReqRes) {
            // Return cached adapter-based API
        } else {
            throw new Error("response() requires req and res arguments on first call");
        }

        const manager = createResponseManager();
        const adapter = cachedResponseAdapter;

        const rfm = createResponseFrameworkManager(manager, adapter);

        return {
            ok(options) { rfm.ok(options); },
            success(options) { rfm.success(options); },
            created(options) { rfm.created(options); },
            accepted(options) { rfm.accepted(options); },
            noContent() { rfm.noContent(); },
            badRequest(options) { rfm.badRequest(options); },
            unauthorized(options) { rfm.unauthorized(options); },
            forbidden(options) { rfm.forbidden(options); },
            notFound(options) { rfm.notFound(options); },
            conflict(options) { rfm.conflict(options); },
            unprocessable(options) { rfm.unprocessable(options); },
            internalServerError(options) { rfm.internalServerError(options); },
            respond(options) { rfm.respond(options); },
        };
    };

    const libAPI: LibAPI = {
        formatBytes(bytes, decimals) {
            return formatBytes(bytes, decimals);
        },
        formatTime(ms) {
            return formatTime(ms);
        },
        timestamp(date) {
            return timestamp(date);
        },
        getSystemInfo() {
            return getSystemInfo();
        },
        getSystemStatus(system, checks, thresholds) {
            return getSystemStatus(system as any, checks as any, thresholds);
        },
    };

    const middlewares: Array<(_req: unknown, _res: unknown, _next?: () => void) => void | Promise<void>> = [];

    function use(_middleware: (_req: unknown, _res: unknown, _next?: () => void) => void | Promise<void>): App {
        middlewares.push(_middleware);
        return appInstance;
    }

    const appInstance: App = {
        health: () => healthAPI,
        hooks: () => hooksAPI,
        config: () => configAPI,
        cookies: cookieStoreAPI,
        security: () => securityAPI,
        multipart: () => multipartAPI,
        lifecycle: () => lifecycleAPI,
        msgpack: () => msgpackAPI,
        response: responseAPI,
        lib: () => libAPI,
        use,
    };

    return appInstance;
}
