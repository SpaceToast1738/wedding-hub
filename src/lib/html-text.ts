// v2.13.3: HTML → plain text for the AI read tools.
//
// The book read tools (read_book, read_book_card) each carried a local
// `stripHtml` that removed tags but never decoded entities. bodyHtml is
// legitimately entity-escaped (markdownToBookHtml / sanitizeBookHtml
// write `&amp;`, `&lt;`, `&quot;`…), so the "plain text" the model got
// back still said `&amp;`. Quote that into any plain-text write —
// rename, notes, supersede-with-tweak — and the site renders a literal
// "&amp;" (escaped once more at render). By 18 Aug 2026 two section
// titles, two card titles, two tasks' notes and a budget note on the
// live site read "&amp;", all traceable to reads quoted back into
// writes; seven cleanup proposals were needed. (Enhancement cmsz2lj1.)
//
// Plain text means plain text: tags gone, entities decoded, whitespace
// collapsed. Escaping stays a render-time concern.

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  middot: "·",
  pound: "£",
  euro: "€",
  copy: "©",
  reg: "®",
  deg: "°",
  times: "×",
};

/** Decode the HTML entities that can appear in sanitised book HTML —
 *  the common named ones plus decimal / hex numeric references. Unknown
 *  named entities are left as-is rather than guessed. Runs a single
 *  pass, so `&amp;lt;` decodes to the literal text `&lt;`, exactly as a
 *  browser would render it. */
export function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (match, _all, hex, dec, name) => {
    if (hex) {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : match;
    }
    if (dec) {
      const cp = parseInt(dec, 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : match;
    }
    const decoded = NAMED[String(name).toLowerCase()];
    return decoded ?? match;
  });
}

/** Tags → spaces (so `</p><p>` still separates words), entities decoded,
 *  whitespace collapsed to single spaces, trimmed. Null/empty → "". */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}
