import { describe, expect, it } from "vitest";
import { legacyBodyToHtml, sanitizeBookHtml } from "@/lib/sanitize-book-html";

// v1.37.0: TEXT-card HTML sanitiser. The toolbar is a 10-mark
// allow-list; everything else gets stripped. Anchors get `rel` +
// `target` forced even if the author tries to override them. Runs
// on both write (server action) and read (belt-and-braces).

describe("sanitizeBookHtml", () => {
  it("returns empty string for null/undefined/empty input", () => {
    expect(sanitizeBookHtml(null)).toBe("");
    expect(sanitizeBookHtml(undefined)).toBe("");
    expect(sanitizeBookHtml("")).toBe("");
  });

  it("preserves allowed inline marks", () => {
    const out = sanitizeBookHtml("<p><strong>bold</strong> <em>italic</em> <u>underline</u></p>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
    expect(out).toContain("<u>underline</u>");
  });

  it("preserves allowed block tags", () => {
    const out = sanitizeBookHtml("<h2>head</h2><h3>sub</h3><ul><li>a</li></ul><ol><li>b</li></ol><blockquote>q</blockquote>");
    expect(out).toContain("<h2>head</h2>");
    expect(out).toContain("<h3>sub</h3>");
    expect(out).toContain("<ul><li>a</li></ul>");
    expect(out).toContain("<ol><li>b</li></ol>");
    expect(out).toContain("<blockquote>q</blockquote>");
  });

  it("strips disallowed tags", () => {
    const out = sanitizeBookHtml("<p>x</p><script>alert(1)</script><img src=x><iframe></iframe><h1>nope</h1>");
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<h1>");
    // Paragraph passes through.
    expect(out).toContain("<p>x</p>");
  });

  it("strips inline event handlers", () => {
    const out = sanitizeBookHtml('<p onclick="alert(1)">click</p>');
    expect(out).toContain("<p>click</p>");
    expect(out).not.toContain("onclick");
  });

  it("strips javascript: hrefs", () => {
    // The disallowed-scheme href is dropped, but the inner text is preserved.
    const out = sanitizeBookHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain("javascript:");
  });

  it("strips data: hrefs", () => {
    const out = sanitizeBookHtml('<a href="data:text/html,<script>alert(1)</script>">click</a>');
    expect(out).not.toContain("data:");
    expect(out).not.toContain("<script>");
  });

  it("preserves http/https/mailto/tel hrefs", () => {
    const out = sanitizeBookHtml(
      '<a href="https://example.com">a</a> <a href="http://example.com">b</a> <a href="mailto:x@y.com">c</a> <a href="tel:01234">d</a>',
    );
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('href="http://example.com"');
    expect(out).toContain('href="mailto:x@y.com"');
    expect(out).toContain('href="tel:01234"');
  });

  it("forces rel + target on every anchor, overriding author values", () => {
    const out = sanitizeBookHtml(
      '<a href="https://example.com" rel="dofollow" target="_self">x</a>',
    );
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
    expect(out).not.toContain('rel="dofollow"');
    expect(out).not.toContain('target="_self"');
  });

  it("strips empty-href anchors", () => {
    const out = sanitizeBookHtml('<a href="">x</a><a href="   ">y</a>');
    expect(out).not.toContain("<a ");
    // Inner text preserved.
    expect(out).toContain("x");
    expect(out).toContain("y");
  });

  it("strips class/id/style attributes from allowed tags", () => {
    const out = sanitizeBookHtml(
      '<p class="big" id="x" style="color:red">hi</p><strong class="b">bold</strong>',
    );
    expect(out).toContain("<p>hi</p>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).not.toContain("class=");
    expect(out).not.toContain("id=");
    expect(out).not.toContain("style=");
  });

  it("preserves <br> as a self-closing tag", () => {
    const out = sanitizeBookHtml("<p>line1<br>line2</p>");
    expect(out).toContain("line1");
    expect(out).toContain("line2");
    expect(out).toMatch(/<br\s*\/?>/);
  });
});

describe("legacyBodyToHtml", () => {
  it("returns empty string for null/empty", () => {
    expect(legacyBodyToHtml(null)).toBe("");
    expect(legacyBodyToHtml(undefined)).toBe("");
    expect(legacyBodyToHtml("")).toBe("");
  });

  it("wraps a plain string in <p>", () => {
    expect(legacyBodyToHtml("hello")).toBe("<p>hello</p>");
  });

  it("escapes <, >, & before wrapping", () => {
    const out = legacyBodyToHtml("a < b & c > d");
    expect(out).toBe("<p>a &lt; b &amp; c &gt; d</p>");
  });

  it("turns blank lines into paragraph breaks", () => {
    const out = legacyBodyToHtml("para1\n\npara2");
    expect(out).toBe("<p>para1</p><p>para2</p>");
  });

  it("turns single newlines into <br>", () => {
    const out = legacyBodyToHtml("line1\nline2");
    // sanitize-html may serialise <br> with or without trailing slash
    expect(out).toMatch(/<p>line1<br\s*\/?>line2<\/p>/);
  });

  it("handles mixed paragraph + line breaks", () => {
    const out = legacyBodyToHtml("p1 line1\np1 line2\n\np2");
    expect(out).toMatch(/<p>p1 line1<br\s*\/?>p1 line2<\/p><p>p2<\/p>/);
  });

  it("escapes a script-tag-shaped body (defence in depth)", () => {
    const out = legacyBodyToHtml("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
});
