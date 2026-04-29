"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

// v1.30.5: section-level linked tasks panel. Renders above the section's
// cards on /book/[slug] and lists tasks/questions/decisions linked to
// this section via the m2m Topics relation. Per-section client-side
// search keeps the user inline. Empty list collapses entirely.
//
// Originally lived inside CardRouter as a per-card panel (v1.30.0). The
// link was relocated to the BookSection level in v1.30.5; this component
// followed the link upward and is now imported from the section page
// rather than rendered per-kind.
export type LinkedTask = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: Date | null;
};

export function LinkedTasksPanel({ tasks }: { tasks: LinkedTask[] }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return tasks;
    const t = search.trim().toLowerCase();
    return tasks.filter((x) => x.title.toLowerCase().includes(t));
  }, [tasks, search]);
  if (tasks.length === 0) return null;
  return (
    <div className="bg-canvas/40 border border-border-soft rounded-md">
      <div className="px-3 py-2 border-b border-border-soft flex items-baseline gap-2 flex-wrap">
        <strong className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
          Linked tasks
        </strong>
        <span className="text-[10px] text-ink-tertiary tabular-nums">
          {filtered.length}/{tasks.length}
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="ml-auto text-[11px] bg-surface text-ink-primary border border-border-soft rounded-sm px-1.5 py-0.5 outline-none focus:border-moss-500 max-w-[160px]"
        />
        <Link
          href="/tasks"
          className="text-[10px] text-info hover:underline"
        >
          Manage →
        </Link>
      </div>
      {filtered.length === 0 ? (
        <p className="px-3 py-2 text-xs text-ink-tertiary italic">No matches.</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {filtered.map((t) => (
            <li key={t.id} className="flex items-baseline gap-2 px-3 py-1.5 text-xs">
              <span className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider w-14 flex-shrink-0">
                {t.type === "TASK" ? "Task" : t.type === "QUESTION" ? "Q" : "Decision"}
              </span>
              <span className={[
                "flex-1 min-w-0 truncate",
                t.status === "DONE" ? "text-ink-tertiary line-through" : "text-ink-primary",
              ].join(" ")}>
                {t.title}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-ink-tertiary">
                {t.status.toLowerCase().replace("_", " ")}
              </span>
              {t.dueDate && (
                <span className="text-[10px] text-ink-tertiary tabular-nums">
                  {t.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
