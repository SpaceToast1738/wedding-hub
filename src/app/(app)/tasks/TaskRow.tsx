"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { TaskForm, type UserOpt } from "./TaskForm";
import { deleteTask, setTaskStatus, updateTask } from "./actions";
import { formatRelativeDue, isoForInput } from "@/lib/format";
import type { CustomFieldDef } from "@/lib/custom-fields";

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
  customFieldValues?: Record<string, string | number | null> | null;
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

const NEXT_STATUS: Record<string, string> = {
  OPEN: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  WAITING: "DONE",
  DONE: "OPEN",
  ARCHIVED: "OPEN",
};

export function TaskRow({
  task,
  users,
  canEdit,
  assigneeName,
  customFieldDefs = [],
}: {
  task: Task;
  users: UserOpt[];
  canEdit: boolean;
  assigneeName: string | null;
  customFieldDefs?: CustomFieldDef[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const isDone = task.status === "DONE";
  const category = task.tags[0];

  function toggleStatus() {
    const next = NEXT_STATUS[task.status] ?? "DONE";
    startTransition(async () => {
      await setTaskStatus(task.id, next as Parameters<typeof setTaskStatus>[1]);
    });
  }

  function onDelete() {
    if (!confirm(`Delete "${task.title}"?`)) return;
    startTransition(async () => {
      await deleteTask(task.id);
    });
  }

  if (editing) {
    return (
      <li className="bg-surface border-y border-moss-100 px-4 py-3">
        <TaskForm
          users={users}
          submitLabel="Save"
          initial={{
            title: task.title,
            type: task.type,
            priority: task.priority,
            status: task.status,
            assigneeId: task.assigneeId,
            dueDate: isoForInput(task.dueDate),
            category: category ?? "",
            notes: task.notes ?? "",
          }}
          onSubmit={async (fd) => {
            await updateTask(task.id, fd);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          taskId={task.id}
          customFieldDefs={customFieldDefs}
          customFieldValues={task.customFieldValues ?? null}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 border-b border-border-soft last:border-b-0 hover:bg-muted/40 group">
      <button
        type="button"
        onClick={canEdit ? toggleStatus : undefined}
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
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] ?? "bg-moss-300"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {task.type === "QUESTION" && (
            <span className="text-[10px] font-bold text-info bg-[color:#eef4f5] dark:bg-muted px-1 rounded flex-shrink-0">?</span>
          )}
          {task.type === "DECISION" && (
            <span className="text-[10px] font-bold text-marigold-700 bg-marigold-100 px-1 rounded flex-shrink-0">△</span>
          )}
          <span
            className={[
              "text-sm flex-1 truncate",
              isDone ? "line-through text-ink-tertiary" : "text-ink-primary",
            ].join(" ")}
          >
            {task.title}
          </span>
          {category && (
            <span className="text-[10px] text-ink-tertiary bg-canvas border border-border-soft px-1.5 py-px rounded-md flex-shrink-0">
              {category}
            </span>
          )}
        </div>
        {task.questionAnswer && (
          <p className="text-xs text-ink-tertiary mt-1 italic">{task.questionAnswer}</p>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        {assigneeName && <Avatar name={assigneeName} size={20} />}
        <StatusPill status={PRIORITY_LABEL[task.priority] ?? "LOW"} size="sm" />
        <span className="text-xs text-ink-tertiary w-20 text-right">{formatRelativeDue(task.dueDate)}</span>
      </div>
      {canEdit && (
        // v1.17.0: hover-only fade on desktop (clean at-rest UI) but
        // always visible on touch (no hover state on mobile, so the
        // edit/delete actions were effectively invisible).
        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>Delete</Button>
        </div>
      )}
    </li>
  );
}
