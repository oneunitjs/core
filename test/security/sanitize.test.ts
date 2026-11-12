import { describe, it, expect } from "vitest";
import { createSanitizer, sanitizeHtmlContent, sanitizeObject } from "../../src/security/sanitize.js";

describe("createSanitizer", () => {
    it("sanitizes basic HTML", () => {
        const sanitizer = createSanitizer();
        const result = sanitizer.sanitize("<p>Hello <b>world</b></p>");
        expect(result).toBe("<p>Hello <b>world</b></p>");
    });

    it("removes script tags", () => {
        const sanitizer = createSanitizer();
        const result = sanitizer.sanitize("<p>Hello</p><script>alert('xss')</script>");
        expect(result).not.toContain("script");
        expect(result).not.toContain("alert");
    });

    it("removes event handlers", () => {
        const sanitizer = createSanitizer();
        const result = sanitizer.sanitize('<a href="http://example.com" onclick="alert(1)">link</a>');
        expect(result).not.toContain("onclick");
        expect(result).toContain("link");
    });

    it("strips style tags", () => {
        const sanitizer = createSanitizer();
        const result = sanitizer.sanitize("<p>Hello</p><style>body{color:red}</style>");
        expect(result).not.toContain("style");
        expect(result).not.toContain("color:red");
    });

    it("sanitizeObject sanitizes string values", () => {
        const sanitizer = createSanitizer();
        const obj = { name: "<b>John</b>", bio: "<script>alert(1)</script>" };
        const result = sanitizer.sanitizeObject(obj);
        expect(result.name).toBe("<b>John</b>");
        expect(result.bio).not.toContain("script");
    });

    it("sanitizeObject sanitizes arrays of strings", () => {
        const sanitizer = createSanitizer();
        const obj = { tags: ["<b>tag1</b>", "plain"] };
        const result = sanitizer.sanitizeObject(obj);
        expect(result.tags).toEqual(["<b>tag1</b>", "plain"]);
    });

    it("sanitizeObject sanitizes nested objects", () => {
        const sanitizer = createSanitizer();
        const obj = { user: { name: "<b>John</b>" } };
        const result = sanitizer.sanitizeObject(obj);
        expect(result.user.name).toBe("<b>John</b>");
    });

    it("returns empty string for empty input", () => {
        const sanitizer = createSanitizer();
        expect(sanitizer.sanitize("")).toBe("");
    });
});

describe("sanitizeHtmlContent", () => {
    it("sanitizes basic HTML", () => {
        const result = sanitizeHtmlContent("<p>Hello <b>world</b></p>");
        expect(result).toBe("<p>Hello <b>world</b></p>");
    });

    it("removes script tags", () => {
        const result = sanitizeHtmlContent("<script>alert('xss')</script>");
        expect(result).not.toContain("script");
        expect(result).not.toContain("alert");
    });

    it("allows custom tags", () => {
        const result = sanitizeHtmlContent("<custom-tag>content</custom-tag>", {
            allowedTags: ["custom-tag"],
        });
        expect(result).toContain("content");
    });

    it("allows custom attributes", () => {
        const result = sanitizeHtmlContent('<div data-test="value">text</div>', {
            allowedAttributes: { div: ["data-test"] },
        });
        expect(result).toContain('data-test="value"');
    });

    it("strips disallowed attributes", () => {
        const result = sanitizeHtmlContent('<div onclick="alert(1)">text</div>', {
            allowedAttributes: {},
        });
        expect(result).not.toContain("onclick");
    });

    it("handles empty string", () => {
        expect(sanitizeHtmlContent("")).toBe("");
    });
});

describe("sanitizeObject", () => {
    it("sanitizes nested object", () => {
        const obj = {
            name: "<b>John</b>",
            bio: "<script>alert(1)</script>",
            nested: { title: "<i>Title</i>" },
        };
        const result = sanitizeObject(obj);
        expect(result.name).toBe("<b>John</b>");
        expect(result.bio).not.toContain("script");
        expect(result.nested.title).toBe("<i>Title</i>");
    });

    it("sanitizes array of strings", () => {
        const obj = { tags: ["<b>one</b>", "<i>two</i>", "plain"] };
        const result = sanitizeObject(obj);
        expect(result.tags).toEqual(["<b>one</b>", "<i>two</i>", "plain"]);
    });

    it("preserves non-string values", () => {
        const obj = { count: 42, active: true, items: [1, 2, 3] };
        const result = sanitizeObject(obj);
        expect(result.count).toBe(42);
        expect(result.active).toBe(true);
        expect(result.items).toEqual([1, 2, 3]);
    });
});
