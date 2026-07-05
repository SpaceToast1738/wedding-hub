import { describe, expect, it } from "vitest";
import { markdownToBookHtml } from "@/lib/ai/apply/markdown-to-book-html";

describe("markdownToBookHtml", () => {
  it("wraps a single paragraph in <p>", () => {
    expect(markdownToBookHtml("Just a plain sentence.")).toBe(
      "<p>Just a plain sentence.</p>",
    );
  });

  it("splits blank-line-separated blocks into separate paragraphs", () => {
    expect(markdownToBookHtml("First.\n\nSecond.")).toBe(
      "<p>First.</p><p>Second.</p>",
    );
  });

  it("converts a single newline within a paragraph to <br/>", () => {
    expect(markdownToBookHtml("Line one\nLine two")).toBe(
      "<p>Line one<br/>Line two</p>",
    );
  });

  it("renders ## as h2 and ### as h3", () => {
    expect(markdownToBookHtml("## Section")).toBe("<h2>Section</h2>");
    expect(markdownToBookHtml("### Subsection")).toBe("<h3>Subsection</h3>");
  });

  it("renders **bold**, _italic_, and __underline__", () => {
    expect(markdownToBookHtml("**bold**")).toBe("<p><strong>bold</strong></p>");
    expect(markdownToBookHtml("_italic_")).toBe("<p><em>italic</em></p>");
    expect(markdownToBookHtml("__underline__")).toBe("<p><u>underline</u></p>");
  });

  it("renders a bullet list from - or * lines", () => {
    expect(markdownToBookHtml("- one\n- two\n- three")).toBe(
      "<ul><li>one</li><li>two</li><li>three</li></ul>",
    );
    expect(markdownToBookHtml("* one\n* two")).toBe(
      "<ul><li>one</li><li>two</li></ul>",
    );
  });

  it("renders a numbered list from 1. lines", () => {
    expect(markdownToBookHtml("1. one\n2. two")).toBe(
      "<ol><li>one</li><li>two</li></ol>",
    );
  });

  it("renders a blockquote from > lines", () => {
    expect(markdownToBookHtml("> quoted text")).toBe(
      "<blockquote><p>quoted text</p></blockquote>",
    );
  });

  it("renders a markdown link as an anchor with safe attrs", () => {
    expect(markdownToBookHtml("[the venue](https://example.com/venue)")).toBe(
      '<p><a href="https://example.com/venue" rel="noopener noreferrer" target="_blank">the venue</a></p>',
    );
  });

  it("escapes literal HTML special characters instead of interpreting them", () => {
    expect(markdownToBookHtml("<script>alert(1)</script> & co")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; co</p>",
    );
  });

  it("escapes special characters before applying markdown marks, so raw tags can't sneak through inline formatting", () => {
    expect(markdownToBookHtml("**<b>not html</b>**")).toBe(
      "<p><strong>&lt;b&gt;not html&lt;/b&gt;</strong></p>",
    );
  });

  it("mixes a heading, a paragraph, and a list in one document", () => {
    const input = "## Kids Entertainment\n\nThings to sort:\n\n- Jellyblocks\n- Bubbles";
    expect(markdownToBookHtml(input)).toBe(
      "<h2>Kids Entertainment</h2><p>Things to sort:</p><ul><li>Jellyblocks</li><li>Bubbles</li></ul>",
    );
  });

  it("treats an unsupported construct (image syntax) as literal escaped text, not silently dropped", () => {
    const out = markdownToBookHtml("![alt](https://example.com/x.png)");
    expect(out).toContain("![alt]");
    expect(out).not.toContain("<img");
  });
});
