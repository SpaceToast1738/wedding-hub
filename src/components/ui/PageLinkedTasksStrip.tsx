// v1.52.0: reusable "tasks linked to this page" strip.
//
// Backlog #7 — surfaces tasks tagged with a NavTag whose `route`
// matches the current page on /songs, /seating/ceremony, /guests
// (and any future page that wants the affordance). Reuses the
// existing NavTag infrastructure: each page already has a seeded
// nav tag (Music → /songs, Ceremony → /seating/ceremony, Guests →
// /guests), tasks are taggable via the existing TopicPicker.
//
// Server component — pages do the DB read inline and pass the
// rows in. The strip itself is presentational; it doesn't fetch.
//
// Hidden entirely when zero tasks match — pages where the couple
// hasn't linked anything yet stay clean. Layout matches the
// section-level LinkedTasksPanel from v1.30.5: compact list, type
// glyph + status pill + due date, "Manage →" deep-link.

import Link from "next/link";

export type StripTaskRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: Date | null;
};

function statusLabel(s: string): string {
  return s === "OPEN"
    ? "Open"
    : s === "IN_PROGRESS"
      ? "Doing"
      : s === "WAITING"
        ? "Waiting"
        : s === "DONE"
          ? "Done"
          : s === "ARCHIVED"
            ? "Archived"
            : s;
}

function statusClass(s: string): string {
  if (s === "DONE") return "text-moss-700 bg-moss-50 border-moss-300";
  if (s === "OPEN") return "text-marigold-700 bg-marigold-100/40 border-marigold-700/30";
  if (s === "IN_PROGRESS") return "text-info bg-canvas border-border-soft";
  if (s === "WAITING") return "text-ink-tertiary bg-canvas border-border-soft";
  return "text-ink-tertiary bg-canvas border-border-soft";
}

function typeBadge(t: string): string {
  return t === "QUESTION" ? "Q" : t === "DECISION" ? "D" : "·";
}

function dueLabel(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function PageLinkedTasksStrip({
  tasks,
  navTagName,
  manageHref = "/tasks",
}: {
  tasks: StripTaskRow[];
  /** Display label for the source nav tag, e.g. "Music" / "Guests". */
  navTagName: string;
  /** Deep link to the full task list. Defaults to /tasks. */
  manageHref?: string;
}) {
  if (tasks.length === 0) return null;
  // Bucket DONE tasks at the bottom and surface a count so a long
  // list of completed work doesn't crowd the active items.
  const open = tasks.filter((t) => t.status !== "DONE" && t.status !== "ARCHIVED");
  const done = tasks.filter((t) => t.status === "DONE" || t.status === "ARCHIVED");
  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm mx-auto max-w-5xl mt-3">
      <header className="px-4 py-1.5 border-b border-border-soft flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-ink-tertiary">
          Linked tasks · {navTagName}
        </span>
        <span className="text-[10px] text-ink-tertiary tabular-nums">
          {open.length} open
          {done.length > 0 && (
            <span className="text-ink-tertiary"> · {done.length} done</span>
          )}
        </span>
        <Link
          href={manageHref}
          className="ml-auto text-[10px] text-moss-700 hover:underline"
        >
          Manage →
        </Link>
      </header>
      <ul className="divide-y divide-border-soft text-sm">
        {[...open, ...done].map((t) => (
          <li key={t.id} className="px-4 py-1.5 flex items-center gap-2">
            <span className="text-[10px] font-mono text-ink-tertiary w-4 text-center">
              {typeBadge(t.type)}
            </span>
            <span
              className={`flex-1 min-w-0 truncate ${
                t.status === "DONE" || t.status === "ARCHIVED"
                  ? "text-ink-tertiary line-through"
                  : "text-ink-primary"
              }`}
            >
              {t.title}
            </span>
            <span
              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${statusClass(t.status)}`}
            >
              {statusLabel(t.status)}
            </span>
            {t.dueDate && (
              <span className="text-[10px] text-ink-tertiary tabular-nums whitespace-nowrap">
                {dueLabel(t.dueDate)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
