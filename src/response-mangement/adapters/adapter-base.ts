import type { ResponseFrameworkAdapter } from "./types.js";
import { isBodylessStatus } from "../types.js";
import { ResponseAlreadySentError } from "../../errors/response.js";

/**
 * Shared adapter factory for response management.
 * Eliminates duplication across Express, Fastify, Koa, and HTTP adapters.
 *
 * The framework-specific logic is injected via callbacks:
 *  - `isSent()`: Check if response already sent
 *  - `setHeader(name, value)`: Set a single header
 *  - `setStatus(code)`: Set HTTP status code
 *  - `setBodylessStatus(code)`: Send empty response for bodyless status
 *  - `setContentType()`: Set content-type to application/json
 *  - `sendBody(body)`: Send the response body
 */
export function createResponseAdapter(
    name: string,
    callbacks: {
        isSent(): boolean;
        setHeader(name: string, value: string): void;
        setStatus(code: number): void;
        sendBodyless(code: number): void;
        setContentType(): void;
        sendBody(body: unknown): void;
    },
): ResponseFrameworkAdapter {
    return {
        name,
        send({ status, body, headers }) {
            if (callbacks.isSent()) {
                throw new ResponseAlreadySentError();
            }

            if (headers) {
                for (const [headerName, value] of Object.entries(headers)) {
                    if (Array.isArray(value)) {
                        for (const v of value) {
                            callbacks.setHeader(headerName, v);
                        }
                    } else {
                        callbacks.setHeader(headerName, value);
                    }
                }
            }

            callbacks.setStatus(status);

            if (isBodylessStatus(status)) {
                callbacks.sendBodyless(status);
                return;
            }

            callbacks.setContentType();
            callbacks.sendBody(body);
        },
    };
}
