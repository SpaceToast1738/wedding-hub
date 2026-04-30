// v1.37.0 (P7a): sanitiser for TEXT-card HTML authored via the Tiptap
// WYSIWYG editor. Wraps `sanitize-html` with a tight allow-list — the
// 10-mark toolbar set the Book Expansion Plan §5 specifies.
//
// Run on **write** (server-action enforces this — never trust the
// browser) AND on **read** (belt-and-braces — defends against any
// row that slipped through historic versions or a direct DB edit).
//
// Allow-list:
//   - Block-level: p, h2, h3, ul, ol, li, blockquote
//   - Inline:      strong, em, u, br
//   - Anchors:     a (with href + enforced rel="noopener noreferrer"
//                    target="_blank")
// Anything else — including `script`, `style`, `iframe`, `img`,
// inline event handlers, javascript: URLs, data: URLs, class/id
// attributes — is stripped. The toolbar is a compile-time constant
// in RichTextEditor; the user cannot author the disallowed marks
// even if they paste rich content from another source.

import sanitizeHtml from "sanitize-html";

export const BOOK_HTML_ALLOWED_TAGS = [
  "p",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "strong",
  "em",
  "u",
  "br",
  "a",
] as const;

const BASE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...BOOK_HTML_ALLOWED_TAGS],
  // Anchors keep `href`, `rel`, `target` only — the latter two are
  // forced by transformTags below; listing them here lets them
  // survive sanitize-html's post-transform attribute filter.
  // Class/id/style/title/etc. are stripped.
  allowedAttributes: {
    a: ["href", "rel", "target"],
  },
  // sanitize-html's default scheme allow-list (http, https, mailto,
  // tel, ftp) is what we want — strips javascript: and data:.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  // Strip everything not in the allow-list rather than escaping it —
  // pasted images / styles just disappear. Matches the user's mental
  // model of "the toolbar is the schema".
  disallowedTagsMode: "discard",
  // Force every <a> to open in a new tab + nofollow-equivalent. This
  // **overrides** any rel/target the author may have hand-edited.
  // Empty-href anchors are demoted to <span> (which is then stripped
  // since span isn't allowed) so we end up with the inner text only.
  transformTags: {
    a: (_tagName, attribs) => {
      const href = (attribs.href ?? "").trim();
      if (!href) {
        return { tagName: "span", attribs: {} as sanitizeHtml.Attributes };
      }
      return {
        tagName: "a",
        attribs: {
          href,
          rel: "noopener noreferrer",
          target: "_blank",
        } as sanitizeHtml.Attributes,
      };
    },
  },
};

/**
 * Sanitise HTML written by the Book TEXT-card editor. Strips every tag
 * / attr not in the allow-list and forces `rel`+`target` on anchors.
 * Returns an empty string for null / empty input.
 */
export function sanitizeBookHtml(input: string | null | undefined): string {
  if (!input) return "";
  return sanitizeHtml(input, BASE_OPTIONS);
}

/**
 * Convert a legacy plain-text body into the same HTML shape the editor
 * authors. Mirrors the SQL backfill in
 * `prisma/migrations/20260430090000_book_text_html/migration.sql` so
 * read-time fallback (when a row has body but null bodyHtml) renders
 * identically. Always passes the result through sanitizeBookHtml as a
 * final guard.
 */
export function legacyBodyToHtml(body: string | null | undefined): string {
  if (!body) return "";
  // Escape order matters: & first so we don't double-escape the
  // entities we're about to introduce.
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Paragraph splits on blank lines; remaining \n become <br>.
  const html = "<p>" + escaped.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";
  return sanitizeBookHtml(html);
}
