"use client";

// v2.2.1: renders assistant chat text as markdown instead of raw text.
//
// The model formats responses with headings, bold, and numbered/
// bulleted lists (the system prompt explicitly asks for "bullet
// points over paragraphs"); pre-fix the panel dumped that straight
// into a whitespace-pre-wrap div, so the couple saw literal "##" and
// "**" characters instead of formatted text.
//
// remark-gfm adds tables/strikethrough/autolinks; remark-breaks turns
// single newlines into <br> (commonmark normally treats those as a
// soft break within one paragraph, which reads as run-together prose
// for short chat-style lines). No rehype-raw plugin — react-markdown
// escapes literal HTML in the source by default, so model output
// can't inject markup.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

/** Inline-only variant for short AI-written strings that live inside
 *  existing flowing UI (a <span>, a <li> alongside other inline
 *  content, a one-line summary) — the block renderer's <div>/<p>
 *  wrapper would be invalid DOM nesting there. Handles bold/italic/
 *  code/links; block constructs (headings, lists) fall back to
 *  react-markdown's defaults if the model ever emits one, which is
 *  visually imperfect but never invalid HTML. */
export function InlineMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        p: ({ children }) => <>{children}</>,
        strong: (p) => <strong className="font-semibold" {...p} />,
        em: (p) => <em className="italic" {...p} />,
        code: (p) => (
          <code className="bg-surface border border-border-soft rounded px-1 py-0.5 text-xs font-mono" {...p} />
        ),
        a: (p) => (
          <a
            className="text-info underline hover:no-underline"
            target="_blank"
            rel="noopener noreferrer"
            {...p}
          />
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: (p) => <h3 className="text-sm font-bold mt-3 mb-1" {...p} />,
          h2: (p) => <h3 className="text-sm font-bold mt-3 mb-1" {...p} />,
          h3: (p) => <h4 className="text-sm font-semibold mt-2 mb-1" {...p} />,
          p: (p) => <p className="mb-2" {...p} />,
          ul: (p) => <ul className="list-disc pl-5 mb-2 space-y-0.5" {...p} />,
          ol: (p) => <ol className="list-decimal pl-5 mb-2 space-y-0.5" {...p} />,
          li: (p) => <li {...p} />,
          strong: (p) => <strong className="font-semibold" {...p} />,
          em: (p) => <em className="italic" {...p} />,
          a: (p) => (
            <a
              className="text-info underline hover:no-underline"
              target="_blank"
              rel="noopener noreferrer"
              {...p}
            />
          ),
          code: (p) => (
            <code className="bg-surface border border-border-soft rounded px-1 py-0.5 text-xs font-mono" {...p} />
          ),
          pre: (p) => (
            <pre className="bg-surface border border-border-soft rounded-md p-2 mb-2 overflow-x-auto text-xs font-mono" {...p} />
          ),
          blockquote: (p) => (
            <blockquote className="border-l-2 border-border-soft pl-2 italic text-ink-secondary mb-2" {...p} />
          ),
          hr: () => <hr className="my-2 border-border-soft" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
