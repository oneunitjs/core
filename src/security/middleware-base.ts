import type { SecurityMiddleware } from "./types.js";

/**
 * Creates the common enabled-toggle + middleware wrapper used by all security
 * middleware implementations (CORS, CSRF, Helmet, Compression, etc.).
 *
 * Eliminates the ~10 lines of boilerplate repeated in every security
 * middleware file.
 */
export function createSecurityMiddlewareBase(
    name: string,
    options: Record<string, unknown>,
    middleware: (req: unknown, res: unknown, next?: () => void) => void,
): SecurityMiddleware & { middleware: () => typeof middleware } {
    let enabled = true;

    const wrapped: (req: unknown, res: unknown, next?: () => void) => void = (
        req,
        res,
        next,
    ) => {
        if (!enabled) {
            if (next) next();
            return;
        }
        middleware(req, res, next);
    };

    return {
        name,
        get enabled() {
            return enabled;
        },
        get options() {
            return { ...options };
        },
        enable() {
            enabled = true;
        },
        disable() {
            enabled = false;
        },
        toggle() {
            enabled = !enabled;
        },
        middleware: () => wrapped,
    };
}
