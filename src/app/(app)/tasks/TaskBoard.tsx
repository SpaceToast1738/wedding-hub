"use client";

import { useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { setTaskStatus } from "./actions";
import { formatRelativeDue } from "@/lib/format";
import type { UserOpt } from "./TaskForm";

type Task = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: Date | null;
  tags: string[];
};

const COLUMNS: { id: "OPEN" | "IN_PROGRESS" | "DONE"; label: string; tone: string }[] = [
  { id: "OPEN", label: "To do", tone: "border-l-ink-tertiary" },
  { id: "IN_PROGRESS", label: "Doing", tone: "border-l-marigold-500" },
  { id: "DONE", label: "Done", tone: "border-l-moss-500" },
];

const PRIORITY_DOT: Record<string, string> = {
  HIGH: "bg-danger",
  URGENT: "bg-danger",
  MEDIUM: "bg-warning",
  LOW: "bg-moss-300",
};

// Map a task's status to the column it lives in. WAITING shows alongside
// IN_PROGRESS so the board has only three columns; ARCHIVED is hidden.
function columnFor(status: string): "OPEN" | "IN_PROGRESS" | "DONE" | null {
  if (status === "OPEN") return "OPEN";
  if (status === "IN_PROGRESS" || status === "WAITING") return "IN_PROGRESS";
  if (status === "DONE") return "DONE";
  return null;
}

export function TaskBoard({
  tasks,
  users,
  canEdit,
}: {
  tasks: Task[];
  users: UserOpt[];
  canEdit: boolean;
}) {
  const usersById = new Map(users.map((u) => [u.id, u]));
  const grouped: Record<string, Task[]> = { OPEN: [], IN_PROGRESS: [], DONE: [] };
  for (const t of tasks) {
    const col = columnFor(t.status);
    if (col) grouped[col]!.push(t);
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-[1200px] mx-auto p-4 sm:p-6">
        <div className="grid gap-3 md:grid-cols-3">
          {COLUMNS.map((c) => (
            <div
              key={c.id}
              className={`bg-canvas border border-border-soft border-l-4 ${c.tone} rounded-md p-3 min-h-[200px]`}
            >
              <div className="flex items-baseline justify-between mb-3 px-1">
                <h3 className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
                  {c.label}
                </h3>
                <span className="text-[11px] text-ink-tertiary tabular-nums">
                  {grouped[c.id]?.length ?? 0}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {(grouped[c.id] ?? []).map((t) => {
                  const assignee = t.assigneeId ? usersById.get(t.assigneeId) : null;
                  return (
                    <BoardCard
                      key={t.id}
                      task={t}
                      assignee={assignee ?? null}
                      canEdit={canEdit}
                    />
                  );
                })}
                {(grouped[c.id]?.length ?? 0) === 0 && (
                  <li className="text-[11px] text-ink-tertiary italic text-center py-6">
                    Empty
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BoardCard({
  task,
  assignee,
  canEdit,
}: {
  task: Task;
  assignee: UserOpt | null;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function moveTo(status: "OPEN" | "IN_PROGRESS" | "DONE") {
    startTransition(async () => {
      await setTaskStatus(task.id, status);
    });
  }

  const priorityDot = PRIORITY_DOT[task.priority] ?? "bg-ink-tertiary";
  const due = formatRelativeDue(task.dueDate);
  const isOverdue = task.dueDate && task.status !== "DONE" && task.dueDate.getTime() < Date.now();

  return (
    <li className={`bg-surface border border-border-soft rounded-md p-2.5 shadow-sm hover:shadow-md transition-shadow ${pending ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-2 mb-1.5">
        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${priorityDot} flex-shrink-0`} />
        <span className="text-sm text-ink-primary flex-1 leading-snug">{task.title}</span>
      </div>
      {(due || assignee || task.tags.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap pl-3.5">
          {due && (
            <span
              className={`text-[10px] ${isOverdue ? "text-danger font-semibold" : "text-ink-tertiary"}`}
            >
              {due}
            </span>
          )}
          {task.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[10px] text-ink-tertiary bg-canvas border border-border-soft px-1 rounded"
            >
              {tag}
            </span>
          ))}
          <span className="flex-1" />
          {assignee && (
            <Avatar name={assignee.name ?? assignee.email} size={18} />
          )}
        </div>
      )}
      {canEdit && (
        <div className="flex gap-1 mt-2 pl-3.5">
          {task.status !== "OPEN" && (
            <button
              type="button"
              onClick={() => moveTo("OPEN")}
              disabled={pending}
              className="text-[10px] px-1.5 py-0.5 rounded bg-canvas border border-border-soft text-ink-tertiary hover:text-ink-primary"
              title="Move to To do"
            >
              ← To do
            </button>
          )}
          {task.status !== "IN_PROGRESS" && task.status !== "WAITING" && (
            <button
              type="button"
              onClick={() => moveTo("IN_PROGRESS")}
              disabled={pending}
              className="text-[10px] px-1.5 py-0.5 rounded bg-canvas border border-border-soft text-ink-tertiary hover:text-marigold-700"
              title="Move to Doing"
            >
              ⇨ Doing
            </button>
          )}
          {task.status !== "DONE" && (
            <button
              type="button"
              onClick={() => moveTo("DONE")}
              disabled={pending}
              className="text-[10px] px-1.5 py-0.5 rounded bg-canvas border border-border-soft text-ink-tertiary hover:text-moss-700"
              title="Mark done"
            >
              ✓ Done
            </button>
          )}
        </div>
      )}
    </li>
  );
}
