// @oneunit/core - DX Usage Examples

import { createApp } from "./src/core/index.js";
import express from "express";
import http from "node:http";

// ============================================================
// 1. GLOBAL CONFIG SECTIONS (one-time setup, per-call overrides)
// ============================================================

const app = createApp({
    serviceName: "my-api",
    port: 3000,
    secret: "super-secret-key",

    // Security defaults — applied to all cors/csrf/helmet/compression/sanitize calls
    security: {
        cors: { origin: "https://example.com", credentials: true },
        csrf: { cookieName: "my-csrf", ignoreMethods: ["GET", "HEAD", "OPTIONS"] },
        helmet: { hidePoweredBy: true, hsts: { maxAge: 31536000 } },
        compression: { threshold: 1024 },
    },

    // Cookie defaults — applied to all cookie operations
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 86400,
    },

    // Multipart defaults — applied to all file upload parsing
    multipart: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        allowedMimeTypes: ["image/jpeg", "image/png"],
    },

    // Health defaults
    health: { path: "/health" },
});

// Per-call overrides take precedence over global defaults
const cors = app.security().cors({ origin: "https://override.com" });
console.log(cors.options.origin); // "https://override.com"


// ============================================================
// 2. CACHED API INSTANCES (same object every call)
// ============================================================

const health1 = app.health();
const health2 = app.health();
console.log(health1 === health2); // true

const security1 = app.security();
const security2 = app.security();
console.log(security1 === security2); // true

const hooks1 = app.hooks();
const hooks2 = app.hooks();
console.log(hooks1 === hooks2); // true

const msgpack1 = app.msgpack();
const msgpack2 = app.msgpack();
console.log(msgpack1 === msgpack2); // true

const lib1 = app.lib();
const lib2 = app.lib();
console.log(lib1 === lib2); // true

const config1 = app.config();
const config2 = app.config();
console.log(config1 === config2); // true


// ============================================================
// 3. CONFIG GET / SET (runtime configuration)
// ============================================================

const config = app.config();
console.log(config.serviceName); // "my-api"
console.log(config.port);        // 3000
console.log(config.isProduction); // false

config.set("port", 4000);
console.log(config.get("port")); // 4000
console.log(config.port);        // 4000


// ============================================================
// 4. COOKIES (auto-detects framework, optional req/res)
// ============================================================

// Without req/res — works with defaults from cookie section
const serialized = app.cookies().serialize("session", "abc123", {});
console.log(serialized);
// "session=abc123; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=86400"

// With req/res — auto-detects Express/Fastify/Koa/http
const cookies = app.cookies(req, res);
cookies.set("user", "john", { httpOnly: true });
cookies.setSigned("token", "signed-value", { secret: "signing-key" });
cookies.setEncrypted("secret", "encrypted-value", { secret: "encryption-key" });

const value = cookies.get("session");
const signed = cookies.getSigned("token");
const encrypted = cookies.getEncrypted("secret");

cookies.delete("session");
cookies.clear();


// ============================================================
// 5. EXPRESS-STYLE MIDDLEWARE REGISTRATION (app.use)
// ============================================================

const corsMw = (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
};

const csrfMw = (req, res, next) => {
    // CSRF validation logic
    next();
};

// Chain multiple middleware registrations
app.use(corsMw).use(csrfMw);


// ============================================================
// 6. EXPRESS INTEGRATION (real server)
// ============================================================

const expressApp = express();
expressApp.use(express.json());

const core = createApp({ serviceName: "express-api", secret: "my-secret" });

// Health
const health = core.health();
health.register("db", async () => ({ status: "healthy" }));
health.register("cache", async () => ({ status: "degraded" }));

const healthServer = {
    get: (path, handler) => expressApp.get(path, handler),
    decorate: (name, value) => (expressApp as any)[name] = value,
};
await health.route(healthServer as any);

// Cookies
expressApp.get("/cookie", (req, res) => {
    const cookies = core.cookies(req, res);
    cookies.set("session", "abc123", { httpOnly: true });
    res.json({ ok: true });
});

// Security
expressApp.use((req, res, next) => {
    const mw = core.security().cors({ origin: "*" }).middleware();
    mw(req, res, next);
});

expressApp.get("/cors", (_req, res) => res.json({ ok: true }));

const server = http.createServer(expressApp);
server.listen(3000);

// ============================================================
// 7. MULTIPART FILE UPLOAD (all frameworks supported)
// ============================================================

const mp = core.multipart();
const uploadMw = mp.multipart({ maxFileSize: 5 * 1024 * 1024 });

expressApp.post("/upload", uploadMw.middleware(), async (req, res) => {
    const multipart = (req as any).multipart;
    console.log("Fields:", multipart.fields);
    console.log("Files:", multipart.files.map(f => ({ name: f.originalname, size: f.size })));
    res.json({ received: multipart.files.length });
});

// ============================================================
// 8. RESPONSE HELPERS
// ============================================================

expressApp.get("/ok", (req, res) => {
    const response = core.response(req, res);
    response.ok({ data: { id: 1 }, message: "OK" });
});

expressApp.get("/created", (req, res) => {
    const response = core.response(req, res);
    response.created({ data: { id: 2 } });
});

expressApp.get("/not-found", (req, res) => {
    const response = core.response(req, res);
    response.notFound({ message: "Resource not found" });
});

// ============================================================
// 9. MESSAGEPACK
// ============================================================

const msgpack = app.msgpack();
const bytes = msgpack.encode({ hello: "world" });
const decoded = msgpack.decode<{ hello: string }>(bytes);
console.log(decoded.hello); // "world"

// ============================================================
// 10. SYSTEM INFO & STATUS
// ============================================================

const info = app.lib().getSystemInfo();
console.log(info.platform, info.memory);

const status = app.lib().getSystemStatus(
    { cpu: 45, memory: 60 },
    { db: "healthy", cache: "degraded" },
);
console.log(status.overall); // "degraded"
