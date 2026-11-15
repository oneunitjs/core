/**
 * @oneunit/core - Request Context Internal Storage
 *
 * Private AsyncLocalStorage management and store creation for the request
 * context module.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import { generateTimestamp } from "./timestamp.js";

export type ContextStore = Map<string, unknown>;

export interface StoreCreationOptions {

    /** Default values for every new context */
    initialValues: Record<string, unknown>;

    /** Automatically add an initialization timestamp */
    autoTimestamp: boolean;

    /** Name of the timestamp property */
    timestampKey: string;

    /** Timestamp representation */
    timestampFormat: "iso" | "unix" | "unix-ms";
}

export function createStorage(): AsyncLocalStorage<ContextStore> {

    return new AsyncLocalStorage<ContextStore>();
}

export function createStore(
    options: StoreCreationOptions,
    values: Record<string, unknown>
): ContextStore {

    const store = new Map<string, unknown>(
        Object.entries(options.initialValues)
    );

    if (options.autoTimestamp) {

        const timestamp = generateTimestamp(options.timestampFormat);

        store.set(options.timestampKey, timestamp);
    }

    for (const [key, value] of Object.entries(values)) {
        store.set(key, value);
    }

    return store;
}

export function getCurrentStore(
    storage: AsyncLocalStorage<ContextStore>
): ContextStore | undefined {

    return storage.getStore();
}
