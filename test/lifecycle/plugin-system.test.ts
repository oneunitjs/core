import { describe, it, expect } from "vitest";
import { PluginSystem } from "../../src/lifecycle/plugin-system.js";
import type { LifecycleOptions } from "../../src/lifecycle/types.js";

const baseOptions: LifecycleOptions = {
    mode: "advanced",
    maxMiddleware: 10,
    maxPlugins: 10,
    executionTimeoutMs: 1000,
    throwOnError: false,
};

describe("PluginSystem", () => {
    it("registers plugin successfully", () => {
        const system = new PluginSystem(baseOptions);
        const hooks = {
            request: [async (_ctx: unknown) => {}],
        };

        const result = system.register("auth-plugin", "security", hooks);
        expect(result.success).toBe(true);
        expect(result.conflicts).toEqual([]);
        expect(system.has("auth-plugin", "security")).toBe(true);
        expect(system.size()).toBe(1);
    });

    it("detects duplicate plugin in same namespace", () => {
        const system = new PluginSystem(baseOptions);
        const hooks = { request: [async () => {}] };

        system.register("auth-plugin", "security", hooks);
        const result = system.register("auth-plugin", "security", hooks);

        expect(result.success).toBe(false);
        expect(result.conflicts[0].type).toBe("plugin");
        expect(result.conflicts[0].severity).toBe("error");
    });

    it("allows same plugin name in different namespaces", () => {
        const system = new PluginSystem(baseOptions);
        const hooks = { request: [async () => {}] };

        system.register("auth-plugin", "security", hooks);
        const result = system.register("auth-plugin", "logging", hooks);

        expect(result.success).toBe(true);
        expect(system.getNamespaces()).toContain("security");
        expect(system.getNamespaces()).toContain("logging");
    });

    it("enforces max plugins limit", () => {
        const options: LifecycleOptions = { ...baseOptions, maxPlugins: 2 };
        const system = new PluginSystem(options);
        const hooks = { request: [async () => {}] };

        system.register("p1", "ns1", hooks);
        system.register("p2", "ns2", hooks);
        const result = system.register("p3", "ns3", hooks);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Maximum plugin limit");
    });

    it("unregisters plugin", () => {
        const system = new PluginSystem(baseOptions);
        const hooks = { request: [async () => {}] };

        system.register("plugin1", "ns1", hooks);
        expect(system.has("plugin1", "ns1")).toBe(true);

        system.unregister("plugin1", "ns1");
        expect(system.has("plugin1", "ns1")).toBe(false);
        expect(system.size()).toBe(0);
    });

    it("removes namespace when no plugins remain", () => {
        const system = new PluginSystem(baseOptions);
        const hooks = { request: [async () => {}] };

        system.register("plugin1", "ns1", hooks);
        expect(system.getNamespaces()).toContain("ns1");

        system.unregister("plugin1", "ns1");
        expect(system.getNamespaces()).not.toContain("ns1");
    });

    it("lists plugins sorted by priority", () => {
        const system = new PluginSystem(baseOptions);
        const hooks = { request: [async () => {}] };

        system.register("low", "ns1", hooks, { priority: 1 });
        system.register("high", "ns2", hooks, { priority: 10 });

        const list = system.list();
        expect(list[0].name).toBe("high");
        expect(list[1].name).toBe("low");
    });

    it("executes hooks successfully", async () => {
        const system = new PluginSystem(baseOptions);
        const calls: string[] = [];

        system.register("plugin1", "ns1", {
            request: [async (_ctx: unknown) => { calls.push("plugin1"); }],
        });
        system.register("plugin2", "ns2", {
            request: [async (_ctx: unknown) => { calls.push("plugin2"); }],
        });

        const results = await system.executeHook("request", {});

        expect(results.length).toBe(2);
        expect(results.every((r) => r.success)).toBe(true);
        expect(calls).toEqual(["plugin1", "plugin2"]);
    });

    it("executes hook isolated by namespace", async () => {
        const system = new PluginSystem(baseOptions);
        const calls: string[] = [];

        system.register("plugin1", "ns1", {
            request: [async (_ctx: unknown) => { calls.push("plugin1"); }],
        });
        system.register("plugin2", "ns2", {
            request: [async (_ctx: unknown) => { calls.push("plugin2"); }],
        });

        const result = await system.executeHookIsolated("request", {}, "ns1");

        expect(result.success).toBe(true);
        expect(calls).toEqual(["plugin1"]);
    });

    it("handles hook timeout", async () => {
        const options: LifecycleOptions = { ...baseOptions, executionTimeoutMs: 50 };
        const system = new PluginSystem(options);

        system.register("slow-plugin", "ns1", {
            request: [async () => {
                await new Promise((resolve) => setTimeout(resolve, 200));
            }],
        });

        const results = await system.executeHook("request", {});
        expect(results[0].success).toBe(false);
        expect(results[0].error?.message).toContain("timed out");
    });

    it("isolates hook errors when throwOnError is false", async () => {
        const options: LifecycleOptions = { ...baseOptions, throwOnError: false };
        const system = new PluginSystem(options);
        const calls: string[] = [];

        system.register("failing-plugin", "ns1", {
            request: [async () => { throw new Error("plugin error"); }],
        });
        system.register("working-plugin", "ns2", {
            request: [async (_ctx: unknown) => { calls.push("working"); }],
        });

        const results = await system.executeHook("request", {});

        expect(results[0].success).toBe(false);
        expect(results[1].success).toBe(true);
        expect(calls).toEqual(["working"]);
    });

    it("creates plugin context", () => {
        const system = new PluginSystem(baseOptions);
        system.register("my-plugin", "my-ns", { request: [async () => {}] });

        const ctx = system.createContext("my-plugin", "my-ns");
        expect(ctx.name).toBe("my-plugin");
        expect(ctx.namespace).toBe("my-ns");
        expect(typeof ctx.emit).toBe("function");
        expect(typeof ctx.on).toBe("function");
    });

    it("clears all plugins", () => {
        const system = new PluginSystem(baseOptions);
        const hooks = { request: [async () => {}] };

        system.register("p1", "ns1", hooks);
        system.register("p2", "ns2", hooks);
        expect(system.size()).toBe(2);

        system.clear();
        expect(system.size()).toBe(0);
        expect(system.getNamespaces()).toEqual([]);
    });
});
