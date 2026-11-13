/**
 * Abstract base class for all cookie adapters.
 *
 * Provides shared cookie serialization/deserialization logic via the
 * cookie-utils module, while delegating framework-specific I/O to subclasses.
 *
 * Subclasses must implement: getRawCookieHeader(), setRawCookieHeader(),
 * deleteRawCookieHeader(), getAllRawCookies().
 */
import type { CookieOptions } from "../../cookie/types.js";
import {
    parseCookieHeader,
    buildCookieParts,
    validateCookieName,
} from "../../cookie/cookie-utils.js";
import { AdapterError, type BaseAdapter, type FrameworkName } from "../types.js";

export interface CookieAdapterConfig {
    readonly framework: FrameworkName;
    readonly request: unknown;
    readonly response: unknown;
}

export abstract class BaseCookieAdapter implements BaseAdapter {
    readonly framework: FrameworkName;
    readonly name: string;
    protected readonly request: unknown;
    protected readonly response: unknown;
    initialized = false;

    constructor(config: CookieAdapterConfig) {
        this.framework = config.framework;
        this.name = `cookie-${config.framework}`;
        this.request = config.request;
        this.response = config.response;
    }

    initialize(): void {
        this.initialized = true;
    }

    dispose(): void {
        this.initialized = false;
    }

    /**
     * Get a cookie value by name.
     */
    get(name: string): string | undefined {
        if (!this.initialized) {
            throw new AdapterError(
                `Cookie adapter "${this.name}" is not initialized`,
                this.name,
                this.framework,
                "ADAPTER_NOT_INITIALIZED",
            );
        }
        return parseCookieHeader(this.getRawCookieHeader() ?? "")[name];
    }

    /**
     * Set a cookie with full attribute support.
     */
    set(
        name: string,
        value: string,
        options: CookieOptions = {},
    ): void {
        if (!this.initialized) {
            throw new AdapterError(
                `Cookie adapter "${this.name}" is not initialized`,
                this.name,
                this.framework,
                "ADAPTER_NOT_INITIALIZED",
            );
        }
        validateCookieName(name);
        this.setRawCookieHeader(
            buildCookieParts(name, value, options).join("; "),
        );
    }

    /**
     * Delete a cookie by expiring it.
     */
    delete(
        name: string,
        options?: { path?: string; domain?: string },
    ): void {
        if (!this.initialized) {
            throw new AdapterError(
                `Cookie adapter "${this.name}" is not initialized`,
                this.name,
                this.framework,
                "ADAPTER_NOT_INITIALIZED",
            );
        }
        this.deleteRawCookieHeader(name, options);
    }

    /**
     * Get all cookies.
     */
    getAll(): Record<string, string> {
        if (!this.initialized) {
            throw new AdapterError(
                `Cookie adapter "${this.name}" is not initialized`,
                this.name,
                this.framework,
                "ADAPTER_NOT_INITIALIZED",
            );
        }
        return this.getAllRawCookies();
    }

    /**
     * Get a cookie value by name from the raw cookie header.
     * Subclasses must provide framework-specific cookie header access.
     */
    abstract getRawCookieHeader(): string | undefined;

    /**
     * Set a Set-Cookie header.
     * Subclasses must provide framework-specific header setting.
     */
    abstract setRawCookieHeader(header: string): void;

    /**
     * Delete a cookie by setting an expired Set-Cookie header.
     * Subclasses must provide framework-specific header setting.
     */
    abstract deleteRawCookieHeader(
        name: string,
        options?: { path?: string; domain?: string },
    ): void;

    /**
     * Get all cookies as a record.
     * Subclasses must provide framework-specific access to all cookies.
     */
    abstract getAllRawCookies(): Record<string, string>;
}
