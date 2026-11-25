import { describe, it, expect } from "vitest";
import { sanitizeHtmlContent, sanitizeObject, createSanitizer } from "../../src/security/sanitize.js";

describe("Sanitization - Advanced Tests", () => {
    it("SAN-01: Remove malicious HTML - script tags stripped", () => {
        const result = sanitizeHtmlContent("<script>alert('xss')</script>");
        expect(result).not.toContain("<script>");
        expect(result).not.toContain("alert");
    });

    it("SAN-02: Reject dangerous URL schemes", () => {
        const result = sanitizeHtmlContent('<a href="javascript:alert(1)">link</a>');
        expect(result).not.toContain("javascript:");
    });

    it("SAN-03: Event handlers stripped", () => {
        const result = sanitizeHtmlContent('<div onclick="alert(1)">x</div>');
        expect(result).not.toContain("onclick");
    });

    it("SAN-04: Nested objects sanitized recursively", () => {
        const obj = { a: { b: "<script>x</script>" } };
        const result = sanitizeObject(obj);
        expect(result.a.b).not.toContain("script");
    });

    it("SAN-05: Circular references do not cause stack overflow", () => {
        const sanitizer = createSanitizer();
        const obj: any = { a: 1 };
        obj.self = obj;
        expect(() => sanitizer.sanitizeObject(obj)).not.toThrow();
    });

    it("SAN-06: Prototype pollution payloads skipped", () => {
        const sanitizer = createSanitizer();
        const obj = { __proto__: { polluted: true }, constructor: { prototype: { polluted: true } } };
        sanitizer.sanitizeObject(obj);
        expect(Object.prototype.polluted).toBeUndefined();
    });

    it("SAN-07: Legitimate input preserved unchanged", () => {
        const result = sanitizeHtmlContent("<p>Hello <b>world</b></p>");
        expect(result).toBe("<p>Hello <b>world</b></p>");
    });
});
