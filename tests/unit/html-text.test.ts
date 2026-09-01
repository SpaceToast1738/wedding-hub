// v2.13.3: the read tools' HTML → plain-text path. The invariant that
// matters: what a read tool hands the model is what a browser would
// SHOW, so quoting it back into a plain-text write can't double-escape.

import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, stripHtml } from "@/lib/html-text";

describe("decodeHtmlEntities", () => {
  it("decodes the entities sanitised book HTML actually emits", () => {
    expect(decodeHtmlEntities("Ceremony &amp; Music")).toBe("Ceremony & Music");
    expect(decodeHtmlEntities("&lt;3 &gt; 2 &quot;yes&quot; it&apos;s")).toBe(
      '<3 > 2 "yes" it\'s',
    );
  });

  it("decodes decimal and hex numeric references", () => {
    expect(decodeHtmlEntities("caf&#233; &#x2014; &#8212;")).toBe("café — —");
  });

  it("is single-pass, like a browser: &amp;lt; renders as the text &lt;", () => {
    expect(decodeHtmlEntities("&amp;lt;")).toBe("&lt;");
  });

  it("leaves unknown named entities alone rather than guessing", () => {
    expect(decodeHtmlEntities("&bogus; &amp;")).toBe("&bogus; &");
  });

  it("rejects out-of-range numeric references", () => {
    expect(decodeHtmlEntities("&#0; &#x110000; ok")).toBe("&#0; &#x110000; ok");
  });
});

describe("stripHtml", () => {
  it("strips tags, decodes entities and collapses whitespace", () => {
    const html =
      "<h3>Clothing &amp; Accessories</h3><p>Shoes:&nbsp;<strong>tan</strong> &mdash; <em>not</em> brown.</p>";
    expect(stripHtml(html)).toBe("Clothing & Accessories Shoes: tan — not brown.");
  });

  it("keeps words apart across block boundaries", () => {
    expect(stripHtml("<p>one</p><p>two</p>")).toBe("one two");
  });

  it("returns empty for null / undefined / empty", () => {
    expect(stripHtml(null)).toBe("");
    expect(stripHtml(undefined)).toBe("");
    expect(stripHtml("")).toBe("");
  });

  it("the round-trip that bit the live site: read → write is now lossless", () => {
    // The stored title was plain "Ceremony & Music"; its HTML form is
    // "Ceremony &amp; Music". A read that returned the escaped form,
    // quoted straight back into a rename, produced the literal "&amp;"
    // the couple saw. The plain form round-trips unchanged.
    const stored = "Ceremony & Music";
    const asHtml = stored.replace(/&/g, "&amp;");
    expect(stripHtml(`<p>${asHtml}</p>`)).toBe(stored);
  });
});
