"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyTasks, EmptyState } from "@/components/ui/Illustrations";
import { TaskRow } from "./TaskRow";
import { TaskBoard } from "./TaskBoard";
import { FilterTabs, type Filter, type View } from "./FilterTabs";
import { TaskDrawer } from "./TaskDrawer";
import type { UserOpt, SupplierOpt, BookSectionOpt, NavTagOpt } from "./TaskForm";
import type { CustomFieldDef } from "@/lib/custom-fields";

const VIEW_KEY = "wh_tasks_view";
const SORT_KEY = "wh_tasks_sort";
const GROUP_KEY = "wh_tasks_group";

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
  // v1.28.0: optional supplier link.
  supplierId: string | null;
  // v1.30.5: m2m topic relations replace v1.30.0's bookSubsectionId.
  bookSections: Array<{ id: string; title: string }>;
  navTags: Array<{ id: string; name: string }>;
};

type SortKey = "smart" | "due" | "priority" | "title" | "assignee" | "created";
const SORT_LABELS: Record<SortKey, string> = {
  smart: "Smart",
  due: "Due date",
  priority: "Priority",
  title: "Title",
  assignee: "Assignee",
  created: "Newest",
};

// v1.29.0: group-by buckets. "none" preserves the v1.27.x flat list.
// Each non-"none" bucket renders sectioned headers above the relevant
// rows; the user-facing labels match the existing pill / column copy.
// v1.30.5: "topic" added — buckets by the union of bookSections + navTags
// (a task in two topics appears in both buckets).
type GroupKey = "none" | "assignee" | "category" | "supplier" | "topic" | "priority" | "status";
const GROUP_LABELS: Record<GroupKey, string> = {
  none: "None",
  assignee: "Assignee",
  category: "Category",
  supplier: "Supplier",
  topic: "Topic",
  priority: "Priority",
  status: "Status",
};
// Static priority order so the group sections render Urgent → Low.
const PRIORITY_ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW"];
// Static status order so OPEN appears before DONE etc.
const STATUS_ORDER = ["OPEN", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"];
const STATUS_GROUP_LABEL: Record<string, string> = {
  OPEN: "TODO",
  IN_PROGRESS: "DOING",
  WAITING: "WAITING",
  DONE: "DONE",
  ARCHIVED: "ARCHIVED",
};

function priorityRank(p: string): number {
  if (p === "URGENT") return 0;
  if (p === "HIGH") return 1;
  if (p === "MEDIUM") return 2;
  return 3;
}

// v1.27.4: redesign visually to match the user-supplied mockup. Style
// changes only — features kept intact:
//   - List/Board moved from a pill toggle on FilterTabs to text-
//     underline tabs above the filter pill row (matches mockup).
//   - Filter pills become dynamic — predefined (All / Mine /
//     Questions / Done) plus one pill per distinct category tag from
//     the current task set + a "+ View" stub for saved-views (TODO).
//   - Search input + sort dropdown KEPT (the user said "anything
//     added can stay, I just want the same style"). They live in
//     the existing unified bg-surface band above the FilterTabs row.
//   - Per-row done-circle KEPT in TaskRow.
//   - Category column KEPT in TaskRow + header.
export function TaskList({
  tasks,
  users,
  suppliers = [],
  bookSections = [],
  navTags = [],
  currentUserId,
  canEdit,
  customFieldDefs = [],
}: {
  tasks: Task[];
  users: UserOpt[];
  // v1.28.0: optional list of suppliers for the supplier picker on the
  // task drawer. Empty array hides supplier UI.
  suppliers?: SupplierOpt[];
  // v1.30.5: lists for the Topics multi-select on the drawer.
  bookSections?: BookSectionOpt[];
  navTags?: NavTagOpt[];
  currentUserId: string;
  canEdit: boolean;
  customFieldDefs?: CustomFieldDef[];
}) {
  void customFieldDefs;
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("list");
  const [sortKey, setSortKey] = useState<SortKey>("smart");
  const [groupKey, setGroupKey] = useState<GroupKey>("none");
  const [search, setSearch] = useState("");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

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
      const savedGroup = localStorage.getItem(GROUP_KEY);
      if (savedGroup && (Object.keys(GROUP_LABELS) as GroupKey[]).includes(savedGroup as GroupKey)) {
        setGroupKey(savedGroup as GroupKey);
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
  useEffect(() => {
    try {
      localStorage.setItem(GROUP_KEY, groupKey);
    } catch {
      // ignore
    }
  }, [groupKey]);

  const usersById = useMemo(() => {
    const m = new Map<string, UserOpt>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  // v1.29.0: supplier lookup for the supplier-grouped renderer.
  const suppliersById = useMemo(() => {
    const m = new Map<string, SupplierOpt>();
    suppliers.forEach((s) => m.set(s.id, s));
    return m;
  }, [suppliers]);

  // v1.30.5: book-section / nav-tag lookups for the topic grouping.
  const bookSectionsById = useMemo(() => {
    const m = new Map<string, BookSectionOpt>();
    bookSections.forEach((s) => m.set(s.id, s));
    return m;
  }, [bookSections]);
  const navTagsById = useMemo(() => {
    const m = new Map<string, NavTagOpt>();
    navTags.forEach((t) => m.set(t.id, t));
    return m;
  }, [navTags]);

  // v1.27.4: distinct categories from `tags[0]` (the convention the
  // rest of the app uses for "primary category"). Sorted alphabetically
  // so the pill order is stable across renders.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      const cat = t.tags[0];
      if (cat) set.add(cat);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((t) => {
      // v1.27.4: filter is now a string, not an enum.
      if (filter === "all") {
        if (t.status === "ARCHIVED") return false;
      } else if (filter === "mine") {
        if (t.assigneeId !== currentUserId) return false;
        if (t.status === "DONE" || t.status === "ARCHIVED") return false;
      } else if (filter === "questions") {
        if (t.type !== "QUESTION" && t.type !== "DECISION") return false;
      } else if (filter === "done") {
        if (t.status !== "DONE") return false;
      } else if (filter.startsWith("cat:")) {
        const cat = filter.slice(4);
        if (t.tags[0] !== cat) return false;
        if (t.status === "ARCHIVED") return false;
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
        list.sort((a, b) => b.id.localeCompare(a.id));
        break;
      case "smart":
      default:
        list.sort((a, b) => {
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

  // v1.29.0: split sorted rows into ordered group sections. When
  // groupKey is "none" we still produce a single synthetic section
  // so the render path stays unified. Each section keeps the rows
  // in the parent `sorted` order — grouping is orthogonal to sort.
  const groups = useMemo<{ key: string; label: string; tasks: Task[] }[]>(() => {
    if (groupKey === "none") {
      return [{ key: "all", label: "", tasks: sorted }];
    }
    const buckets = new Map<string, { key: string; label: string; tasks: Task[]; rank: number }>();
    const bump = (key: string, label: string, t: Task, rank: number) => {
      let b = buckets.get(key);
      if (!b) {
        b = { key, label, tasks: [], rank };
        buckets.set(key, b);
      }
      b.tasks.push(t);
    };
    for (const t of sorted) {
      switch (groupKey) {
        case "assignee": {
          if (t.assigneeId) {
            const u = usersById.get(t.assigneeId);
            const label = u?.name ?? u?.email ?? "Unknown";
            bump(`u:${t.assigneeId}`, label, t, 0);
          } else {
            bump("u:null", "Unassigned", t, 1);
          }
          break;
        }
        case "category": {
          const cat = t.tags[0];
          if (cat) bump(`c:${cat}`, cat, t, 0);
          else bump("c:null", "Uncategorised", t, 1);
          break;
        }
        case "supplier": {
          if (t.supplierId) {
            const s = suppliersById.get(t.supplierId);
            const label = s ? `${s.name}${s.category ? ` · ${s.category}` : ""}` : "Unknown supplier";
            bump(`s:${t.supplierId}`, label, t, 0);
          } else {
            bump("s:null", "No supplier", t, 1);
          }
          break;
        }
        case "topic": {
          // v1.30.5: union of book sections + nav tags. A task in two
          // topics appears in both buckets.
          if (t.bookSections.length === 0 && t.navTags.length === 0) {
            bump("topic:null", "No topic", t, 99);
          } else {
            for (const s of t.bookSections) {
              const label = bookSectionsById.get(s.id)?.title ?? s.title;
              bump(`topic:bs:${s.id}`, label, t, 0);
            }
            for (const tg of t.navTags) {
              const label = navTagsById.get(tg.id)?.name ?? tg.name;
              bump(`topic:nt:${tg.id}`, label, t, 1);
            }
          }
          break;
        }
        case "priority": {
          const idx = PRIORITY_ORDER.indexOf(t.priority);
          bump(`p:${t.priority}`, t.priority, t, idx >= 0 ? idx : 99);
          break;
        }
        case "status": {
          const idx = STATUS_ORDER.indexOf(t.status);
          bump(`st:${t.status}`, STATUS_GROUP_LABEL[t.status] ?? t.status, t, idx >= 0 ? idx : 99);
          break;
        }
      }
    }
    return [...buckets.values()].sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.label.localeCompare(b.label);
    });
  }, [sorted, groupKey, usersById, suppliersById, bookSectionsById, navTagsById]);

  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) : null;

  return (
    <>
      {/* v1.27.4: text-underline List/Board tabs directly below the
          page title. Active tab gets the moss accent + thicker bottom
          border. Mirrors the user-supplied mockup. Sits just outside
          the search/filter band below. */}
      <div className="px-4 sm:px-6 pt-1 flex gap-5 border-b border-border-soft bg-surface">
        {(["list", "board"] as View[]).map((v) => {
          const active = view === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={[
                "text-sm font-medium pb-2 -mb-px border-b-2 transition-colors",
                active
                  ? "border-ink-primary text-ink-primary font-semibold"
                  : "border-transparent text-ink-tertiary hover:text-ink-primary",
              ].join(" ")}
              aria-pressed={active}
            >
              {v === "list" ? "List" : "Board"}
            </button>
          );
        })}
      </div>

      {/* v1.27.0 → v1.27.4: search + sort row stays — user clarified
          "anything added can stay, I just want the same style". */}
      <div className="bg-surface border-b border-border-soft">
        <div className="px-4 sm:px-6 pt-3 pb-2 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
              className="w-full text-sm bg-canvas text-ink-primary border border-border-soft rounded-md pl-8 pr-7 py-1.5 outline-none focus:border-moss-500"
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
          <div className="flex items-center gap-3 ml-auto">
            {/* v1.29.0: group-by selector. Sits next to Sort because
                the user reads them together — "show me my tasks
                grouped by category, sorted by due date". */}
            <div className="flex items-center gap-1">
              <label className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
                Group
              </label>
              <select
                value={groupKey}
                onChange={(e) => setGroupKey(e.target.value as GroupKey)}
                className="text-xs bg-canvas text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
              >
                {(Object.keys(GROUP_LABELS) as GroupKey[]).map((k) => (
                  <option key={k} value={k}>
                    {GROUP_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
                Sort
              </label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="text-xs bg-canvas text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
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
        <FilterTabs value={filter} onChange={setFilter} categories={categories} />
      </div>

      {view === "board" ? (
        <TaskBoard tasks={sorted} users={users} canEdit={canEdit} />
      ) : (
        <div className="flex-1 overflow-auto">
          {/* v1.27.8: dropped the bordered/shadowed container that
              wrapped the list. Target mockup renders rows directly
              on the page background. Same applies to the header row
              — now a flat strip with the same divider underline as
              the row separators. */}
          <div className="px-4 sm:px-6 py-4">
            {sorted.length === 0 ? (
              <EmptyState
                illustration={EmptyTasks}
                title="Nothing on this list"
                body="Try a different filter, or add a task with the C shortcut anywhere in the app."
              />
            ) : (
              <>
                {/* v1.27.8: column header strip — matches the mockup.
                    More gap (gap-4 → gap-5) + bumped right-side widths
                    so the rightmost columns stop feeling squished. */}
                <div className="hidden sm:flex items-center gap-5 px-4 py-2 border-b border-border-soft text-[10px] uppercase tracking-wider font-bold text-ink-tertiary">
                  <span className="w-4 flex-shrink-0" aria-hidden />
                  <span className="w-1.5 flex-shrink-0" aria-hidden />
                  <span className="flex-1 min-w-0">Title</span>
                  <span className="w-32">Assignee</span>
                  <span className="w-16 text-center">Priority</span>
                  <span className="w-24 text-center">Status</span>
                  <span className="w-24 text-right">Due</span>
                  <span className="w-24 text-center">Category</span>
                </div>
                {/* v1.29.0: render group sections. When groupKey is
                    "none" `groups` collapses to one synthetic section
                    with empty label, so the section header is hidden
                    and the rendered output matches v1.28.x exactly. */}
                {groups.map((g) => (
                  <div key={g.key}>
                    {g.label && (
                      <div className="px-4 pt-4 pb-1 text-[10px] uppercase tracking-wider font-bold text-ink-tertiary border-b border-border-soft bg-canvas/30 flex items-baseline gap-2">
                        <span>{g.label}</span>
                        <span className="text-ink-tertiary/70 normal-case font-normal tabular-nums">
                          {g.tasks.length}
                        </span>
                      </div>
                    )}
                    <ol>
                      {g.tasks.map((t) => {
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
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
      {openTask && (
        <TaskDrawer
          task={openTask}
          users={users}
          suppliers={suppliers}
          bookSections={bookSections}
          navTags={navTags}
          canEdit={canEdit}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </>
  );
}
