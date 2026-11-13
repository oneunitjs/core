/**
 * Centralized adapter types for the @oneunit/core adapter subsystem.
 *
 * This module defines the shared types, interfaces, and enums used by all
 * adapter implementations across cookie, response, middleware, and health
 * categories. By centralizing type definitions here, we ensure consistency
 * and prevent divergence between adapter categories.
 */

export type FrameworkName = "express" | "fastify" | "koa" | "http";
export type FrameworkType = FrameworkName;

export interface FrameworkAdapter {
    framework: FrameworkName;
    adapt(_middleware: any): any;
}

export interface AdaptedMiddleware {
    framework: FrameworkName;
    _middleware: any;
    registration: any;
}

/**
 * Base interface that all adapters must implement.
 * Every adapter identifies its target framework and provides lifecycle methods.
 */
export interface BaseAdapter {
    readonly framework: FrameworkName;
    readonly name: string;
    readonly initialized: boolean;
    initialize(): void;
    dispose(): void;
}

/**
 * Result of an adapter registration operation.
 */
export interface AdapterRegistrationResult {
    readonly success: boolean;
    readonly adapterName: string;
    readonly framework: FrameworkName;
    readonly error?: string;
}

/**
 * Adapter registry entry.
 */
export interface AdapterEntry<AdapterType extends BaseAdapter = BaseAdapter> {
    readonly name: string;
    readonly framework: FrameworkName;
    readonly adapter: AdapterType;
    readonly registeredAt: number;
}

/**
 * Configuration options common to all adapters.
 */
export interface AdapterConfig {
    readonly enabled?: boolean;
    readonly framework: FrameworkName;
    readonly [key: string]: unknown;
}

/**
 * Standardized error thrown by adapter operations.
 */
export class AdapterError extends Error {
    readonly adapterName: string;
    readonly framework: FrameworkName;
    readonly code: string;

    constructor(
        message: string,
        adapterName: string,
        framework: FrameworkName,
        code: string = "ADAPTER_ERROR",
    ) {
        super(message);
        this.name = "AdapterError";
        this.adapterName = adapterName;
        this.framework = framework;
        this.code = code;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Error thrown when an adapter is not found in the registry.
 */
export class AdapterNotFoundError extends AdapterError {
    constructor(adapterName: string, framework: FrameworkName) {
        super(
            `Adapter "${adapterName}" not found for framework "${framework}"`,
            adapterName,
            framework,
            "ADAPTER_NOT_FOUND",
        );
        this.name = "AdapterNotFoundError";
    }
}

/**
 * Error thrown when an adapter is already registered.
 */
export class AdapterAlreadyRegisteredError extends AdapterError {
    constructor(adapterName: string, framework: FrameworkName) {
        super(
            `Adapter "${adapterName}" is already registered for framework "${framework}"`,
            adapterName,
            framework,
            "ADAPTER_ALREADY_REGISTERED",
        );
        this.name = "AdapterAlreadyRegisteredError";
    }
}

/**
 * Error thrown when an adapter is not initialized.
 */
export class AdapterNotInitializedError extends AdapterError {
    constructor(adapterName: string, framework: FrameworkName) {
        super(
            `Adapter "${adapterName}" for framework "${framework}" is not initialized`,
            adapterName,
            framework,
            "ADAPTER_NOT_INITIALIZED",
        );
        this.name = "AdapterNotInitializedError";
    }
}
