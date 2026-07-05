"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setTaskStatus } from "@/app/(app)/tasks/actions";
import { notify } from "@/lib/notify";
import { priorityBarColour } from "./priority-colour";

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

// How long a just-completed row stays visible (struck-through, with
// an Undo link) before it's actually removed from the list.
const UNDO_WINDOW_MS = 5_000;

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
// 2026). Now clicking the box fires `setTaskStatus(id, "DONE")` and
// shows a toast on success/failure.
//
// v2.5.x: ticking used to hide the row instantly with no way back —
// a mis-tap meant re-finding the task on /tasks to undo it. Now the
// row stays rendered (struck-through, dimmed) for a few seconds with
// an inline Undo link before it's actually removed from the list.
//
// The Today page is a server component; this client island handles
// the local state + action call so the rest of the dashboard stays
// server-rendered.
export function TodayTaskList({ tasks }: { tasks: Task[] }) {
  // `completed` drives the struck-through/Undo visual; `removed` is
  // what actually drops a row from the list, applied after the undo
  // window elapses (or immediately if the action fails).
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Pending removal timers, keyed by task id, so Undo can cancel one
  // before it fires.
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Clear any outstanding removal timers on unmount (e.g. navigating
  // away mid-undo-window) so we don't call setState on a gone component.
  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      timerMap.forEach((timer) => clearTimeout(timer));
      timerMap.clear();
    };
  }, []);

  function complete(id: string, title: string) {
    setCompleted((prev) => new Set(prev).add(id));
    setPendingId(id);
    startTransition(async () => {
      try {
        await setTaskStatus(id, "DONE");
        notify("success", `Marked "${title}" done`);
        const timer = setTimeout(() => {
          setRemoved((prev) => new Set(prev).add(id));
          timers.current.delete(id);
        }, UNDO_WINDOW_MS);
        timers.current.set(id, timer);
      } catch (err) {
        // Revert the strikethrough on failure — nothing to undo.
        setCompleted((prev) => {
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

  function undo(id: string, title: string) {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setCompleted((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    startTransition(async () => {
      try {
        await setTaskStatus(id, "OPEN");
        notify("success", `Reopened "${title}"`);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't undo");
      }
    });
  }

  const visible = tasks.filter((t) => !removed.has(t.id));

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
        const isDone = completed.has(t.id);
        return (
          <li key={t.id} className="flex items-center gap-3">
            <span
              className={[
                "w-1 h-7 rounded flex-shrink-0",
                priorityBarColour(t.priority),
              ].join(" ")}
              aria-hidden
            />
            {/* v2.5.x: the bare ~16px checkbox was well under the
                40px touch-target floor. Wrapping it in a label with
                padding cancelled by a matching negative margin grows
                the tappable area without shifting the visible layout
                (mobile only — desktop pointers don't need the slack). */}
            <label className="p-2.5 -m-2.5 sm:p-0 sm:m-0 flex-shrink-0 cursor-pointer flex items-center justify-center">
              <input
                type="checkbox"
                checked={isDone}
                onChange={() => complete(t.id, t.title)}
                disabled={isPending || isDone}
                className="cursor-pointer accent-moss-500 disabled:cursor-wait disabled:opacity-50"
                aria-label={`Mark "${t.title}" done`}
              />
            </label>
            <span
              className={[
                "text-sm flex-1 min-w-0 truncate",
                isDone ? "text-ink-tertiary line-through opacity-60" : "text-ink-primary",
              ].join(" ")}
            >
              {t.title}
              {t.topics && t.topics.length > 0 && (
                <span className="ml-2 text-[10px] text-moss-700">
                  {t.topics.slice(0, 2).join(" · ")}
                  {t.topics.length > 2 && ` +${t.topics.length - 2}`}
                </span>
              )}
            </span>
            {isDone ? (
              <button
                type="button"
                onClick={() => undo(t.id, t.title)}
                className="text-xs flex-shrink-0 font-medium text-moss-700 hover:underline"
              >
                Undo
              </button>
            ) : (
              <span
                className={[
                  "text-xs flex-shrink-0 tabular-nums",
                  overdue ? "text-danger font-medium" : "text-ink-tertiary",
                ].join(" ")}
              >
                {formatDue(t.dueDate)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
