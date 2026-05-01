"use client";

import { useState, useTransition } from "react";
import { setTaskStatus } from "@/app/(app)/tasks/actions";
import { notify } from "@/lib/notify";

type Task = {
  id: string;
  title: string;
  priority: string;
  dueDate: Date | null;
  // v1.57.0 (XL10): topic chips so daily-glance items carry the
  // "what's this about" context — Wedding Book section names + nav
  // tag names. Optional so older callers don't break.
  topics?: string[];
};

// Per-priority dot colour — moss for HIGH/URGENT, marigold for MEDIUM,
// muted for LOW. Matches the StatusPill palette without the box.
function priorityDotColour(p: string): string {
  if (p === "URGENT" || p === "HIGH") return "bg-marigold-700";
  if (p === "MEDIUM") return "bg-marigold-500";
  return "bg-border-strong";
}

function formatDue(due: Date | null): string {
  if (!due) return "no due date";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0)
    return `Overdue · ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7)
    return due.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return due.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// v1.27.2: replaces the disabled-checkbox stub on the Today page with
// a working tick. Pre-fix the box was disabled with an aria hint
// "open Tasks page to toggle" — a friction the user reported (29 Apr
// 2026). Now clicking the box fires `setTaskStatus(id, "DONE")`,
// optimistically hides the row from the list, and shows a toast on
// success/failure.
//
// The Today page is a server component; this client island handles
// the local state + action call so the rest of the dashboard stays
// server-rendered.
export function TodayTaskList({ tasks }: { tasks: Task[] }) {
  // Local-state copy lets us hide a task instantly on tick without
  // waiting for revalidation. If the action fails we revert.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(id: string, title: string) {
    setHidden((prev) => new Set(prev).add(id));
    setPendingId(id);
    startTransition(async () => {
      try {
        await setTaskStatus(id, "DONE");
        notify("success", `Marked "${title}" done`);
      } catch (err) {
        // Revert local hide on failure.
        setHidden((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        notify("error", err instanceof Error ? err.message : "Couldn't update");
      } finally {
        setPendingId((cur) => (cur === id ? null : cur));
      }
    });
  }

  const visible = tasks.filter((t) => !hidden.has(t.id));

  if (visible.length === 0) {
    return (
      <p className="text-sm text-ink-tertiary py-6 text-center flex-1">
        Nothing on your plate. Nice.
      </p>
    );
  }

  return (
    <ul className="flex-1 space-y-2.5">
      {visible.map((t) => {
        const overdue = t.dueDate && t.dueDate < new Date();
        const isPending = pendingId === t.id;
        return (
          <li key={t.id} className="flex items-center gap-3">
            <span
              className={[
                "w-1 h-7 rounded flex-shrink-0",
                priorityDotColour(t.priority),
              ].join(" ")}
              aria-hidden
            />
            <input
              type="checkbox"
              checked={false}
              onChange={() => toggle(t.id, t.title)}
              disabled={isPending}
              className="cursor-pointer accent-moss-500 flex-shrink-0 disabled:cursor-wait disabled:opacity-50"
              aria-label={`Mark "${t.title}" done`}
            />
            <span className="text-sm text-ink-primary flex-1 min-w-0 truncate">
              {t.title}
              {t.topics && t.topics.length > 0 && (
                <span className="ml-2 text-[10px] text-moss-700">
                  {t.topics.slice(0, 2).join(" · ")}
                  {t.topics.length > 2 && ` +${t.topics.length - 2}`}
                </span>
              )}
            </span>
            <span
              className={[
                "text-xs flex-shrink-0 tabular-nums",
                overdue ? "text-danger font-medium" : "text-ink-tertiary",
              ].join(" ")}
            >
              {formatDue(t.dueDate)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
