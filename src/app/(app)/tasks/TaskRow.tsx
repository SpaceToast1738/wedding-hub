"use client";

import { useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/StatusPill";
import { setTaskStatus } from "./actions";
import { formatRelativeDue } from "@/lib/format";

type Task = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  assigneeId: string | null;
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

const NEXT_STATUS: Record<string, string> = {
  OPEN: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  WAITING: "DONE",
  DONE: "OPEN",
  ARCHIVED: "OPEN",
};

// v1.27.0: row click opens the TaskDrawer for editing. v1.27.4: row
// keeps the done-circle (per the user's "anything added can stay")
// and the category cell on the right. The done-circle stops
// propagation so it can cycle status without opening the drawer.
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
  const category = task.tags[0];

  function toggleStatus(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canEdit) return;
    const next = NEXT_STATUS[task.status] ?? "DONE";
    startTransition(async () => {
      await setTaskStatus(task.id, next as Parameters<typeof setTaskStatus>[1]);
    });
  }

  return (
    <li
      onClick={onOpen}
      className="flex items-center gap-5 px-4 py-2.5 border-b border-border-soft last:border-b-0 hover:bg-muted/40 cursor-pointer"
    >
      <button
        type="button"
        onClick={toggleStatus}
        disabled={!canEdit || pending}
        title={canEdit ? "Cycle status" : undefined}
        className="flex-shrink-0 cursor-pointer disabled:cursor-default"
        aria-label={`Mark ${task.title} ${isDone ? "open" : "done"}`}
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
        <span className="text-xs text-ink-tertiary w-24 text-right">
          {formatRelativeDue(task.dueDate)}
        </span>
        <span className="w-24 text-center">
          {category ? (
            <span className="text-[10px] text-ink-tertiary bg-canvas border border-border-soft px-1.5 py-px rounded-md inline-block max-w-full truncate">
              {category}
            </span>
          ) : null}
        </span>
      </div>
    </li>
  );
}
