import type { CookieConfig, CookieOptions } from "./types.js";

export const DEFAULT_COOKIE_CONFIG: CookieConfig = {
    path: "/",
    secure: false,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    signed: false,
    encrypted: false,
};

export function mergeCookieOptions(
    defaults: CookieConfig,
    overrides: CookieOptions = {}
): CookieOptions {
    return {
        path: overrides.path ?? defaults.path ?? "/",
        domain: overrides.domain ?? defaults.domain,
        expires: overrides.expires,
        maxAge: overrides.maxAge ?? defaults.maxAge,
        secure: overrides.secure ?? defaults.secure ?? false,
        httpOnly: overrides.httpOnly ?? defaults.httpOnly ?? true,
        sameSite: overrides.sameSite ?? defaults.sameSite ?? "lax",
        signed: overrides.signed ?? defaults.signed ?? false,
        encrypted: overrides.encrypted ?? defaults.encrypted ?? false,
        secret: overrides.secret ?? defaults.secret,
        secrets: overrides.secrets ?? defaults.secrets,
        encode: overrides.encode ?? defaults.encode,
        decode: overrides.decode ?? defaults.decode,
    };
}
