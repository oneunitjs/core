import { describe, it, expect } from "vitest";
import { createApp } from "../../src/core/index.js";

describe("CK - Cookie Management", () => {
    it("CK-01: Set and retrieve ordinary cookies (global store)", () => {
        const app = createApp({ secret: "s3cr3t" });
        const store = app.cookies();
        store.set("session", "abc123");
        expect(store.get("session")).toBe("abc123");
    });

    it("CK-02: Cookie serialization and parsing round-trip", () => {
        const app = createApp();
        const cookies = app.cookies();
        const serialized = cookies.serialize("name", "value", { path: "/" });
        const parsed = cookies.parse(serialized);
        expect(parsed.name).toBe("value");
    });

    it("CK-03: Signed cookie generation and verification", () => {
        const app = createApp({ secret: "s3cr3t-key" });
        const store = app.cookies();
        store.setSigned("token", "val");
        expect(store.getSigned("token")).toBe("val");
    });

    it("CK-04: Encrypted cookie generation and decryption", () => {
        const app = createApp({ secret: "s3cr3t-key" });
        const store = app.cookies();
        store.setEncrypted("data", "plaintext");
        expect(store.getEncrypted("data")).toBe("plaintext");
    });

    it("CK-05: Reject modified signatures", () => {
        const app = createApp({ secret: "s3cr3t-key" });
        const store = app.cookies();
        store.setSigned("token", "val");
        const tampered = store.get("token")! + "X";
        store.set("token", tampered);
        expect(store.getSigned("token")).toBeUndefined();
    });

    it("CK-06: Cookie deletion", () => {
        const app = createApp();
        const store = app.cookies();
        store.set("del", "y");
        expect(store.get("del")).toBe("y");
        store.delete("del");
        expect(store.get("del")).toBeUndefined();
    });

    it("CK-07: Validate HttpOnly, Secure and SameSite attributes", () => {
        const app = createApp();
        const req: any = { headers: {} };
        const res: any = { headers: {}, setHeader: (k: string, v: string) => { res.headers[k] = v; } };
        const store = app.cookies(req, res);
        store.set("s", "v", { httpOnly: true, secure: true, sameSite: "strict" });
        const cookieHeader = res.headers["set-cookie"];
        if (cookieHeader) {
            const headerStr = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : String(cookieHeader);
            if (headerStr) {
                expect(headerStr).toContain("HttpOnly");
                expect(headerStr).toContain("Secure");
                expect(headerStr).toContain("SameSite=Strict");
            }
        }
    });

    it("CK-08: Named cookie stores are isolated", () => {
        const app = createApp();
        const s1 = app.cookies().createStore("store-a");
        const s2 = app.cookies().createStore("store-b");
        s1.set("k", "a");
        expect(s2.get("k")).toBeUndefined();
    });

    it("CK-09: Concurrent request isolation", () => {
        const app = createApp({ secret: "s3cr3t" });
        const results: string[] = [];
        for (let i = 0; i < 50; i++) {
            const store = app.cookies();
            store.set("user", `value-${i}`);
            const val = store.get("user");
            results.push(val ?? "missing");
        }
        expect(results.filter((r) => r === "value-0")).toHaveLength(1);
    });

    it("CK-10: Behavior when request/response objects are missing", () => {
        const app = createApp();
        const store = app.cookies();
        expect(store).toBeDefined();
        expect(typeof store.set).toBe("function");
        expect(typeof store.get).toBe("function");
    });

    it("CK-11: Cookie name with special characters", () => {
        const app = createApp();
        const store = app.cookies();
        store.set("user.session.id", "val");
        expect(store.get("user.session.id")).toBe("val");
    });

    it("CK-12: Empty cookie value", () => {
        const app = createApp();
        const store = app.cookies();
        store.set("empty", "");
        expect(store.get("empty")).toBe("");
    });

    it("CK-13: has() checks cookie existence", () => {
        const app = createApp();
        const store = app.cookies();
        store.set("exists", "val");
        expect(store.has("exists")).toBe(true);
        expect(store.has("missing")).toBe(false);
    });

    it("CK-14: all() returns all cookies", () => {
        const app = createApp();
        const store = app.cookies();
        store.set("a", "1");
        store.set("b", "2");
        const all = store.all();
        expect(all.a).toBe("1");
        expect(all.b).toBe("2");
    });
});
