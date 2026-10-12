// v2.17.0: the Memory Book, rendered. Hook-free and import-light on
// purpose: the same tree serves the /memories page, the print view and
// (v2.20.0) the frozen export via renderToStaticMarkup. Styling comes
// from public/memories.css (class prefix mb-), never Tailwind, so the
// export can inline one stylesheet.

import type { Span } from "@/lib/book-card-doc";
import { PARTS } from "@/lib/memories/types";
import type { MemoryBlock, MemoryBookData, MemoryChapter, TimelineMonth } from "@/lib/memories/types";

export type BookMode = "screen" | "print";

const LONG_LIST = 14;

function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) => {
        if (s.text === "\n") return <br key={i} />;
        let node: React.ReactNode = s.text;
        if (s.italic) node = <em>{node}</em>;
        if (s.bold) node = <strong>{node}</strong>;
        if (s.href) node = <a href={s.href} rel="noopener noreferrer">{node}</a>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

function Details({ open, summary, children }: { open: boolean; summary: string; children: React.ReactNode }) {
  return (
    <details className="mb-details" open={open}>
      <summary>{summary}</summary>
      {children}
    </details>
  );
}

function money(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function Month({ m, mode }: { m: TimelineMonth; mode: BookMode }) {
  const c = m.counts;
  const bits: string[] = [];
  if (c.tasksDone) bits.push(`${c.tasksDone} done`);
  if (c.decisions) bits.push(`${c.decisions} decided`);
  if (c.questionsAnswered) bits.push(`${c.questionsAnswered} answered`);
  if (c.suppliersBooked) bits.push(`${c.suppliersBooked} booked`);
  if (c.guestsAdded) bits.push(`${c.guestsAdded} guests added`);
  if (c.paymentsPaid) bits.push(`${c.paymentsPaid} payments`);
  if (c.filesUploaded) bits.push(`${c.filesUploaded} files`);
  if (c.songsAdded) bits.push(`${c.songsAdded} songs`);
  return (
    <div className="mb-month">
      <div className="m">
        {m.label}
        {bits.length > 0 && <small>{bits.join(" · ")}</small>}
      </div>
      <div>
        {m.highlights.length > 0 && (
          <ul>
            {m.highlights.map((h, i) => (
              <li key={i}>
                <b>{h.kind === "milestone" ? "★" : h.kind === "event" ? "◆" : h.kind === "booked" ? "Booked" : h.kind === "paid" ? "Paid" : h.kind === "question" ? "Answered" : "Decided"}</b>
                {h.approx && <span className="approx">~ </span>}
                {h.text.replace(/^(Booked|Paid) /, "")}
              </li>
            ))}
          </ul>
        )}
        {m.tasksDone.length > 0 && (
          <Details open={mode !== "screen"} summary={`${m.tasksDone.length} task${m.tasksDone.length === 1 ? "" : "s"} finished`}>
            <ul>
              {m.tasksDone.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </Details>
        )}
      </div>
    </div>
  );
}

function BlockView({ b, mode }: { b: MemoryBlock; mode: BookMode }) {
  switch (b.kind) {
    case "heading":
      return <h3 className="mb-heading">{b.text}</h3>;
    case "paragraph":
      return (
        <p className="mb-para">
          <Spans spans={b.spans} />
        </p>
      );
    case "quote":
      return (
        <blockquote>
          <Spans spans={b.spans} />
        </blockquote>
      );
    case "list": {
      const List = b.ordered ? "ol" : "ul";
      const list = (
        <List className="mb-list">
          {b.items.map((item, i) => (
            <li key={i}>
              <Spans spans={item} />
            </li>
          ))}
        </List>
      );
      return b.items.length > LONG_LIST ? (
        <Details open={mode !== "screen"} summary={`Show all ${b.items.length}`}>{list}</Details>
      ) : (
        list
      );
    }
    case "kv":
      return (
        <dl className="mb-kv">
          {b.rows.map((r, i) => (
            <div key={i} style={{ display: "contents" }}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      );
    case "table":
      return (
        <table className="mb-grid-table">
          <thead>
            <tr>
              {b.headers.map((h, i) => (
                <th key={i} className={i === b.headers.length - 1 && /picked|qty|count|£/i.test(h) ? "n" : undefined}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j} className={j === r.length - 1 && /^\d+$/.test(cell) ? "n" : undefined}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "stats":
      return (
        <div className="mb-stats">
          {b.items.map((s, i) => (
            <div key={i} className={`mb-stat${s.hero ? " hero" : ""}`}>
              <b>
                {s.prefix}
                {s.value.toLocaleString("en-GB")}
                {s.suffix}
              </b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      );
    case "timeline":
      return (
        <div>
          {b.months.map((m) => (
            <Month key={m.month} m={m} mode={mode} />
          ))}
        </div>
      );
    case "doc":
      return (
        <article className="mb-doc">
          <div className="mb-doc-head">
            <h3>{b.doc.title}</h3>
            {mode === "screen" && (
              <a href={`/book/${b.source.sectionSlug}#${b.source.cardSlug}`}>Open in the Book</a>
            )}
          </div>
          {b.doc.blocks.map((inner, i) => (
            <DocInner key={i} b={inner} />
          ))}
        </article>
      );
    case "names":
      return (
        <div className="mb-names">
          {b.columns.map((c, i) => (
            <div key={i}>
              <h4>
                {c.label} · {c.names.length}
              </h4>
              <ul>
                {c.names.map((n, j) => (
                  <li key={j}>{n}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case "seating":
      return (
        <div className="mb-seating">
          {b.tables.map((t, i) => (
            <div key={i} className={`mb-table${t.shape === "HEAD" ? " head" : ""}`}>
              <h3>{t.name}</h3>
              <ul>
                {t.seats.map((s) => (
                  <li key={s.index} className={s.name ? undefined : "empty"}>
                    {s.name ?? "empty"}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case "events":
      return (
        <div className="mb-events">
          {b.items.map((e, i) => (
            <div key={i} className="mb-event">
              <div className="t">{e.time}</div>
              <div>
                <b>{e.title}</b>
                {e.location && <span className="where">{e.location}</span>}
                {e.notes && <span className="notes">{e.notes}</span>}
              </div>
            </div>
          ))}
        </div>
      );
    case "cards": {
      const cards = (
        <div className={`mb-cards${b.columns ? ` cols-${b.columns}` : ""}`}>
          {b.items.map((c, i) => (
            <div key={i} className="mb-card">
              {c.kicker && <div className="mb-eyebrow">{c.kicker}</div>}
              <h3>{c.href && mode === "screen" ? <a href={c.href} rel="noopener noreferrer">{c.title}</a> : c.title}</h3>
              <p style={{ whiteSpace: "pre-line" }}>{c.body}</p>
              {c.lines && c.lines.length > 0 && (
                <ul>
                  {c.lines.map((l, j) => (
                    <li key={j}>{l}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      );
      return b.items.length > LONG_LIST ? (
        <Details open={mode !== "screen"} summary={`Show all ${b.items.length}`}>{cards}</Details>
      ) : (
        cards
      );
    }
    case "moneyTable":
      return (
        <table className="mb-grid-table">
          <thead>
            <tr>
              <th>Category</th>
              <th className="n">Estimated</th>
              <th className="n">Actual</th>
              <th className="n">Paid</th>
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>
                <td>{r.label}</td>
                <td className="n">{money(r.estimated)}</td>
                <td className="n">{money(r.actual)}</td>
                <td className="n">{money(r.paid)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total</td>
              <td className="n">{money(b.total.estimated)}</td>
              <td className="n">{money(b.total.actual)}</td>
              <td className="n">{money(b.total.paid)}</td>
            </tr>
          </tbody>
        </table>
      );
    case "chat":
      return (
        <div className="mb-chat">
          {b.exchanges.map((x, i) => (
            <div key={i} style={{ display: "contents" }}>
              <div className="when">{x.when}</div>
              <div className="u">{x.user}</div>
              <div className="c">{x.assistant}</div>
            </div>
          ))}
        </div>
      );
    case "empty":
      return <div className="mb-empty">{b.text}</div>;
    default:
      return null;
  }
}

function DocInner({ b }: { b: Exclude<MemoryBlock, { kind: "stats" | "timeline" | "doc" | "names" | "seating" | "events" | "cards" | "moneyTable" | "chat" | "empty" }> }) {
  switch (b.kind) {
    case "heading":
      return <h4>{b.text}</h4>;
    case "paragraph":
      return (
        <p>
          <Spans spans={b.spans} />
        </p>
      );
    case "quote":
      return (
        <blockquote>
          <Spans spans={b.spans} />
        </blockquote>
      );
    case "list": {
      const List = b.ordered ? "ol" : "ul";
      return (
        <List>
          {b.items.map((item, i) => (
            <li key={i}>
              <Spans spans={item} />
            </li>
          ))}
        </List>
      );
    }
    case "kv":
      return (
        <dl className="mb-kv">
          {b.rows.map((r, i) => (
            <div key={i} style={{ display: "contents" }}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      );
    case "table":
      return (
        <table className="mb-grid-table">
          <thead>
            <tr>
              {b.headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

function Chapter({ c, mode }: { c: MemoryChapter; mode: BookMode }) {
  return (
    <section id={`ch-${c.key}`} className="mb-chapter" data-chapter={c.key}>
      <div className="mb-head">
        <div className="mb-eyebrow">Chapter {c.number}</div>
        <h2>{c.title}</h2>
        {c.intro && <p className="mb-intro">{c.intro}</p>}
      </div>
      {c.blocks.map((b, i) => (
        <BlockView key={i} b={b} mode={mode} />
      ))}
      {c.photos.length > 0 && (
        <div className="mb-slots">
          {c.photos.map((p) => (
            <div key={p.slot} className={`mb-slot ${p.aspect}`}>
              {p.photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- plain <img>: this tree must stay free of next/* for the export
                <img src={p.photo.src} alt={p.photo.caption ?? p.label} />
              ) : (
                <>
                  <strong>Photo · {p.label}</strong>
                  <span>Add one when the photos arrive</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const SHORT_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function ChapterRail({ data, current }: { data: MemoryBookData; current?: string }) {
  return (
    <nav className="mb-rail" aria-label="Chapters">
      {PARTS.map((p) => {
        const chapters = data.chapters.filter((c) => c.part === p.key);
        if (!chapters.length) return null;
        return (
          <span key={p.key} style={{ display: "contents" }}>
            <a href={`#part-${p.key}`} className="part">
              {p.title}
            </a>
            {chapters.map((c) => (
              <a key={c.key} href={`#ch-${c.key}`} className={current === c.key ? "is-active" : undefined} data-chapter={c.key}>
                {c.title}
              </a>
            ))}
          </span>
        );
      })}
    </nav>
  );
}

export function MemoryBook({
  data,
  mode,
  actions,
}: {
  data: MemoryBookData;
  mode: BookMode;
  /** Buttons rendered on the cover (screen only). */
  actions?: React.ReactNode;
}) {
  const w = data.wedding;
  const cover = data.chapters[0]?.photos[0];
  return (
    <div className="memory-book">
      <div className="mb-inner">
        <header className="mb-cover" id="top">
          <div className="mb-cover-text">
            <div className="mb-eyebrow">Our wedding story</div>
            <h1>
              {w.groomFirst} <span className="amp">&amp;</span> {w.brideFirst}
            </h1>
            <p className="mb-when">
              {LONG_DATE.format(new Date(w.weddingDate))} · {w.venue}
            </p>
            <p className="mb-lede">
              {data.planning.daysOfPlanning != null
                ? `${data.planning.daysOfPlanning} days of planning, one day that went by in a blink. `
                : ""}
              Everything we planned, in three parts: before, the day, and after. Kept for the years when we want to remember how it came together.
            </p>
            {actions && <div className="mb-actions">{actions}</div>}
          </div>
          <div className="mb-slot portrait" style={{ minHeight: 360 }}>
            {cover?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- plain <img>: see above
              <img src={cover.photo.src} alt={cover.photo.caption ?? "Cover photo"} />
            ) : (
              <>
                <strong>Photo · the two of you</strong>
                <span>The cover. First thing on the page.</span>
              </>
            )}
          </div>
        </header>

        {mode === "screen" && <ChapterRail data={data} />}

        {PARTS.map((p, pi) => {
          const chapters = data.chapters.filter((c) => c.part === p.key);
          if (!chapters.length) return null;
          return (
            <div key={p.key} id={`part-${p.key}`}>
              <div className="mb-part">
                <div className="mb-eyebrow">Part {["I", "II", "III"][pi]}</div>
                <h2>{p.title}</h2>
                <p>{p.subtitle}</p>
              </div>
              {chapters.map((c) => (
                <Chapter key={c.key} c={c} mode={mode} />
              ))}
            </div>
          );
        })}

        <footer className="mb-colophon">
          <span>Made from Wedding Hub v{data.appVersion}</span>
          <span>·</span>
          <span>Built {SHORT_DATE.format(new Date(data.generatedAt))}</span>
          <span>·</span>
          <span>{w.coupleLabel}</span>
          {data.moneyIncluded && <span>· includes costs</span>}
        </footer>
      </div>
    </div>
  );
}
