import { describe, it, expect } from "vitest";
import {
    createCookieStore,
    createCookieStoreFromAdapter,
    createExpressCookieAdapter,
    createFastifyCookieAdapter,
    createKoaCookieAdapter,
    createHttpCookieAdapter,
    detectCookieFramework,
    createDetectedCookieStore,
    DEFAULT_COOKIE_CONFIG,
    mergeCookieOptions,
    type CookieStore,
    type CookieFramework,
    type DetectedCookieFramework,
} from "../../src/cookie/index.js";

describe("createCookieStore", () => {
    it("creates an empty cookie store", () => {
        const store = createCookieStore();
        expect(store.all()).toEqual({});
        expect(store.has("session")).toBe(false);
    });

    it("sets and gets a cookie", () => {
        const store = createCookieStore();
        store.set("session", "abc123", { httpOnly: true, secure: true });

        expect(store.get("session")).toBe("abc123");
        expect(store.has("session")).toBe(true);
    });

    it("deletes a cookie", () => {
        const store = createCookieStore();
        store.set("session", "abc123");
        expect(store.has("session")).toBe(true);

        store.delete("session");
        expect(store.has("session")).toBe(false);
        expect(store.get("session")).toBeUndefined();
    });

    it("clears all cookies", () => {
        const store = createCookieStore();
        store.set("a", "1");
        store.set("b", "2");
        expect(store.all()).toEqual({ a: "1", b: "2" });

        store.clear();
        expect(store.all()).toEqual({});
    });

    it("is chainable", () => {
        const store = createCookieStore();
        const result = store.set("a", "1").set("b", "2").delete("a");
        expect(result).toBe(store);
    });

    it("serializes to Set-Cookie header string", () => {
        const store = createCookieStore();
        const serialized = store.serialize("session", "abc123", {
            httpOnly: true,
            secure: true,
            path: "/",
            maxAge: 3600,
        });

        expect(serialized).toContain("session=abc123");
        expect(serialized).toContain("HttpOnly");
        expect(serialized).toContain("Secure");
        expect(serialized).toContain("Path=/");
        expect(serialized).toContain("Max-Age=3600");
    });

    it("parses Cookie header string", () => {
        const store = createCookieStore();
        const parsed = store.parse("session=abc123; theme=dark");

        expect(parsed.session).toBe("abc123");
        expect(parsed.theme).toBe("dark");
    });

    it("applies default config options", () => {
        const store = createCookieStore({
            path: "/app",
            secure: true,
            httpOnly: true,
            sameSite: "strict",
            maxAge: 7200,
        });

        const serialized = store.serialize("session", "abc123");
        expect(serialized).toContain("Path=/app");
        expect(serialized).toContain("Secure");
        expect(serialized).toContain("HttpOnly");
        expect(serialized).toContain("SameSite=Strict");
        expect(serialized).toContain("Max-Age=7200");
    });
});

describe("DEFAULT_COOKIE_CONFIG", () => {
    it("has sensible defaults", () => {
        expect(DEFAULT_COOKIE_CONFIG.path).toBe("/");
        expect(DEFAULT_COOKIE_CONFIG.secure).toBeUndefined();
        expect(DEFAULT_COOKIE_CONFIG.httpOnly).toBe(true);
        expect(DEFAULT_COOKIE_CONFIG.sameSite).toBe("lax");
        expect(DEFAULT_COOKIE_CONFIG.maxAge).toBe(0);
    });
});

describe("mergeCookieOptions", () => {
    it("merges overrides with defaults", () => {
        const result = mergeCookieOptions(
            { path: "/", secure: true, httpOnly: true, sameSite: "lax", maxAge: 3600, signed: false },
            { path: "/api", httpOnly: false }
        );
        expect(result.path).toBe("/api");
        expect(result.secure).toBe(true);
        expect(result.httpOnly).toBe(false);
        expect(result.sameSite).toBe("lax");
        expect(result.maxAge).toBe(3600);
    });
});

describe("createExpressCookieAdapter", () => {
    it("works with Express req/res", () => {
        let setCookieHeader: string | undefined;
        const req: any = { headers: { cookie: "session=abc123; theme=dark" } };
        const res: any = {
            setHeader: (name: string, value: string) => {
                setCookieHeader = value;
            },
            getHeader: () => undefined,
        };

        const adapter = createExpressCookieAdapter(req, res);
        const store = createCookieStoreFromAdapter(adapter);

        expect(store.get("session")).toBe("abc123");
        expect(store.get("theme")).toBe("dark");
        expect(store.all()).toEqual({ session: "abc123", theme: "dark" });

        store.set("newcookie", "xyz", { httpOnly: true, path: "/" });
        expect(setCookieHeader).toContain("newcookie=xyz");
        expect(setCookieHeader).toContain("HttpOnly");
        expect(setCookieHeader).toContain("Path=/");
    });
});

describe("createFastifyCookieAdapter", () => {
    it("works with Fastify req/reply", () => {
        let setCookieCalled = false;
        let unsetCookieCalled = false;
        const req: any = { cookies: { session: "abc123" } };
        const reply: any = {
            setCookie: () => { setCookieCalled = true; },
            unsetCookie: () => { unsetCookieCalled = true; },
        };

        const adapter = createFastifyCookieAdapter(req, reply);
        const store = createCookieStoreFromAdapter(adapter);

        expect(store.get("session")).toBe("abc123");
        expect(store.has("session")).toBe(true);

        store.set("newcookie", "xyz");
        expect(setCookieCalled).toBe(true);

        store.delete("session");
        expect(unsetCookieCalled).toBe(true);
    });
});

describe("createKoaCookieAdapter", () => {
    it("works with Koa ctx", () => {
        let setCookieCalled = false;
        const ctx: any = {
            cookies: {
                get: (name: string) => (name === "session" ? "abc123" : undefined),
                set: () => { setCookieCalled = true; },
            },
        };

        const adapter = createKoaCookieAdapter(ctx);
        const store = createCookieStoreFromAdapter(adapter);

        expect(store.get("session")).toBe("abc123");
        expect(store.has("session")).toBe(true);

        store.set("newcookie", "xyz");
        expect(setCookieCalled).toBe(true);
    });
});

describe("createHttpCookieAdapter", () => {
    it("works with node:http req/res", () => {
        let setCookieHeader: string | undefined;
        const req: any = { headers: { cookie: "session=abc123" } };
        const res: any = {
            setHeader: (name: string, value: string) => {
                setCookieHeader = value;
            },
        };

        const adapter = createHttpCookieAdapter(req, res);
        const store = createCookieStoreFromAdapter(adapter);

        expect(store.get("session")).toBe("abc123");

        store.set("newcookie", "xyz");
        expect(setCookieHeader).toContain("newcookie=xyz");
    });
});

describe("detectCookieFramework", () => {
    it("detects Koa", () => {
        const ctx: any = { cookies: { get: () => undefined } };
        const result = detectCookieFramework(undefined, undefined, ctx);
        expect(result.framework).toBe("koa");
        expect(result.confidence).toBe("high");
    });

    it("detects Express", () => {
        const req: any = { headers: { cookie: "a=b" } };
        const res: any = { setHeader: () => {} };
        const result = detectCookieFramework(req, res);
        expect(result.framework).toBe("express");
        expect(result.confidence).toBe("high");
    });

    it("detects http", () => {
        const res: any = { setHeader: () => {} };
        const result = detectCookieFramework(undefined, res);
        expect(result.framework).toBe("http");
        expect(result.confidence).toBe("low");
    });

    it("returns unknown when nothing matches", () => {
        const result = detectCookieFramework();
        expect(result.framework).toBe("unknown");
        expect(result.confidence).toBe("low");
    });
});

describe("createDetectedCookieStore", () => {
    it("creates a Koa store when ctx is provided", () => {
        const ctx: any = {
            cookies: {
                get: (name: string) => (name === "session" ? "abc123" : undefined),
                set: () => {},
            },
        };
        const store = createDetectedCookieStore(undefined, undefined, ctx);
        expect(store.get("session")).toBe("abc123");
    });

    it("creates an Express store when req/res provided", () => {
        let setHeader: string | undefined;
        const req: any = { headers: { cookie: "session=abc123" } };
        const res: any = { setHeader: (n: string, v: string) => { setHeader = v; } };
        const store = createDetectedCookieStore(req, res);
        expect(store.get("session")).toBe("abc123");
    });

    it("falls back to plain store when nothing detected", () => {
        const store = createDetectedCookieStore();
        expect(store.set("a", "1")).toBe(store);
        expect(store.get("a")).toBe("1");
    });
});

describe("stateless cross-request (adapter-backed)", () => {
    function setup() {
        let header: string | undefined = undefined;
        const req: any = { headers: { cookie: "" } };
        const res: any = {
            setHeader: (name: string, value: string) => {
                if (name === "Set-Cookie") header = value;
            },
            getHeader: () => undefined,
        };
        return { req, res, getHeader: () => header };
    }

    it("verifies a signed cookie from payload alone on a new store instance", () => {
        const { req, res, getHeader } = setup();

        const storeA = createCookieStoreFromAdapter(createExpressCookieAdapter(req, res), { secret: "my-secret", signed: true });
        storeA.setSigned("session", "user-123");

        req.headers.cookie = getHeader();

        const storeB = createCookieStoreFromAdapter(createExpressCookieAdapter(req, res), { secret: "my-secret", signed: true });
        expect(storeB.getSigned("session")).toBe("user-123");
    });

    it("decrypts an encrypted cookie from payload alone on a new store instance", () => {
        const { req, res, getHeader } = setup();

        const storeA = createCookieStoreFromAdapter(createExpressCookieAdapter(req, res), { secret: "my-secret", encrypted: true });
        storeA.setEncrypted("session", "sensitive-data");

        req.headers.cookie = getHeader();

        const storeB = createCookieStoreFromAdapter(createExpressCookieAdapter(req, res), { secret: "my-secret", encrypted: true });
        expect(storeB.getEncrypted("session")).toBe("sensitive-data");
    });

    it("returns undefined for a tampered signed cookie on a stateless store", () => {
        const { req, res, getHeader } = setup();

        const storeA = createCookieStoreFromAdapter(createExpressCookieAdapter(req, res), { secret: "my-secret", signed: true });
        storeA.setSigned("session", "user-123");

        req.headers.cookie = getHeader()!.replace("user-123", "user-999");

        const storeB = createCookieStoreFromAdapter(createExpressCookieAdapter(req, res), { secret: "my-secret", signed: true });
        expect(storeB.getSigned("session")).toBeUndefined();
    });
});
