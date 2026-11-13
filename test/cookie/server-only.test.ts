import { describe, it, expect } from "vitest";
import { createCookieStore } from "../../src/cookie/registery.js";

describe("server-only signed cookies", () => {
    it("signs and verifies a cookie with secret", () => {
        const store = createCookieStore({ secret: "my-secret", signed: true });
        store.setSigned("session", "user-123");

        const val = store.getSigned("session");
        expect(val).toBe("user-123");
        expect(store.has("session")).toBe(true);
    });

    it("returns undefined for tampered signed cookie", () => {
        const store = createCookieStore({ secret: "my-secret", signed: true });
        store.setSigned("session", "user-123");

        // Tamper with the stored value
        const entry = store["store"].get("session");
        store["store"].set("session", { ...entry, value: entry.value.replace("user-123", "user-999") });

        const val = store.getSigned("session");
        expect(val).toBeUndefined();
    });

    it("returns raw value when store is not configured with signed", () => {
        const store = createCookieStore({ secret: "my-secret" }); // no signed: true
        store.set("session", "user-123"); // not signed

        // getSigned only returns value if entry was signed
        const val = store.getSigned("session");
        expect(val).toBeUndefined();
        // But get() returns the raw value
        const raw = store.get("session");
        expect(raw).toBe("user-123");
    });

    it("signed cookie sets httpOnly, secure, sameSite=strict", () => {
        const store = createCookieStore({ secret: "my-secret", signed: true });
        const serialized = store.serialize("session", "user-123", {
            signed: true,
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        });

        expect(serialized).toContain("session=");
        expect(serialized).toContain("HttpOnly");
        expect(serialized).toContain("Secure");
        expect(serialized).toContain("SameSite=Strict");
    });

    it("auto-signs when signed: true in config", () => {
        const store = createCookieStore({ secret: "my-secret", signed: true });
        store.set("session", "user-123"); // auto-signed because config has signed: true

        const val = store.getSigned("session");
        expect(val).toBe("user-123");
    });

    it("mixed cookie types from same config", () => {
        const store = createCookieStore({ secret: "my-secret" });

        // Plain cookie
        store.set("plain", "hello");
        // Signed cookie
        store.setSigned("session", "user-123");
        // Encrypted cookie
        store.setEncrypted("secret", "sensitive");

        expect(store.get("plain")).toBe("hello");
        expect(store.getSigned("session")).toBe("user-123");
        expect(store.getEncrypted("secret")).toBe("sensitive");
        expect(store.all()).toEqual({ plain: "hello", session: "user-123", secret: "sensitive" });
    });
});

describe("server-only encrypted cookies", () => {
    it("encrypts and decrypts a cookie with secret", () => {
        const store = createCookieStore({ secret: "my-enc-secret", encrypted: true });
        store.setEncrypted("session", "sensitive-data");

        const val = store.getEncrypted("session");
        expect(val).toBe("sensitive-data");
        expect(store.has("session")).toBe(true);
    });

    it("returns different value for tampered encrypted cookie", () => {
        const store = createCookieStore({ secret: "my-enc-secret", encrypted: true });
        store.setEncrypted("session", "sensitive-data");

        // Tamper with the IV part of the encrypted value
        const entry = store["store"].get("session");
        const parts = entry.value.split(":");
        parts[1] = "00000000000000000000000000000000"; // Zero out the IV
        store["store"].set("session", { ...entry, value: parts.join(":") });

        const val = store.getEncrypted("session");
        expect(val).not.toBe("sensitive-data");
    });

    it("encrypted cookie data is not readable as plaintext", () => {
        const store = createCookieStore({ secret: "my-enc-secret", encrypted: true });
        store.setEncrypted("secret", "my-secret-value");

        const raw = store["store"].get("secret");
        expect(raw.value).not.toBe("my-secret-value");
        expect(raw.value).not.toContain("my-secret-value");
    });

    it("encrypted cookie sets httpOnly, secure, sameSite=strict", () => {
        const store = createCookieStore({ secret: "my-enc-secret", encrypted: true });
        const serialized = store.serialize("session", "data", {
            encrypted: true,
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        });

        expect(serialized).toContain("session=");
        expect(serialized).toContain("HttpOnly");
        expect(serialized).toContain("Secure");
        expect(serialized).toContain("SameSite=Strict");
    });

    it("all() returns decrypted values for encrypted cookies", () => {
        const store = createCookieStore({ secret: "my-enc-secret", encrypted: true });
        store.setEncrypted("a", "value-a");
        store.setEncrypted("b", "value-b");

        const all = store.all();
        expect(all.a).toBe("value-a");
        expect(all.b).toBe("value-b");
    });
});

describe("server-only cookie with framework adapters", () => {
    it("works with express adapter", () => {
        let setHeader: string | undefined;
        const req: any = { headers: {} };
        const res: any = {
            setHeader: (name: string, value: string) => {
                setHeader = value;
            },
        };

        const store = createCookieStore({ secret: "secret", signed: true });
        store.setSigned("session", "user-123");

        const serialized = store.serialize("session", "user-123", {
            signed: true,
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        });
        res.setHeader("Set-Cookie", serialized);

        expect(setHeader).toContain("session=");
        expect(setHeader).toContain("HttpOnly");
        expect(setHeader).toContain("Secure");
        expect(setHeader).toContain("SameSite=Strict");
    });
});

describe("server-only cookie options", () => {
    it("defaults signed to false", () => {
        const store = createCookieStore({ secret: "test" });
        store.set("session", "val");
        expect(store.get("session")).toBe("val"); // no signature verification
    });

    it("works with custom secret per call", () => {
        const store = createCookieStore();
        store.setSigned("session", "data", { secret: "per-call-secret" });
        // Can verify with same secret
        const val = store.getSigned("session");
        expect(val).toBe("data");
    });

    describe("secure defaults", () => {
        it("defaults secure to false in non-production", () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "test";
            try {
                // Need to re-import to pick up new default, but DEFAULT_COOKIE_CONFIG is evaluated at import time
                // Instead test via serialize behavior
                const store = createCookieStore({ secret: "test" });
                const serialized = store.serialize("session", "val", {});
                // In non-production, secure should not be added unless explicitly set
                expect(serialized).not.toContain("Secure");
            } finally {
                process.env.NODE_ENV = originalEnv;
            }
        });

        it("defaults secure to true in production", () => {
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

    describe("cookie prefix enforcement", () => {
        it("__Secure- prefix requires Secure attribute", () => {
            const store = createCookieStore({ secret: "test" });
            expect(() => {
                store.serialize("__Secure-session", "val", { secure: false });
            }).toThrow(/requires Secure/);
        });

        it("__Secure- prefix works with Secure attribute", () => {
            const store = createCookieStore({ secret: "test" });
            const serialized = store.serialize("__Secure-session", "val", { secure: true });
            expect(serialized).toContain("__Secure-session=");
            expect(serialized).toContain("Secure");
        });

        it("__Host- prefix requires Secure, Path=/, and no Domain", () => {
            const store = createCookieStore({ secret: "test" });

            // Missing Secure
            expect(() => {
                store.serialize("__Host-session", "val", { secure: false, path: "/" });
            }).toThrow(/requires Secure/);

            // Wrong path
            expect(() => {
                store.serialize("__Host-session", "val", { secure: true, path: "/app" });
            }).toThrow(/Path=\//);

            // Has domain
            expect(() => {
                store.serialize("__Host-session", "val", { secure: true, path: "/", domain: "example.com" });
            }).toThrow(/must not have Domain/);
        });

        it("__Host- prefix works with correct attributes", () => {
            const store = createCookieStore({ secret: "test" });
            const serialized = store.serialize("__Host-session", "val", {
                secure: true,
                path: "/",
            });
            expect(serialized).toContain("__Host-session=");
            expect(serialized).toContain("Secure");
            expect(serialized).toContain("Path=/");
            expect(serialized).not.toContain("Domain");
        });

        it("SameSite=None requires Secure", () => {
            const store = createCookieStore({ secret: "test" });
            expect(() => {
                store.serialize("session", "val", { sameSite: "none", secure: false });
            }).toThrow(/SameSite=None requires Secure/);
        });
    });

    describe("AES-256-GCM encrypted format", () => {
        it("encrypted value contains auth tag (4 colon-separated parts)", () => {
            const store = createCookieStore({ secret: "my-enc-secret", encrypted: true });
            store.setEncrypted("session", "sensitive-data");

            const entry = store["store"].get("session");
            const parts = entry.value.split(":");
            expect(parts).toHaveLength(4);
            // parts: [salt, iv, ciphertext, authTag]
            expect(parts[0].length).toBe(32); // 16 bytes salt as hex
            expect(parts[1].length).toBe(24); // 12 bytes IV as hex
            expect(parts[3].length).toBe(32); // 16 bytes auth tag as hex
        });

        it("tampering with ciphertext fails decryption", () => {
            const store = createCookieStore({ secret: "my-enc-secret", encrypted: true });
            store.setEncrypted("session", "sensitive-data");

            const entry = store["store"].get("session");
            const parts = entry.value.split(":");
            parts[2] = "00000000000000000000000000000000"; // Tamper ciphertext
            store["store"].set("session", { ...entry, value: parts.join(":") });

            const val = store.getEncrypted("session");
            expect(val).toBeNull();
        });

        it("tampering with auth tag fails decryption", () => {
            const store = createCookieStore({ secret: "my-enc-secret", encrypted: true });
            store.setEncrypted("session", "sensitive-data");

            const entry = store["store"].get("session");
            const parts = entry.value.split(":");
            parts[3] = "00000000000000000000000000000000"; // Tamper auth tag
            store["store"].set("session", { ...entry, value: parts.join(":") });

            const val = store.getEncrypted("session");
            expect(val).toBeNull();
        });
    });
});
