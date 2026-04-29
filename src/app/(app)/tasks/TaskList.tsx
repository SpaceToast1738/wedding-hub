"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyTasks, EmptyState } from "@/components/ui/Illustrations";
import { TaskRow } from "./TaskRow";
import { TaskBoard } from "./TaskBoard";
import { FilterTabs, type Filter, type View } from "./FilterTabs";
import { TaskDrawer } from "./TaskDrawer";
import type { UserOpt } from "./TaskForm";
import type { CustomFieldDef } from "@/lib/custom-fields";

const VIEW_KEY = "wh_tasks_view";
const SORT_KEY = "wh_tasks_sort";

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

// v1.27.0: explicit sort options. Pre-fix the page sorted by
// status → priority → dueDate fixed in the server query, with no UI
// affordance to change. Now the user can pick from five common
// sorts. Default: smart-default (status DONE last, then priority,
// then dueDate ascending).
type SortKey = "smart" | "due" | "priority" | "title" | "assignee" | "created";
const SORT_LABELS: Record<SortKey, string> = {
  smart: "Smart",
  due: "Due date",
  priority: "Priority",
  title: "Title",
  assignee: "Assignee",
  created: "Newest",
};

function priorityRank(p: string): number {
  if (p === "URGENT") return 0;
  if (p === "HIGH") return 1;
  if (p === "MEDIUM") return 2;
  return 3;
}

export function TaskList({
  tasks,
  users,
  currentUserId,
  canEdit,
  customFieldDefs = [],
}: {
  tasks: Task[];
  users: UserOpt[];
  currentUserId: string;
  canEdit: boolean;
  customFieldDefs?: CustomFieldDef[];
}) {
  void customFieldDefs; // v1.27.0: drawer doesn't render custom fields yet
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("list");
  const [sortKey, setSortKey] = useState<SortKey>("smart");
  const [search, setSearch] = useState("");
  // v1.27.0: drawer holds the id of the focused task — null when
  // nothing's open. Click any row to open; ESC / × / backdrop close.
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Restore preferences. SSR renders defaults so the markup stays stable.
  useEffect(() => {
    try {
      const savedView = localStorage.getItem(VIEW_KEY);
      if (savedView === "list" || savedView === "board") {
        const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
        setView(isMobile ? "list" : savedView);
      }
      const savedSort = localStorage.getItem(SORT_KEY);
      if (savedSort && (Object.keys(SORT_LABELS) as SortKey[]).includes(savedSort as SortKey)) {
        setSortKey(savedSort as SortKey);
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
  useEffect(() => {
    try {
      localStorage.setItem(SORT_KEY, sortKey);
    } catch {
      // ignore
    }
  }, [sortKey]);

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

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortKey) {
      case "due":
        list.sort((a, b) => {
          const ad = a.dueDate?.getTime() ?? Infinity;
          const bd = b.dueDate?.getTime() ?? Infinity;
          return ad - bd;
        });
        break;
      case "priority":
        list.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
        break;
      case "title":
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "assignee":
        list.sort((a, b) => {
          const an = a.assigneeId ? usersById.get(a.assigneeId)?.name ?? "" : "~";
          const bn = b.assigneeId ? usersById.get(b.assigneeId)?.name ?? "" : "~";
          return an.localeCompare(bn);
        });
        break;
      case "created":
        // Tasks list comes from the server already in createdAt-desc
        // when status ties. Fall back to id (cuid is roughly time-
        // ordered) for client-side determinism.
        list.sort((a, b) => b.id.localeCompare(a.id));
        break;
      case "smart":
      default:
        list.sort((a, b) => {
          // Done last, then priority, then due ascending.
          const ad = a.status === "DONE" ? 1 : 0;
          const bd = b.status === "DONE" ? 1 : 0;
          if (ad !== bd) return ad - bd;
          const pr = priorityRank(a.priority) - priorityRank(b.priority);
          if (pr !== 0) return pr;
          const adue = a.dueDate?.getTime() ?? Infinity;
          const bdue = b.dueDate?.getTime() ?? Infinity;
          return adue - bdue;
        });
    }
    return list;
  }, [filtered, sortKey, usersById]);

  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) : null;

  return (
    <>
      {/* v1.27.0: control row — search · filter pills · sort · view.
          Pre-fix the search bar floated alone at the top in its own
          sticky band, with the FilterTabs row separate. Now they
          live together in one tidier strip. */}
      <div className="px-6 pt-3 pb-1 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
              className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-md pl-8 pr-7 py-1.5 outline-none focus:border-moss-500"
            />
            <span
              aria-hidden="true"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary text-sm leading-none"
            >
              ⌕
            </span>
            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary text-sm leading-none"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          {search.trim() && (
            <span className="text-[11px] text-ink-tertiary tabular-nums whitespace-nowrap">
              {filtered.length}/{tasks.length}
            </span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <label className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
              Sort
            </label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="text-xs bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <FilterTabs value={filter} onChange={setFilter} view={view} onViewChange={setView} />
      {view === "board" ? (
        <TaskBoard tasks={sorted} users={users} canEdit={canEdit} />
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto p-6">
            {sorted.length === 0 ? (
              <EmptyState
                illustration={EmptyTasks}
                title="Nothing on this list"
                body="Try a different filter, or add a task with the C shortcut anywhere in the app."
              />
            ) : (
              <ol className="bg-surface border border-border-soft rounded-md shadow-sm">
                {sorted.map((t) => {
                  const assignee = t.assigneeId ? usersById.get(t.assigneeId) : null;
                  return (
                    <TaskRow
                      key={t.id}
                      task={t}
                      canEdit={canEdit}
                      assigneeName={assignee?.name ?? assignee?.email ?? null}
                      onOpen={() => setOpenTaskId(t.id)}
                    />
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
      {openTask && (
        <TaskDrawer
          task={openTask}
          users={users}
          canEdit={canEdit}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </>
  );
}
