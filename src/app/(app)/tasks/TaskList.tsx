"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyTasks, EmptyState } from "@/components/ui/Illustrations";
import { TaskRow } from "./TaskRow";
import { TaskBoard } from "./TaskBoard";
import { FilterTabs, type Filter, type View } from "./FilterTabs";
import type { UserOpt } from "./TaskForm";

const VIEW_KEY = "wh_tasks_view";

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
  const [view, setView] = useState<View>("list");
  // v1.21.0: sticky search across title + tags + notes. Transient
  // (not persisted to localStorage) — search queries are usually
  // ad-hoc and a stale query on next visit would surprise.
  const [search, setSearch] = useState("");

  // Restore view preference. SSR renders 'list' so the markup stays stable.
  // v1.17.0: also force list view on narrow viewports — the kanban board
  // can't be used on touch (no drag) and the columns crush at <640px.
  // The user's localStorage preference is preserved; if they grow the
  // window back to desktop the next visit resumes their saved view.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "list" || saved === "board") {
        const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
        setView(isMobile ? "list" : saved);
      }
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  const usersById = useMemo(() => {
    const m = new Map<string, UserOpt>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filter === "mine") {
        if (t.assigneeId !== currentUserId || t.status === "DONE") return false;
      } else if (filter === "open") {
        if (t.status === "DONE" || t.status === "ARCHIVED") return false;
      } else if (filter === "done") {
        if (t.status !== "DONE") return false;
      }
      if (term) {
        const hay = `${t.title} ${t.tags.join(" ")} ${t.notes ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [tasks, filter, currentUserId, search]);

  return (
    <>
      {/* v1.21.0: sticky search bar above the FilterTabs. Search is
          transient (not persisted), so the bar resets to empty on each
          visit. Plays nicely with the existing filter + view toggles. */}
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-border-soft px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks (title, tags, notes)…"
            aria-label="Search tasks"
            className="flex-1 text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-3 py-1.5 outline-none focus:border-moss-500"
          />
          {search.trim() && (
            <span className="text-[11px] text-ink-tertiary tabular-nums whitespace-nowrap">
              {filtered.length}/{tasks.length}
            </span>
          )}
          {search.trim() && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-xs text-ink-tertiary hover:text-ink-primary px-1.5"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <FilterTabs value={filter} onChange={setFilter} view={view} onViewChange={setView} />
      {view === "board" ? (
        <TaskBoard tasks={filtered} users={users} canEdit={canEdit} />
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto p-6">
            {filtered.length === 0 ? (
              <EmptyState
                illustration={EmptyTasks}
                title="Nothing on this list"
                body="Try a different filter, or add a task with the C shortcut anywhere in the app."
              />
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
      )}
    </>
  );
}
