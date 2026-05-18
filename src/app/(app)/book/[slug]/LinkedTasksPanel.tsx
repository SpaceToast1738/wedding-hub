"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { setTaskStatus } from "@/app/(app)/tasks/actions";
import { AddTaskToggle, type UserOpt } from "@/app/(app)/tasks/AddTaskToggle";
import { useBookTopics } from "./BookTopicsContext";
import { EditTaskDialog } from "./EditTaskDialog";

// v1.30.5: section-level linked tasks panel.
// v1.71.0: + interactive status toggle + AddTaskToggle affordance.
export type LinkedTask = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: Date | null;
};

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
  return "text-ink-tertiary bg-canvas border-border-soft";
}

function InlineTaskRow({
  task,
  canEdit,
}: {
  task: LinkedTask;
  canEdit: boolean;
}) {
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
    <li className="flex items-baseline gap-2 px-3 py-1.5 text-xs">
      {canEdit && (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`flex-shrink-0 w-3.5 h-3.5 mt-0.5 rounded-sm border transition-colors ${
            isDone
              ? "bg-moss-500 border-moss-500 text-white"
              : "border-border-soft bg-surface hover:border-moss-400"
          } flex items-center justify-center disabled:opacity-50`}
          title={isDone ? "Mark as open" : "Mark as done"}
          aria-label={isDone ? "Mark as open" : "Mark as done"}
        >
          {isDone && (
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 3l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      )}
      {/* v1.99.2: type badge renders in BOTH modes (was either-or with
          the checkbox pre-v1.99.2 — editors lost the identifier when
          the row went interactive). */}
      <TaskTypeBadge type={task.type} />
      <span className={[
        "flex-1 min-w-0 truncate",
        isDone ? "text-ink-tertiary line-through" : "text-ink-primary",
      ].join(" ")}>
        {task.title}
      </span>
      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border flex-shrink-0 ${statusClass(optimisticStatus)}`}>
        {statusLabel(optimisticStatus)}
      </span>
      {task.dueDate && (
        <span className="text-[10px] text-ink-tertiary tabular-nums flex-shrink-0">
          {task.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
      )}
      {/* v1.96.3: per-row Edit affordance, parity with the card-level
          panel. Lazy-loads the full task via loadTaskForEdit() when
          the modal opens. */}
      {canEdit && <EditTaskDialog taskId={task.id} taskTitle={task.title} />}
    </li>
  );
}

export function LinkedTasksPanel({
  tasks,
  canEdit = false,
  users = [],
  sectionId,
}: {
  tasks: LinkedTask[];
  canEdit?: boolean;
  users?: UserOpt[];
  sectionId?: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return tasks;
    const t = search.trim().toLowerCase();
    return tasks.filter((x) => x.title.toLowerCase().includes(t));
  }, [tasks, search]);

  if (tasks.length === 0 && !canEdit) return null;

  return (
    <div className="bg-canvas/40 border border-border-soft rounded-md">
      <div className="px-3 py-2 border-b border-border-soft flex items-center gap-2 flex-wrap">
        <strong className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
          Linked tasks
        </strong>
        {tasks.length > 0 && (
          <span className="text-[10px] text-ink-tertiary tabular-nums">
            {filtered.length}/{tasks.length}
          </span>
        )}
        {tasks.length > 3 && (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="text-[11px] bg-surface text-ink-primary border border-border-soft rounded-sm px-1.5 py-0.5 outline-none focus:border-moss-500 max-w-[120px]"
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          {canEdit && sectionId && (
            // v1.95.1: thread the section-page topic option lists in
            // from context so the TopicPicker actually renders (and
            // its hidden `topicKeys` inputs make it into formData,
            // which is what persists the Book section autofill).
            <AddTaskToggleWithTopics
              users={users}
              sectionId={sectionId}
            />
          )}
          <Link href="/tasks" className="text-[10px] text-info hover:underline">
            Manage →
          </Link>
        </div>
      </div>
      {tasks.length === 0 ? (
        <p className="px-3 py-2 text-xs text-ink-tertiary italic">No linked tasks yet.</p>
      ) : filtered.length === 0 ? (
        <p className="px-3 py-2 text-xs text-ink-tertiary italic">No matches.</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {filtered.map((t) => (
            <InlineTaskRow key={t.id} task={t} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </div>
  );
}

// v1.95.1: thin context-consumer wrapper. AddTaskToggle is a server-
// safe component (just a button + modal); the only reason this lives
// here is to read the BookTopicsContext that's only available inside
// the page's "use client" subtree. Splitting it out keeps the main
// LinkedTasksPanel body uncluttered.
function AddTaskToggleWithTopics({
  users,
  sectionId,
}: {
  users: UserOpt[];
  sectionId: string;
}) {
  const { bookSections, bookSubsections } = useBookTopics();
  return (
    <AddTaskToggle
      users={users}
      bookSections={bookSections}
      bookSubsections={bookSubsections}
      defaultBookSectionIds={[sectionId]}
      // v1.96.0: surface the Task/Question/Decision picker on the
      // section-level panel so couples can capture Q&D inline
      // without bouncing to /questions. Button stays generic so
      // it reads for all three types.
      buttonLabel="+ New"
      showType={true}
    />
  );
}

// v1.99.2: same T/Q/D identifier chip as CardLinkedTasksPanel. Kept
// inline (rather than extracted to a shared module) — two callers,
// 30 lines of tone classes — indirection wouldn't pay back.
function TaskTypeBadge({ type }: { type: string }) {
  if (type === "QUESTION") {
    return (
      <span
        className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded-sm border bg-marigold-100/60 border-marigold-700/30 text-marigold-700 w-[22px] text-center"
        title="Question"
      >
        Q
      </span>
    );
  }
  if (type === "DECISION") {
    return (
      <span
        className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded-sm border bg-info/10 border-info/30 text-info w-[22px] text-center"
        title="Decision"
      >
        D
      </span>
    );
  }
  return (
    <span
      className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded-sm border bg-canvas border-border-soft text-ink-tertiary w-[22px] text-center"
      title="Task"
    >
      T
    </span>
  );
}
