/**
 * Adapter Registry for centralized adapter discovery and management.
 *
 * Provides a registry pattern for looking up adapters by name and framework,
 * tracking initialization state, and managing adapter lifecycle.
 */
import type {
    AdapterEntry,
    AdapterRegistrationResult,
    BaseAdapter,
    FrameworkName,
} from "./types.js";

export class AdapterRegistry {
    private readonly adapters: Map<string, AdapterEntry> = new Map();

    /**
     * Register an adapter instance.
     */
    register<AdapterType extends BaseAdapter>(
        adapter: AdapterType,
    ): AdapterRegistrationResult {
        const key = `${adapter.framework}:${adapter.name}`;

        if (this.adapters.has(key)) {
            return {
                success: false,
                adapterName: adapter.name,
                framework: adapter.framework,
                error: `Adapter "${adapter.name}" already registered for framework "${adapter.framework}"`,
            };
        }

        const entry: AdapterEntry<AdapterType> = {
            name: adapter.name,
            framework: adapter.framework,
            adapter,
            registeredAt: Date.now(),
        };

        this.adapters.set(key, entry);

        return {
            success: true,
            adapterName: adapter.name,
            framework: adapter.framework,
        };
    }

    /**
     * Get an adapter by name and framework.
     */
    get<AdapterType extends BaseAdapter = BaseAdapter>(
        name: string,
        framework: FrameworkName,
    ): AdapterType | undefined {
        const key = `${framework}:${name}`;
        const entry = this.adapters.get(key);
        return entry?.adapter as AdapterType | undefined;
    }

    /**
     * Get all registered adapters.
     */
    getAll(): AdapterEntry[] {
        return Array.from(this.adapters.values());
    }

    /**
     * Get all adapters for a specific framework.
     */
    getByFramework(framework: FrameworkName): AdapterEntry[] {
        return Array.from(this.adapters.values()).filter(
            (entry) => entry.framework === framework,
        );
    }

    /**
     * Check if an adapter exists.
     */
    has(name: string, framework: FrameworkName): boolean {
        const key = `${framework}:${name}`;
        return this.adapters.has(key);
    }

    /**
     * Remove an adapter from the registry.
     */
    remove(name: string, framework: FrameworkName): boolean {
        const key = `${framework}:${name}`;
        const entry = this.adapters.get(key);
        if (!entry) return false;

        entry.adapter.dispose();
        return this.adapters.delete(key);
    }

    /**
     * Initialize all registered adapters.
     */
    initializeAll(): void {
        for (const entry of this.adapters.values()) {
            if (!entry.adapter.initialized) {
                entry.adapter.initialize();
            }
        }
    }

    /**
     * Dispose all registered adapters.
     */
    disposeAll(): void {
        for (const entry of this.adapters.values()) {
            entry.adapter.dispose();
        }
        this.adapters.clear();
    }

    /**
     * Get the count of registered adapters.
     */
    get count(): number {
        return this.adapters.size;
    }
}

export const defaultAdapterRegistry = new AdapterRegistry();
