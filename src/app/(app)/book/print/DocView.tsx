// v2.14.0: the print / PDF rendering of a card Doc. Server component —
// no interactivity. Styled with the wedding theme (display serif for
// the title, moss headings) and the global print rules: chrome hides,
// backgrounds go white, `.print-break-avoid` keeps a list together.

import type { Doc, Span } from "@/lib/book-card-doc";

function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) => {
        if (s.text === "\n") return <br key={i} />;
        let node: React.ReactNode = s.text;
        if (s.italic) node = <em>{node}</em>;
        if (s.bold) node = <strong>{node}</strong>;
        if (s.href) {
          node = (
            <a href={s.href} className="text-moss-700 underline" rel="noopener noreferrer">
              {node}
            </a>
          );
        }
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

export function DocView({ doc, footer }: { doc: Doc; footer?: string }) {
  return (
    <article className="text-ink-primary leading-relaxed">
      <header className="mb-5 pb-3 border-b border-border-soft print-break-avoid">
        <h1 className="font-display text-2xl font-semibold text-moss-700">{doc.title}</h1>
        {doc.subtitle && <p className="text-xs text-ink-tertiary mt-1">{doc.subtitle}</p>}
      </header>
      <div className="space-y-3 text-sm">
        {doc.blocks.map((b, i) => {
          switch (b.kind) {
            case "heading":
              return (
                <h2 key={i} className="text-base font-semibold text-moss-700 mt-5 first:mt-0">
                  {b.text}
                </h2>
              );
            case "paragraph":
              return (
                <p key={i}>
                  <Spans spans={b.spans} />
                </p>
              );
            case "quote":
              return (
                <blockquote key={i} className="border-l-2 border-moss-300 pl-3 text-ink-secondary italic">
                  <Spans spans={b.spans} />
                </blockquote>
              );
            case "list":
              return b.ordered ? (
                <ol key={i} className="list-decimal pl-5 space-y-1 print-break-avoid">
                  {b.items.map((item, j) => (
                    <li key={j}>
                      <Spans spans={item} />
                    </li>
                  ))}
                </ol>
              ) : (
                <ul key={i} className="list-disc pl-5 space-y-1 print-break-avoid">
                  {b.items.map((item, j) => (
                    <li key={j}>
                      <Spans spans={item} />
                    </li>
                  ))}
                </ul>
              );
            case "kv":
              return (
                <dl key={i} className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 print-break-avoid">
                  {b.rows.map((r, j) => (
                    <div key={j} className="contents">
                      <dt className="text-[11px] uppercase tracking-wider text-ink-tertiary font-semibold pt-0.5">
                        {r.label}
                      </dt>
                      <dd className="break-words">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              );
            case "table":
              return (
                <div key={i} className="overflow-x-auto print-break-avoid">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        {b.headers.map((h, j) => (
                          <th
                            key={j}
                            className="text-left font-semibold text-ink-secondary border-b border-border-soft py-1 pr-3"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.rows.map((row, j) => (
                        <tr key={j} className="border-b border-border-soft last:border-b-0">
                          {row.map((c, k) => (
                            <td key={k} className={`py-1 pr-3 align-top ${k === 0 ? "font-medium" : ""}`}>
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
          }
        })}
        {doc.blocks.length === 0 && <p className="text-ink-tertiary italic">This card has no content yet.</p>}
      </div>
      {footer && <footer className="mt-8 pt-3 border-t border-border-soft text-[11px] text-ink-tertiary">{footer}</footer>}
    </article>
  );
}
