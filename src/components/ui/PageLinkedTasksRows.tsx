"use client";

import { useState, useTransition } from "react";
import { setTaskStatus } from "@/app/(app)/tasks/actions";
import type { StripTaskRow } from "./PageLinkedTasksStrip";

function statusLabel(s: string): string {
  if (s === "OPEN") return "Open";
  if (s === "IN_PROGRESS") return "Doing";
  if (s === "WAITING") return "Waiting";
  if (s === "DONE") return "Done";
  if (s === "ARCHIVED") return "Archived";
  return s;
}

function statusClass(s: string): string {
  if (s === "DONE") return "text-moss-700 bg-moss-50 border-moss-300";
  if (s === "OPEN") return "text-marigold-700 bg-marigold-100/40 border-marigold-700/30";
  if (s === "IN_PROGRESS") return "text-info bg-canvas border-border-soft";
  if (s === "WAITING") return "text-ink-tertiary bg-canvas border-border-soft";
  return "text-ink-tertiary bg-canvas border-border-soft";
}

function dueLabel(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function typeBadge(t: string): string {
  return t === "QUESTION" ? "Q" : t === "DECISION" ? "D" : "·";
}

function StripRow({ task, canEdit }: { task: StripTaskRow; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState(task.status);
  const isDone = optimisticStatus === "DONE" || optimisticStatus === "ARCHIVED";

  function toggle() {
    if (!canEdit) return;
    const next = isDone ? "OPEN" : "DONE";
    setOptimisticStatus(next);
    startTransition(async () => {
      await setTaskStatus(task.id, next as "OPEN" | "DONE");
    });
  }

  return (
    <li className="px-4 py-1.5 flex items-center gap-2">
      {canEdit ? (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`flex-shrink-0 w-3.5 h-3.5 rounded-sm border transition-colors ${
            isDone
              ? "bg-moss-500 border-moss-500 text-white"
              : "border-border-soft bg-surface hover:border-moss-400"
          } flex items-center justify-center disabled:opacity-50`}
          title={isDone ? "Mark as open" : "Mark as done"}
        >
          {isDone && (
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 3l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      ) : (
        <span className="text-[10px] font-mono text-ink-tertiary w-4 text-center flex-shrink-0">
          {typeBadge(task.type)}
        </span>
      )}
      <span
        className={`flex-1 min-w-0 truncate text-sm ${
          isDone ? "text-ink-tertiary line-through" : "text-ink-primary"
        }`}
      >
        {task.title}
      </span>
      <span
        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border flex-shrink-0 ${statusClass(optimisticStatus)}`}
      >
        {statusLabel(optimisticStatus)}
      </span>
      {task.dueDate && (
        <span className="text-[10px] text-ink-tertiary tabular-nums whitespace-nowrap flex-shrink-0">
          {dueLabel(task.dueDate)}
        </span>
      )}
    </li>
  );
}

export function PageLinkedTasksRows({
  tasks,
  canEdit,
}: {
  tasks: StripTaskRow[];
  canEdit: boolean;
}) {
  return (
    <ul className="divide-y divide-border-soft">
      {tasks.map((t) => (
        <StripRow key={t.id} task={t} canEdit={canEdit} />
      ))}
    </ul>
  );
}
