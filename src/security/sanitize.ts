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

export function sanitizeObject(
    obj: Record<string, unknown>,
    options: SanitizeOptions = {}
): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
            result[key] = sanitizeHtmlContent(value, options);
        } else if (Array.isArray(value)) {
            result[key] = value.map((item) => {
                if (typeof item === "string") {
                    return sanitizeHtmlContent(item, options);
                }
                if (typeof item === "object" && item !== null) {
                    return sanitizeObject(item as Record<string, unknown>, options);
                }
                return item;
            });
        } else if (typeof value === "object" && value !== null) {
            result[key] = sanitizeObject(value as Record<string, unknown>, options);
        } else {
            result[key] = value;
        }
    }

    return result;
}

export interface Sanitizer {
    sanitize(html: string, options?: SanitizeOptions): string;
    sanitizeObject(obj: Record<string, unknown>, options?: SanitizeOptions): Record<string, unknown>;
}

export function createSanitizer(_options: SanitizeOptions = {}): Sanitizer {
    return {
        sanitize: (html: string, opts?: SanitizeOptions) => sanitizeHtmlContent(html, opts),
        sanitizeObject: (obj: Record<string, unknown>, opts?: SanitizeOptions) =>
            sanitizeObject(obj, opts),
    };
}
