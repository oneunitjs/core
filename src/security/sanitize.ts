import sanitizeHtml from "sanitize-html";
import type { SanitizeOptions } from "./types.js";
export type { SanitizeOptions };

const DEFAULT_SANITIZE_OPTIONS: SanitizeOptions = {
    allowedTags: [
        "a", "abbr", "b", "bdo", "blockquote", "br", "cite", "code", "dd", "del",
        "dfn", "div", "dl", "dt", "em", "emoji", "h1", "h2", "h3", "h4", "h5", "h6",
        "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "q", "rp", "rt", "ruby",
        "s", "samp", "small", "span", "strong", "sub", "sup", "table", "tbody", "td",
        "tfoot", "th", "thead", "tr", "u", "ul", "var", "wbr",
    ],
    allowedAttributes: {
        a: ["href", "title", "target", "rel"],
        img: ["src", "alt", "width", "height"],
        table: ["border", "cellpadding", "cellspacing"],
        td: ["align", "colspan", "rowspan", "valign"],
        th: ["align", "colspan", "rowspan", "valign"],
        tr: ["align", "valign"],
        div: ["class"],
        span: ["class"],
        p: ["class"],
        h1: ["class"],
        h2: ["class"],
        h3: ["class"],
        h4: ["class"],
        h5: ["class"],
        h6: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {},
    allowSelfClosing: true,
    nonTextTags: ["script", "style"],
    disallowedTagsMode: "discard",
    parseStyleAttributes: false,
};

const UNSAFE_PROPERTY_NAMES = new Set(["__proto__", "prototype", "constructor"]);

export function sanitizeHtmlContent(
    html: string,
    options: SanitizeOptions = {}
): string {
    const merged = {
        ...DEFAULT_SANITIZE_OPTIONS,
        ...options,
        allowedTags: options.allowedTags ?? DEFAULT_SANITIZE_OPTIONS.allowedTags,
        allowedAttributes: {
            ...DEFAULT_SANITIZE_OPTIONS.allowedAttributes,
            ...options.allowedAttributes,
        },
        allowedSchemes: options.allowedSchemes ?? DEFAULT_SANITIZE_OPTIONS.allowedSchemes,
        allowedSchemesByTag: {
            ...DEFAULT_SANITIZE_OPTIONS.allowedSchemesByTag,
            ...options.allowedSchemesByTag,
        },
    } as SanitizeOptions & Record<string, unknown>;

    return sanitizeHtml(html, merged);
}

/**
 * Recursively sanitize string values inside an object or array.
 *
 * A WeakMap maps source values to their sanitized copies so circular
 * references cannot cause unbounded recursion and a stack overflow. When a
 * previously visited value is encountered again, the existing sanitized copy
 * is returned (preserving circular structure) rather than the original
 * unsanitized object. Unsafe property names (__proto__, prototype,
 * constructor) are skipped to avoid prototype pollution through the result
 * object. HTML sanitization is applied only to string values; it is not a
 * replacement for schema validation.
 *
 * Supported value types:
 * - plain objects (sanitized recursively)
 * - arrays (preserved as arrays, items sanitized recursively)
 * - strings (HTML-sanitized)
 * - numbers, booleans, null, undefined (passed through)
 * - Date, Buffer (passed through as opaque values)
 * - Map, Set, and other exotic types (passed through unchanged)
 */
export function sanitizeObject(
    obj: Record<string, unknown>,
    options: SanitizeOptions = {},
    _visited?: WeakMap<object, unknown>,
): Record<string, unknown> {
    const visited = _visited ?? new WeakMap<object, unknown>();
    const existing = visited.get(obj);
    if (existing) {
        return existing as Record<string, unknown>;
    }

    const result: Record<string, unknown> = {};
    visited.set(obj, result);

    for (const [key, value] of Object.entries(obj)) {
        if (UNSAFE_PROPERTY_NAMES.has(key)) {
            continue;
        }

        result[key] = sanitizeValue(value, options, visited);
    }

    return result;
}

/**
 * Sanitize a single value, preserving its type (array vs object) so nested
 * arrays are not converted into plain objects.
 */
function sanitizeValue(
    value: unknown,
    options: SanitizeOptions,
    visited: WeakMap<object, unknown>,
): unknown {
    if (typeof value === "string") {
        return sanitizeHtmlContent(value, options);
    }

    if (Array.isArray(value)) {
        const existing = visited.get(value);
        if (existing) {
            return existing;
        }
        const result: unknown[] = [];
        visited.set(value, result);
        for (const item of value) {
            result.push(sanitizeValue(item, options, visited));
        }
        return result;
    }

    if (typeof value === "object" && value !== null) {
        // Date, Buffer, Map, Set and other exotic types are passed through
        // unchanged: HTML sanitization does not apply to them.
        if (
            value instanceof Date ||
            Buffer.isBuffer(value) ||
            value instanceof Map ||
            value instanceof Set
        ) {
            return value;
        }
        return sanitizeObject(value as Record<string, unknown>, options, visited);
    }

    return value;
}

export interface Sanitizer {
    sanitize(html: string, options?: SanitizeOptions): string;
    sanitizeObject(obj: Record<string, unknown>, options?: SanitizeOptions): Record<string, unknown>;
}

export function createSanitizer(defaultOptions: SanitizeOptions = {}): Sanitizer {
    return {
        sanitize: (html: string, opts?: SanitizeOptions) =>
            sanitizeHtmlContent(html, { ...defaultOptions, ...opts }),
        sanitizeObject: (obj: Record<string, unknown>, opts?: SanitizeOptions) =>
            sanitizeObject(obj, { ...defaultOptions, ...opts }),
    };
}
