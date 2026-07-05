"use client";

import { useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/StatusPill";
import { setTaskStatus } from "./actions";
import { notify } from "@/lib/notify";
import { formatRelativeDue } from "@/lib/format";

type Task = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  // v1.96.0: multi-assignee — parent passes a derived assigneeName
  // string for display; this row just needs the array length to
  // know the task exists (so id-only is fine).
  assignees: Array<{ id: string }>;
  dueDate: Date | null;
  tags: string[];
  notes: string | null;
  questionAnswer: string | null;
};

const PRIORITY_DOT: Record<string, string> = {
  HIGH: "bg-danger",
  URGENT: "bg-danger",
  MEDIUM: "bg-warning",
  LOW: "bg-moss-300",
};

const PRIORITY_LABEL: Record<string, "HIGH" | "MED" | "LOW"> = {
  URGENT: "HIGH",
  HIGH: "HIGH",
  MEDIUM: "MED",
  LOW: "LOW",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "TODO",
  IN_PROGRESS: "DOING",
  WAITING: "WAITING",
  DONE: "DONE",
  ARCHIVED: "ARCHIVED",
};

// v2.5.0 (CRITICAL #3): dropped the OPEN → IN_PROGRESS → DONE cycle —
// the circle looks and reads (via its aria-label) like a checkbox, so
// a tap silently landing on IN_PROGRESS instead of DONE was surprising.
// It's now a straight DONE/OPEN toggle; the full status cycle
// (OPEN/IN_PROGRESS/WAITING) lives exclusively in the drawer's Status
// chip row. See TaskDrawer.tsx's STATUS_OPTIONS.

// v2.5.0 (mod #4): the Category column/pill system was dead UI — the
// field was dropped from the write path back in v1.96.0 (see
// actions.ts's createTask/updateTask comments) but the read side
// (this row's category cell, TaskList's category pills + GroupKey
// option) was never cleaned up. Removed here to make room for the
// mobile meta line below.

// v1.27.0: row click opens the TaskDrawer for editing. The done-circle
// stops propagation so it can toggle status without opening the drawer.
export function TaskRow({
  task,
  canEdit,
  assigneeName,
  onOpen,
}: {
  task: Task;
  canEdit: boolean;
  assigneeName: string | null;
  onOpen: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const isDone = task.status === "DONE";
  // v2.5.0 (CRITICAL #2): same overdue definition as TaskBoard's
  // BoardCard — due in the past AND not already done.
  const isOverdue = !!task.dueDate && !isDone && task.dueDate.getTime() < Date.now();

  function toggleDone(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canEdit) return;
    const next = isDone ? "OPEN" : "DONE";
    startTransition(async () => {
      try {
        await setTaskStatus(task.id, next as Parameters<typeof setTaskStatus>[1]);
      } catch (err) {
        // Silent failures here read as "nothing happened" — surface it.
        notify("error", err instanceof Error ? err.message : "Couldn't update status");
      }
    });
  }

  return (
    <li
      onClick={onOpen}
      className="flex items-center gap-5 px-4 py-2.5 border-b border-border-soft last:border-b-0 hover:bg-muted/40 cursor-pointer"
    >
      <button
        type="button"
        onClick={toggleDone}
        disabled={!canEdit || pending}
        title={canEdit ? (isDone ? "Mark not done" : "Mark done") : undefined}
        // v2.5.0 (CRITICAL #3): -m-3.5 p-3.5 pads the tap target out to
        // ~44px without moving the visible 16px circle or widening the
        // row (negative margin cancels the padding's layout footprint).
        className="flex-shrink-0 -m-3.5 p-3.5 cursor-pointer disabled:cursor-default"
        aria-label={`Mark ${task.title} ${isDone ? "not done" : "done"}`}
      >
        <span
          className={[
            "inline-block w-4 h-4 rounded-full border-2",
            isDone ? "bg-moss-500 border-moss-500" : "border-border-strong",
          ].join(" ")}
        />
      </button>
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] ?? "bg-moss-300"}`}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {task.type === "QUESTION" && (
            <span className="text-[10px] font-bold text-info bg-[color:#eef4f5] dark:bg-muted px-1 rounded flex-shrink-0">
              ?
            </span>
          )}
          {task.type === "DECISION" && (
            <span className="text-[10px] font-bold text-marigold-700 bg-marigold-100 px-1 rounded flex-shrink-0">
              △
            </span>
          )}
          <span
            className={[
              "text-sm flex-1 truncate",
              isDone ? "line-through text-ink-tertiary" : "text-ink-primary",
            ].join(" ")}
          >
            {task.title}
          </span>
        </div>
        {task.questionAnswer && (
          <p className="text-xs text-ink-tertiary mt-1 italic">{task.questionAnswer}</p>
        )}
        {/* v2.5.0 (CRITICAL #1): the desktop meta strip below is
            `hidden` under sm, which used to drop due date / status /
            assignee entirely on mobile. Compact one-line summary,
            visible only below sm (the desktop strip covers >=sm). */}
        <div className="flex sm:hidden items-center gap-2 flex-wrap mt-1">
          {task.dueDate && (
            <span
              className={[
                "text-[11px]",
                isOverdue ? "text-danger font-semibold" : "text-ink-tertiary",
              ].join(" ")}
            >
              {formatRelativeDue(task.dueDate)}
            </span>
          )}
          <span className="text-[10px] uppercase tracking-wider text-ink-tertiary bg-canvas border border-border-soft rounded-md px-1.5 py-0.5">
            {STATUS_LABEL[task.status] ?? task.status}
          </span>
          {assigneeName && (
            <span className="text-[11px] text-ink-secondary">
              {assigneeName.split(" ")[0]}
            </span>
          )}
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
        {assigneeName ? (
          <span className="flex items-center gap-1.5 w-32">
            <Avatar name={assigneeName} size={20} />
            <span className="text-xs text-ink-secondary truncate">
              {assigneeName.split(" ")[0]}
            </span>
          </span>
        ) : (
          <span className="w-32" />
        )}
        <span className="w-16 flex justify-center">
          <StatusPill status={PRIORITY_LABEL[task.priority] ?? "LOW"} size="sm" />
        </span>
        <span className="text-[10px] uppercase tracking-wider text-ink-tertiary bg-canvas border border-border-soft rounded-md px-2 py-0.5 w-24 text-center">
          {STATUS_LABEL[task.status] ?? task.status}
        </span>
        {/* v2.5.0 (CRITICAL #2): overdue due dates were plain
            text-ink-tertiary — the lowest-contrast token, with no
            visual distinction from a normal due date. Danger + bold
            now matches TaskBoard's BoardCard treatment. */}
        <span
          className={[
            "text-xs w-24 text-right",
            isOverdue ? "text-danger font-semibold" : "text-ink-tertiary",
          ].join(" ")}
        >
          {formatRelativeDue(task.dueDate)}
        </span>
      </div>
    </li>
  );
}
