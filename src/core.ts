/**
 * @oneunit/core - Unified Public API
 *
 * Single entry point for all framework capabilities.
 *
 * ```ts
 * import { createApp } from "@oneunit/core";
 *
 * const app = createApp({ serviceName: "my-api", secret: "my-secret" });
 *
 * // Health checks
 * app.health().register("db", async () => ({ status: "healthy" }));
 * await app.health().route(expressApp);
 *
 * // Hooks
 * app.hooks().on("request", async (ctx) => { ... });
 * await app.hooks().emit("request", ctx);
 *
 * // Config
 * const config = app.config();
 * console.log(config.port, config.isProduction);
 *
 * // Cookies (auto-detects framework)
 * const cookies = app.cookies(req, res);
 * cookies.set("session", "abc123", { httpOnly: true });
 *
 * // Security middleware
 * app.security().cors({ origin: "https://example.com" });
 * app.security().helmet({ hsts: { maxAge: 31536000 } });
 * app.security().csrf({ secret: "my-secret" });
 * app.security().compression({ threshold: 1024 });
 *
 * // MessagePack
 * const msgpack = app.msgpack();
 * const bytes = msgpack.encode({ hello: "world" });
 *
 * // Response helpers
 * app.response().ok(res, { data: { id: 1 } });
 * app.response().notFound(res, { message: "Not found" });
 *
 * // System info & health status
 * const info = app.lib().getSystemInfo();
 * const status = app.lib().getSystemStatus(metrics, checks);
 * ```
 */

import type {
    HealthProvider,
    HealthCheckResult,
    HealthRegistry,
    HealthServer,
    HealthReply,
    HealthRouteOptions,
} from "./health/types.js";
import type {
    HealthEnvironment,
    DetectedHealthEnvironment,
} from "./health/system-health.js";

import {
    createHealthRegistry,
    createHealthRoute,
    createSystemHealthProvider,
    createDockerHealthProvider,
    createKubernetesHealthProvider,
} from "./health/index.js";
import {
    detectHealthEnvironment,
} from "./health/system-health.js";

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
} from "./cookie/index.js";
import type {
    CookieOptions,
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
    SystemInfo,
    SystemMetrics,
    HealthChecks,
    SystemThresholds,
    SystemStatus,
} from "./lib/index.js";
import type {
    CreateConfigOptions,
} from "./config/type.js";
import type {
    CookieConfig,
} from "./cookie/types.js";

import {
    createCors,
    createCsrf,
    createHelmet,
    createCompression,
    createSanitizer,
} from "./security/index.js";

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
} from "./lib/index.js";

export interface App {
    health(): HealthAPI;
    hooks(): HooksAPI;
    config(): ConfigAPI;
    cookies(req?: unknown, res?: unknown): CookieStoreAPI;
    security(): SecurityAPI;
    msgpack(): MsgPackAPI;
    response(req?: unknown, res?: unknown): ResponseAPI;
    lib(): LibAPI;
}

export interface HealthAPI {
    register(name: string, check: () => HealthCheckResult | Promise<HealthCheckResult>, critical?: boolean): void;
    check(): Promise<Record<string, HealthCheckResult>>;
    route(server: HealthServer): Promise<void>;
    registerSystem(options?: { critical?: boolean }): void;
    registerDocker(options?: { critical?: boolean; timeoutMs?: number; includeContainers?: boolean }): void;
    registerKubernetes(options?: { critical?: boolean; timeoutMs?: number; includePods?: boolean }): void;
    detectEnvironment(): DetectedHealthEnvironment;
}

export interface HooksAPI {
    on(name: string, listener: HookListener): HooksAPI;
    use(name: string, listener: HookListener): HooksAPI;
    off(name: string, listener: HookListener): HooksAPI;
    once(name: string, listener: HookListener): HooksAPI;
    emit(name: string, context: unknown): Promise<void>;
    emitSync(name: string, context: unknown): void;
    has(name: string): boolean;
    listeners(name: string): HookListener[];
    listenerCount(name: string): number;
    clear(): HooksAPI;
    clearHook(name: string): HooksAPI;
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
}

export interface CookieStoreAPI {
    get(name: string): string | undefined;
    set(name: string, value: string, options?: CookieOptions): CookieStoreAPI;
    delete(name: string, options?: { path?: string; domain?: string }): CookieStoreAPI;
    has(name: string): boolean;
    all(): Record<string, string>;
    clear(): CookieStoreAPI;
    setSigned(name: string, value: string, options?: CookieOptions): CookieStoreAPI;
    setEncrypted(name: string, value: string, options?: CookieOptions): CookieStoreAPI;
    getSigned(name: string): string | undefined;
    getEncrypted(name: string): string | null;
}

export interface SecurityAPI {
    cors(options?: CorsOptions): SecurityMiddleware;
    csrf(options?: CsrfOptions): SecurityMiddleware;
    helmet(options?: HelmetOptions): SecurityMiddleware;
    compression(options?: CompressionOptions): SecurityMiddleware;
    sanitize(options?: SanitizeOptions): Sanitizer;
}

export interface Sanitizer {
    sanitize(html: string, options?: SanitizeOptions): string;
    sanitizeObject(obj: Record<string, unknown>, options?: SanitizeOptions): Record<string, unknown>;
}

export interface MsgPackAPI {
    encode(value: unknown): Uint8Array;
    decode<T = unknown>(data: Uint8Array | ArrayBuffer): T;
    encodeSync(value: unknown): Uint8Array;
    decodeSync<T = unknown>(data: Uint8Array | ArrayBuffer): T;
}

export interface ResponseAPI {
    ok<T = unknown>(options?: ResponseOptions<T>): void;
    success<T = unknown>(options?: ResponseOptions<T>): void;
    created<T = unknown>(options?: ResponseOptions<T>): void;
    accepted<T = unknown>(options?: ResponseOptions<T>): void;
    noContent(): void;
    badRequest<T = unknown>(options?: ErrorOptions<T>): void;
    unauthorized<T = unknown>(options?: ErrorOptions<T>): void;
    forbidden<T = unknown>(options?: ErrorOptions<T>): void;
    notFound<T = unknown>(options?: ErrorOptions<T>): void;
    conflict<T = unknown>(options?: ErrorOptions<T>): void;
    unprocessable<T = unknown>(options?: ErrorOptions<T>): void;
    internalServerError<T = unknown>(options?: ErrorOptions<T>): void;
    respond<T = unknown>(options: RespondOptions<T>): void;
}

export interface LibAPI {
    formatBytes(bytes: number, decimals?: number): string;
    formatTime(ms: number): string;
    timestamp(date: Date): string;
    getSystemInfo(): SystemInfo;
    getSystemStatus(system: SystemMetrics, checks: HealthChecks, thresholds?: SystemThresholds): SystemStatus;
}

export interface AppOptions {
    framework?: "express" | "fastify" | "koa" | "http";
    serviceName?: string;
    port?: number;
    host?: string;
    nodeEnv?: string;
    secret?: string;
}

export function createApp(options?: AppOptions): App {
    const {
        framework,
        serviceName = "app",
        port = 3000,
        host = "localhost",
        nodeEnv,
        secret,
    } = options ?? {};

    const healthRegistry = createHealthRegistry();
    const healthRoute = createHealthRoute(healthRegistry, {
        path: "/health",
        serviceName,
    } as HealthRouteOptions);

    const healthAPI: HealthAPI = {
        register(name, check, critical) {
            healthRegistry.register({ name, check, critical });
        },
        async check() {
            return healthRegistry.checkAll();
        },
        async route(server) {
            await (healthRoute as unknown as (server: HealthServer) => Promise<void>)(server);
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

    const config = createConfig({
        port,
        host,
        serviceName,
        nodeEnv,
    } as CreateConfigOptions);

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
    };

    const cookieStoreAPI = (req?: unknown, res?: unknown): CookieStoreAPI => {
        const store = createDetectedCookieStore(req, res, undefined, {
            secret,
        } as CookieConfig);
        return {
            get(name) { return store.get(name); },
            set(name, value, options) {
                store.set(name, value, options);
                return store;
            },
            delete(name, options) {
                store.delete(name, options);
                return store;
            },
            has(name) { return store.has(name); },
            all() { return store.all(); },
            clear() {
                store.clear();
                return store;
            },
            setSigned(name, value, options) {
                store.setSigned(name, value, options);
                return store;
            },
            setEncrypted(name, value, options) {
                store.setEncrypted(name, value, options);
                return store;
            },
            getSigned(name) { return store.getSigned(name); },
            getEncrypted(name) { return store.getEncrypted(name); },
        };
    };

    const securityAPI: SecurityAPI = {
        cors(options) {
            return createCors(options);
        },
        csrf(options) {
            return createCsrf(options);
        },
        helmet(options) {
            return createHelmet(options);
        },
        compression(options) {
            return createCompression(options);
        },
        sanitize(options) {
            return createSanitizer(options);
        },
    };

    const msgpack = createMsgPack();

    const msgpackAPI: MsgPackAPI = {
        encode(value: unknown) { return msgpack.encode(value); },
        decode<T = unknown>(data: Uint8Array | ArrayBuffer) { return msgpack.decode<T>(data as any); },
        encodeSync(value: unknown) { return msgpack.encodeSync(value); },
        decodeSync<T>(data: Uint8Array | ArrayBuffer) { return msgpack.decodeSync<T>(data as any); },
    };

    const responseAPI = (req?: unknown, res?: unknown): ResponseAPI => {
        const manager = createResponseManager();
        let adapter: any;

        if (req && res) {
            const detected = detectResponseFramework(
                (req as any).headers,
                res as any,
                (res as any).ctx,
            );

            if (detected.framework === "koa") {
                adapter = createKoaAdapter(res as any);
            } else if (detected.framework === "express") {
                adapter = createExpressAdapter(res as any);
            } else if (detected.framework === "http") {
                adapter = createHttpAdapter(res as any);
            } else {
                adapter = createFastifyAdapter(res as any);
            }
        } else {
            throw new Error("response() requires req and res arguments");
        }

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

    return {
        health: () => healthAPI,
        hooks: () => hooksAPI,
        config: () => configAPI,
        cookies: cookieStoreAPI,
        security: () => securityAPI,
        msgpack: () => msgpackAPI,
        response: responseAPI,
        lib: () => libAPI,
    };
}