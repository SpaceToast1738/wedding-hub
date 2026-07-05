// v2.6.6: the AI's book-card write tools (propose_book_card_replace_text,
// summarizeBookCard) used to HTML-escape their text wholesale and wrap
// it in <p>/<br/> only — the model had no way to produce a heading,
// bold, a list, or a link even though sanitize-book-html.ts's allow-
// list (and the Tiptap editor) fully support all of that. This module
// is the other half: a narrow markdown-subset parser targeting EXACTLY
// BOOK_HTML_ALLOWED_TAGS, so the model can write plain markdown and
// get real formatting instead of literal asterisks.
//
// Deliberately not a general-purpose markdown library — the allow-list
// is narrow (no images, tables, code blocks, nested lists), and a
// hand-rolled parser matching it exactly is easier to reason about and
// keeps the output within what sanitizeBookHtml (re-run server-side
// regardless, as defense-in-depth) will actually keep.
//
// Supported: ## / ### headings, **bold**, _italic_, __underline__,
// - / * bullet lists, 1. numbered lists, > blockquote, [text](url)
// links, blank-line-separated paragraphs with single newlines as <br/>.
// Anything else (images, tables, code fences, nested lists) is left as
// literal escaped text — no worse than the old plain-paragraph
// behaviour, never silently dropped.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inline marks, applied AFTER escaping so a literal `<`/`>`/`&` in the
 *  model's prose can never become a real tag — only our own
 *  substitutions do. Order matters: links before bold/italic so a link
 *  label containing `**`/`_` isn't mangled first. */
function applyInlineMarks(escaped: string): string {
  let out = escaped;
  // [text](url) — href scheme/safety is sanitizeBookHtml's job on the
  // way back out; this just shapes the tag. Negative lookbehind excludes
  // ![alt](url) image syntax — img isn't in the allow-list, so leave it
  // as literal text rather than silently turning it into a plain link.
  out = out.replace(
    /(?<!!)\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>',
  );
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_\n]+)__/g, "<u>$1</u>");
  out = out.replace(/_([^_\n]+)_/g, "<em>$1</em>");
  return out;
}

function inlineToHtml(text: string): string {
  return applyInlineMarks(escapeHtml(text)).replace(/\n/g, "<br/>");
}

type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "blockquote"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "p"; text: string };

function classifyBlock(raw: string): Block {
  const trimmed = raw.trim();

  const h2 = trimmed.match(/^##\s+(.+)$/);
  if (h2 && !trimmed.startsWith("###")) return { kind: "heading", level: 2, text: h2[1]! };
  const h3 = trimmed.match(/^###\s+(.+)$/);
  if (h3) return { kind: "heading", level: 3, text: h3[1]! };

  const lines = trimmed.split("\n");

  if (lines.every((l) => /^>\s?/.test(l.trim()))) {
    return {
      kind: "blockquote",
      text: lines.map((l) => l.trim().replace(/^>\s?/, "")).join("\n"),
    };
  }

  if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
    return { kind: "ul", items: lines.map((l) => l.trim().replace(/^[-*]\s+/, "")) };
  }

  if (lines.every((l) => /^\d+\.\s+/.test(l.trim()))) {
    return { kind: "ol", items: lines.map((l) => l.trim().replace(/^\d+\.\s+/, "")) };
  }

  return { kind: "p", text: trimmed };
}

function blockToHtml(block: Block): string {
  switch (block.kind) {
    case "heading":
      return `<h${block.level}>${inlineToHtml(block.text)}</h${block.level}>`;
    case "blockquote":
      return `<blockquote><p>${inlineToHtml(block.text)}</p></blockquote>`;
    case "ul":
      return `<ul>${block.items.map((i) => `<li>${inlineToHtml(i)}</li>`).join("")}</ul>`;
    case "ol":
      return `<ol>${block.items.map((i) => `<li>${inlineToHtml(i)}</li>`).join("")}</ol>`;
    case "p":
      return `<p>${inlineToHtml(block.text)}</p>`;
  }
}

/** Convert the AI's markdown-subset text into HTML restricted to
 *  BOOK_HTML_ALLOWED_TAGS. Blank lines (`\n{2,}`) separate blocks, same
 *  boundary the old plain-paragraph version used. */
export function markdownToBookHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => blockToHtml(classifyBlock(raw)))
    .join("");
}
