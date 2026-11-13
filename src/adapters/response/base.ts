/**
 * Abstract base class for all response adapters.
 *
 * Provides the standardized send() contract that all response adapters must
 * implement. Subclasses provide framework-specific I/O via callback methods.
 *
 * The send() method handles:
 *  - Already-sent detection (throws AdapterError if response already sent)
 *  - Header iteration (with array value support)
 *  - Status code setting
 *  - Bodyless status detection (no body for 204, 304, etc.)
 *  - Content-Type: application/json setting
 *  - Body serialization (JSON.stringify)
 */
import { AdapterError, type BaseAdapter, type FrameworkName } from "../types.js";
import { isBodylessStatus } from "../../response-mangement/types.js";

export interface ResponseAdapterConfig {
    readonly framework: FrameworkName;
    readonly request: unknown;
    readonly response: unknown;
}

export interface SendPayload {
    readonly status: number;
    readonly body?: unknown;
    readonly headers?: Record<string, string | string[]>;
}

export abstract class BaseResponseAdapter implements BaseAdapter {
    readonly framework: FrameworkName;
    readonly name: string;
    protected readonly request: unknown;
    protected readonly response: unknown;
    initialized = false;

    constructor(config: ResponseAdapterConfig) {
        this.framework = config.framework;
        this.name = `response-${config.framework}`;
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
     * Check if the response has already been sent.
     * Subclasses must implement framework-specific detection.
     */
    abstract isResponseSent(): boolean;

    /**
     * Set a single response header.
     * Subclasses must implement framework-specific header setting.
     */
    abstract setResponseHeader(name: string, value: string): void;

    /**
     * Set the HTTP status code.
     * Subclasses must implement framework-specific status setting.
     */
    abstract setResponseStatus(code: number): void;

    /**
     * Send an empty response for bodyless status codes.
     * Subclasses must implement framework-specific empty response.
     */
    abstract sendBodyless(code: number): void;

    /**
     * Set Content-Type to application/json.
     * Subclasses must implement framework-specific content type setting.
     */
    abstract setContentTypeJson(): void;

    /**
     * Send the response body (JSON serialized).
     * Subclasses must implement framework-specific body sending.
     */
    abstract sendResponseBody(body: unknown): void;

    /**
     * Standardized send method used by all response adapters.
     * Handles headers, status, bodyless detection, content-type, and body.
     */
    send(payload: SendPayload): void {
        if (!this.initialized) {
            throw new AdapterError(
                `Response adapter "${this.name}" is not initialized`,
                this.name,
                this.framework,
                "ADAPTER_NOT_INITIALIZED",
            );
        }

        if (this.isResponseSent()) {
            throw new AdapterError(
                "Response has already been sent",
                this.name,
                this.framework,
                "RESPONSE_ALREADY_SENT",
            );
        }

        // Set headers
        if (payload.headers) {
            for (const [headerName, value] of Object.entries(payload.headers)) {
                if (Array.isArray(value)) {
                    for (const v of value) {
                        this.setResponseHeader(headerName, v);
                    }
                } else {
                    this.setResponseHeader(headerName, value);
                }
            }
        }

        // Set status
        this.setResponseStatus(payload.status);

        // Handle bodyless status codes (204, 304, etc.)
        if (isBodylessStatus(payload.status)) {
            this.sendBodyless(payload.status);
            return;
        }

        // Set content type and send body
        this.setContentTypeJson();
        this.sendResponseBody(payload.body);
    }
}
