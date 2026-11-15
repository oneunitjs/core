/**
 * @oneunit/core - Request Context Internal Timestamp
 *
 * Timestamp generation for request context initialization.
 */

import type { TimestampFormat } from "../types.js";

export function generateTimestamp(
    format: TimestampFormat
): string | number {

    if (format === "unix") {
        return Math.floor(Date.now() / 1000);
    }

    if (format === "unix-ms") {
        return Date.now();
    }

    return new Date().toISOString();
}
