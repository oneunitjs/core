import { describe, it, expect, beforeEach } from "vitest";
import { createCookieStore, createCookieStoreFromAdapter } from "../../src/cookie/index.js";
import { createExpressCookieAdapter } from "../../src/adapters/cookie/express.js";
import { createKoaCookieAdapter } from "../../src/adapters/cookie/koa.js";
import { createFastifyCookieAdapter } from "../../src/adapters/cookie/fastify.js";
import { createHttpCookieAdapter } from "../../src/adapters/cookie/http.js";

describe("Cookie Store - Signed Cookies", () => {
    let store: ReturnType<typeof createCookieStore>;

    beforeEach(() => {
        store = createCookieStore({ secret: "test-secret-123" });
    });

    it("GIVEN a cookie store WITH a secret WHEN signing a value THEN it should verify the same value", () => {
        store.setSigned("session", "user-data");
        expect(store.getSigned("session")).toBe("user-data");
        expect(store.has("session")).toBe(true);
    });

    it("GIVEN a signed cookie WHEN the value is tampered THEN validation should fail", () => {
        store.setSigned("session", "legitimate-data");
        const entry = store["store"].get("session");
        const tamperedValue = entry.value.replace("legitimate", "tampered");
        store["store"].set("session", { ...entry, value: tamperedValue });

        expect(store.getSigned("session")).toBeUndefined();
    });

    it("GIVEN a cookie store WITH fallback secrets WHEN signing with a fallback THEN verification should succeed", () => {
        const store = createCookieStore({
            secret: "primary-secret",
            secrets: ["fallback-secret-1", "fallback-secret-2"],
        });
        store.setSigned("session", "data-with-fallback", { secret: "fallback-secret-1" });

        expect(store.getSigned("session")).toBe("data-with-fallback");
    });

    it("GIVEN an unsigned cookie WHEN accessed as signed THEN it should return undefined", () => {
        store.set("plain", "plain-value");
        expect(store.getSigned("plain")).toBeUndefined();
    });
});

describe("Cookie Store - Encrypted Cookies", () => {
    let store: ReturnType<typeof createCookieStore>;

    beforeEach(() => {
        store = createCookieStore({ secret: "enc-secret-456", encrypted: true });
    });

    it("GIVEN an encrypted cookie WHEN decrypting THEN it should return the original value", () => {
        store.setEncrypted("secret", "sensitive-data");
        expect(store.getEncrypted("secret")).toBe("sensitive-data");
    });

    it("GIVEN an encrypted cookie WHEN the ciphertext is tampered THEN decryption should return null", () => {
        store.setEncrypted("session", "original-data");
        const entry = store["store"].get("session");
        const parts = entry.value.split(":");
        parts[2] = "00000000000000000000000000000000";
        store["store"].set("session", { ...entry, value: parts.join(":") });

        expect(store.getEncrypted("session")).toBeNull();
    });

    it("GIVEN an encrypted cookie WHEN the auth tag is tampered THEN decryption should return null", () => {
        store.setEncrypted("session", "original-data");
        const entry = store["store"].get("session");
        const parts = entry.value.split(":");
        parts[3] = "00000000000000000000000000000000";
        store["store"].set("session", { ...entry, value: parts.join(":") });

        expect(store.getEncrypted("session")).toBeNull();
    });

    it("GIVEN a cookie store WITH fallback secrets WHEN decrypting with a fallback secret THEN it should succeed", () => {
        const store = createCookieStore({
            secret: "primary-enc-secret",
            secrets: ["fallback-enc-1", "fallback-enc-2"],
            encrypted: true,
        });
        store.setEncrypted("session", "fallback-data", { secret: "fallback-enc-1" });

        expect(store.getEncrypted("session")).toBe("fallback-data");
    });

    it("GIVEN a non-existent encrypted cookie WHEN decrypting THEN it should return null", () => {
        expect(store.getEncrypted("non-existent")).toBeNull();
    });
});

describe("Cookie Store - Security Prefixes", () => {
    let store: ReturnType<typeof createCookieStore>;

    beforeEach(() => {
        store = createCookieStore({ secret: "prefix-secret" });
    });

    it("GIVEN a __Secure- prefixed cookie WITHOUT Secure attribute THEN serialization should throw", () => {
        expect(() => {
            store.serialize("__Secure-session", "val", { secure: false });
        }).toThrow(/requires Secure/);
    });

    it("GIVEN a __Host- prefixed cookie WITHOUT Secure attribute THEN serialization should throw", () => {
        expect(() => {
            store.serialize("__Host-session", "val", { secure: false, path: "/" });
        }).toThrow(/requires Secure/);
    });

    it("GIVEN a __Host- prefixed cookie WITH wrong path THEN serialization should throw", () => {
        expect(() => {
            store.serialize("__Host-session", "val", { secure: true, path: "/app" });
        }).toThrow(/Path=\//);
    });

    it("GIVEN a __Host- prefixed cookie WITH domain THEN serialization should throw", () => {
        expect(() => {
            store.serialize("__Host-session", "val", {
                secure: true,
                path: "/",
                domain: "example.com",
            });
        }).toThrow(/must not have Domain/);
    });

    it("GIVEN a __Host- prefixed cookie WITH correct attributes THEN serialization should succeed", () => {
        const serialized = store.serialize("__Host-session", "val", {
            secure: true,
            path: "/",
        });
        expect(serialized).toContain("__Host-session=");
        expect(serialized).toContain("Secure");
        expect(serialized).toContain("Path=/");
        expect(serialized).not.toContain("Domain");
    });

    it("GIVEN a cookie with SameSite=None WITHOUT Secure attribute THEN serialization should throw", () => {
        expect(() => {
            store.serialize("session", "val", { sameSite: "none", secure: false });
        }).toThrow(/SameSite=None requires Secure/);
    });
});

describe("Cookie Store - Secure Defaults", () => {
    it("GIVEN non-production environment WHEN serializing a cookie THEN Secure should not be added by default", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "test";
        try {
            const store = createCookieStore({ secret: "test" });
            const serialized = store.serialize("session", "val", {});
            expect(serialized).not.toContain("Secure");
        } finally {
            process.env.NODE_ENV = originalEnv;
        }
    });

    it("GIVEN production environment WHEN serializing a cookie THEN Secure should be added by default", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        try {
            const store = createCookieStore({ secret: "test" });
            const serialized = store.serialize("session", "val", {});
            expect(serialized).toContain("Secure");
        } finally {
            process.env.NODE_ENV = originalEnv;
        }
    });
});

describe("Cookie Store - Adapters", () => {
    it("GIVEN an Express request WITH cookies WHEN reading THEN it should return the cookie value", () => {
        const req: any = { headers: { cookie: "session=abc123" } };
        const res: any = {
            setHeader: (name: string, value: string) => {
                res[name] = value;
            },
        };
        const adapter = createExpressCookieAdapter(req, res);
        const store = createCookieStoreFromAdapter(adapter, { secret: "test" });

        expect(store.get("session")).toBe("abc123");
    });

    it("GIVEN a Koa context WITH cookies WHEN reading THEN it should return the cookie value", () => {
        const ctx: any = {
            cookies: {
                get: (name: string) => (name === "session" ? "koa-value" : undefined),
                set: (name: string, value: string, options?: Record<string, unknown>) => {
                    ctx.cookies[name] = { value, options };
                },
            },
        };
        const adapter = createKoaCookieAdapter(ctx);
        const store = createCookieStoreFromAdapter(adapter, { secret: "test" });

        expect(store.get("session")).toBe("koa-value");
    });

    it("GIVEN a Fastify request WITH cookies WHEN reading THEN it should return the cookie value", () => {
        const req: any = { cookies: { session: "fastify-value" } };
        const reply: any = {
            setCookie: (name: string, value: string, options?: Record<string, unknown>) => {
                reply[name] = { value, options };
            },
            unsetCookie: (name: string, options?: Record<string, unknown>) => {
                delete reply[name];
            },
        };
        const adapter = createFastifyCookieAdapter(req, reply);
        const store = createCookieStoreFromAdapter(adapter, { secret: "test" });

        expect(store.get("session")).toBe("fastify-value");
    });

    it("GIVEN an HTTP request WITH cookies WHEN reading THEN it should return the cookie value", () => {
        const req: any = { headers: { cookie: "http-value=test" } };
        const res: any = {
            setHeader: (name: string, value: string) => {
                res[name] = value;
            },
        };
        const adapter = createHttpCookieAdapter(req, res);
        const store = createCookieStoreFromAdapter(adapter, { secret: "test" });

        expect(store.get("http-value")).toBe("test");
    });
});

describe("Cookie Store - Invalid Names", () => {
    let store: ReturnType<typeof createCookieStore>;

    beforeEach(() => {
        store = createCookieStore({ secret: "test" });
    });

    it("GIVEN a cookie name WITH invalid characters THEN serialization should throw", () => {
        const invalidNames = ["bad name", "bad=name", "bad;name", ""];
        for (const name of invalidNames) {
            expect(() => {
                store.serialize(name, "val", {});
            }).toThrow(/Invalid cookie name/);
        }
    });
});
