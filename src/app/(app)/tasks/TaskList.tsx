"use client";

import { useMemo, useState } from "react";
import { TaskRow } from "./TaskRow";
import { FilterTabs, type Filter } from "./FilterTabs";
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
  notes: string | null;
  questionAnswer: string | null;
};

export function TaskList({
  tasks,
  users,
  currentUserId,
  canEdit,
}: {
  tasks: Task[];
  users: UserOpt[];
  currentUserId: string;
  canEdit: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const usersById = useMemo(() => {
    const m = new Map<string, UserOpt>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === "mine") return t.assigneeId === currentUserId && t.status !== "DONE";
      if (filter === "open") return t.status !== "DONE" && t.status !== "ARCHIVED";
      if (filter === "done") return t.status === "DONE";
      return true;
    });
  }, [tasks, filter, currentUserId]);

  return (
    <>
      <FilterTabs value={filter} onChange={setFilter} />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {filtered.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              No tasks match this filter.
            </p>
          ) : (
            <ol className="bg-surface border border-border-soft rounded-md shadow-sm">
              {filtered.map((t) => {
                const assignee = t.assigneeId ? usersById.get(t.assigneeId) : null;
                return (
                  <TaskRow
                    key={t.id}
                    task={t}
                    users={users}
                    canEdit={canEdit}
                    assigneeName={assignee?.name ?? assignee?.email ?? null}
                  />
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
