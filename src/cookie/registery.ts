import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { parseCookie } from "cookie";
import type {
    CookieOptions,
    CookieConfig,
    CookieAdapter,
    CookieStore,
    CookieEntry,
    DetectedCookieFramework,
    ServerOnlyCookieOptions,
} from "./types.js";
import { DEFAULT_COOKIE_CONFIG, mergeCookieOptions } from "./configs.js";
import { createExpressCookieAdapter } from "./adapters/express.js";
import { createKoaCookieAdapter } from "./adapters/koa.js";
import { createHttpCookieAdapter } from "./adapters/http.js";
import {
    CookieSecretRequiredError,
    CookieSecurePrefixError,
} from "../errors/cookie.js";
import {
    serializeCookieString,
    validateCookieName,
} from "./cookie-utils.js";

const GCM_IV_LENGTH = 12;

function deriveKey(secret: string, salt: string, keyLength: number = 32): Buffer {
    return scryptSync(secret, salt, keyLength);
}

function signValue(value: string, secret: string, algorithm: "sha256" | "sha512" = "sha256"): string {
    return createHmac(algorithm, secret).update(value).digest("hex");
}

function verifySignedValue(value: string, signature: string, secret: string, algorithm: "sha256" | "sha512" = "sha256"): boolean {
    const expected = signValue(value, secret, algorithm);
    if (expected.length !== signature.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function encryptValue(value: string, options: Required<ServerOnlyCookieOptions>): string {
    const salt = randomBytes(16).toString("hex");
    const iv = randomBytes(options.ivLength ?? GCM_IV_LENGTH);
    const key = deriveKey(options.secret, salt, 32);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(salt, "utf8"));
    let encrypted = cipher.update(value, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${salt}:${iv.toString("hex")}:${encrypted}:${authTag}`;
}

function decryptValue(encrypted: string, options: Required<ServerOnlyCookieOptions>): string | null {
    try {
        const parts = encrypted.split(":");
        if (parts.length !== 4) return null;
        const [salt, ivHex, ciphertext, authTag] = parts;
        if (!salt || !ivHex || !ciphertext || !authTag) return null;
        const iv = Buffer.from(ivHex, "hex");
        const key = deriveKey(options.secret, salt, 32);
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAAD(Buffer.from(salt, "utf8"));
        decipher.setAuthTag(Buffer.from(authTag, "hex"));
        let decrypted = decipher.update(ciphertext, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch {
        return null;
    }
}

function requiredSecret(secret: string | undefined, name: string, kind: string): string {
    if (!secret) throw new CookieSecretRequiredError(name, kind);
    return secret;
}

function hasSecurePrefix(name: string): boolean {
    return name.startsWith("__Secure-") || name.startsWith("__Host-");
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
    validateCookieName(name);

    if (hasSecurePrefix(name)) {
        if (options.secure !== true) {
            throw new CookieSecurePrefixError(name, "requires Secure attribute", {
                details: { name, path: options.path, domain: options.domain },
            });
        }
        if (name.startsWith("__Host-")) {
            if (options.path !== "/" && options.path !== undefined) {
                throw new CookieSecurePrefixError(name, "with __Host- prefix must have Path=/", {
                    details: { name, path: options.path },
                });
            }
            if (options.domain !== undefined) {
                throw new CookieSecurePrefixError(name, "with __Host- prefix must not have Domain attribute", {
                    details: { name, domain: options.domain },
                });
            }
        }
    }

    return serializeCookieString(name, value, options);
}

interface CookieIo {
    read(name: string): string | undefined;
    write(name: string, value: string, options: CookieOptions): void;
    remove(name: string, options?: { path?: string; domain?: string }): void;
    clear(): void;
    snapshot(): Record<string, string>;
}

function createStore(config: CookieConfig, io: CookieIo, store: Map<string, CookieEntry>): CookieStore & { store: Map<string, CookieEntry> } {
    const config_ = { ...DEFAULT_COOKIE_CONFIG, ...config };

    const cookieStore: CookieStore & { store: Map<string, CookieEntry> } = {
        store,
        get(name: string): string | undefined {
            return io.read(name);
        },
        set(name: string, value: string, options: CookieOptions = {}): CookieStore {
            validateCookieName(name);
            const merged = mergeCookieOptions(config_, options);
            const secret = options.secret || config_.secret;

            if (merged.encrypted) {
                const s = requiredSecret(secret, name, "encrypted");
                const opts: Required<ServerOnlyCookieOptions> = { secret: s, algorithm: "sha256", ivLength: GCM_IV_LENGTH };
                const encrypted = encryptValue(value, opts);
                store.set(name, { value: encrypted, signed: false, encrypted: true, secret: s });
                io.write(name, encrypted, merged);
            } else if (merged.signed || config_.signed) {
                const s = requiredSecret(secret, name, "signed");
                const signature = signValue(value, s);
                store.set(name, { value: `${value}.${signature}`, signed: true, encrypted: false, secret: s });
                io.write(name, `${value}.${signature}`, merged);
            } else {
                store.set(name, { value, signed: false, encrypted: false });
                io.write(name, value, merged);
            }
            return this;
        },
        delete(name: string, options?: { path?: string; domain?: string }): CookieStore {
            store.delete(name);
            io.remove(name, options ?? {});
            return this;
        },
        has(name: string): boolean {
            return io.read(name) !== undefined;
        },
        all(): Record<string, string> {
            const result = { ...io.snapshot() };
            for (const [name, entry] of store) {
                if (entry.signed) {
                    const verified = cookieStore.getSigned(name);
                    if (verified !== undefined) result[name] = verified;
                } else if (entry.encrypted) {
                    const decrypted = cookieStore.getEncrypted(name);
                    if (decrypted !== null) result[name] = decrypted;
                }
            }
            return result;
        },
        clear(): CookieStore {
            store.clear();
            io.clear();
            return this;
        },
        setSigned(name: string, value: string, options: CookieOptions = {}): CookieStore {
            return this.set(name, value, { ...options, signed: true });
        },
        setEncrypted(name: string, value: string, options: CookieOptions = {}): CookieStore {
            return this.set(name, value, { ...options, encrypted: true });
        },
        getSigned(name: string): string | undefined {
            const entry = store.get(name);
            let payload: string | undefined;
            let secret: string | undefined;
            if (entry) {
                payload = entry.value;
                secret = entry.secret || config_.secret;
            } else {
                payload = io.read(name);
                if (payload === undefined) return undefined;
                secret = config_.secret;
            }
            if (!secret) return undefined;
            const parts = payload.split(".");
            if (parts.length !== 2) return undefined;
            const [signedValue, signature] = parts;
            if (verifySignedValue(signedValue, signature, secret)) return signedValue;
            for (const fallback of config_.secrets ?? []) {
                if (verifySignedValue(signedValue, signature, fallback)) return signedValue;
            }
            return undefined;
        },
        getEncrypted(name: string): string | null {
            const entry = store.get(name);
            let payload: string | undefined;
            let secret: string | undefined;
            if (entry) {
                payload = entry.value;
                secret = entry.secret || config_.secret;
            } else {
                payload = io.read(name);
                if (payload === undefined) return null;
                secret = config_.secret;
            }
            if (!secret) return null;
            const opts: Required<ServerOnlyCookieOptions> = { secret, algorithm: "sha256", ivLength: GCM_IV_LENGTH };
            let result = decryptValue(payload, opts);
            if (result !== null) return result;
            for (const fallback of config_.secrets ?? []) {
                const fallbackOpts: Required<ServerOnlyCookieOptions> = { secret: fallback, algorithm: "sha256", ivLength: GCM_IV_LENGTH };
                result = decryptValue(payload, fallbackOpts);
                if (result !== null) return result;
            }
            return null;
        },
        serialize(name: string, value: string, options: CookieOptions = {}): string {
            return serializeCookie(name, value, mergeCookieOptions(config_, options));
        },
        parse(cookieHeader: string): Record<string, string> {
            const parsed = parseCookie(cookieHeader) as Record<string, string>;
            const result: Record<string, string> = {};
            for (const [name, value] of Object.entries(parsed)) {
                if (name === "" || value === undefined || value === "") continue;
                result[name] = value;
            }
            return result;
        },
    };

    return cookieStore;
}

export function createCookieStore(config: CookieConfig | string = {}): CookieStore {
    const normalized: CookieConfig = typeof config === "string" ? { secret: config, signed: true } : config;
    const config_ = { ...DEFAULT_COOKIE_CONFIG, ...normalized };
    const store: Map<string, CookieEntry> = new Map();
    const io: CookieIo = {
        read: (name) => store.get(name)?.value,
        write: (_name, _value, _options) => {},
        remove: (name) => store.delete(name),
        clear: () => store.clear(),
        snapshot: () => Object.fromEntries([...store.entries()].map(([k, v]) => [k, v.value])),
    };
    return createStore(config_, io, store);
}

export function createCookieStoreFromAdapter(adapter: CookieAdapter, config: CookieConfig | string = {}): CookieStore {
    const normalized: CookieConfig = typeof config === "string" ? { secret: config, signed: true } : config;
    const config_ = { ...DEFAULT_COOKIE_CONFIG, ...normalized };
    const store: Map<string, CookieEntry> = new Map();

    const io: CookieIo = {
        read: (name) => adapter.get(name),
        write: (name, value, options) => adapter.set(name, value, options),
        remove: (name, options) => adapter.delete(name, options ?? {}),
        clear: () => {},
        snapshot: () => adapter.getAll(),
    };

    return createStore(config_, io, store);
}

export function detectCookieFramework(
    req: any = undefined,
    res: any = undefined,
    ctx: any = undefined,
): DetectedCookieFramework {
    if (ctx?.cookies) {
        return { framework: "koa", confidence: "high" };
    }
    if (req?.headers?.cookie) {
        return { framework: "express", confidence: "high" };
    }
    if (res?.setHeader) {
        return { framework: "http", confidence: "low" };
    }
    return { framework: "unknown", confidence: "low" };
}

export function createDetectedCookieStore(
    req: any = undefined,
    res: any = undefined,
    ctx: any = undefined,
    config: CookieConfig = {},
): CookieStore {
    const detected = detectCookieFramework(req, res, ctx);
    if (detected.framework === "koa" && ctx) {
        return createCookieStoreFromAdapter(createKoaCookieAdapter(ctx), config);
    }
    if (detected.framework === "express" && req && res) {
        return createCookieStoreFromAdapter(createExpressCookieAdapter(req, res), config);
    }
    if (detected.framework === "http" && res) {
        return createCookieStoreFromAdapter(createHttpCookieAdapter(req, res), config);
    }
    return createCookieStore(config);
}

export { DEFAULT_COOKIE_CONFIG, mergeCookieOptions };
