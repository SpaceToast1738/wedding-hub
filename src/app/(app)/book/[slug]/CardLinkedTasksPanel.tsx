"use client";

// v1.92.0: lifted from CardRouter.tsx into its own file so multiple
// editors can render it inline within their own <article> (the user
// asked for the "Linked tasks" section to sit INSIDE the card, not
// as a sibling appended after).
//
// Visual treatment switched from clipped bottom-of-card appendage
// (mt-2 -mx-px border-x border-b border-border-soft bg-canvas/40
// rounded-b-md) to an internal section break (mt-4 pt-3 border-t
// border-border-soft) so it reads as a section of the card content.

import { useState, useTransition } from "react";
import { AddTaskToggle, type UserOpt } from "@/app/(app)/tasks/AddTaskToggle";
import { setTaskStatus } from "@/app/(app)/tasks/actions";
import { useBookTopics } from "./BookTopicsContext";
import { EditTaskDialog } from "./EditTaskDialog";

export type LinkedTaskRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: Date | null;
};

export function CardLinkedTasksPanel({
  tasks,
  subsectionId,
  canEdit,
  users,
}: {
  tasks: LinkedTaskRow[];
  subsectionId: string;
  canEdit: boolean;
  users: UserOpt[];
}) {
  return (
    <section className="mt-4 pt-3 border-t border-border-soft">
      <header className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] uppercase tracking-wider font-bold text-ink-tertiary">
          Linked tasks
        </span>
        {tasks.length > 0 && (
          <span className="text-[10px] text-ink-tertiary tabular-nums">{tasks.length}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
            // v1.95.1: pulls section + subsection option lists from
            // BookTopicsContext so the TopicPicker actually renders
            // and the autofill IDs make it into formData. Pre-fix
            // CardLinkedTasksPanel passed defaultBookSubsectionIds
            // without the corresponding option lists, so the picker
            // was hidden — and with it the hidden topicKeys inputs.
            <AddCardTaskToggle
              users={users}
              subsectionId={subsectionId}
            />
          )}
          <a href="/tasks" className="text-[10px] text-moss-700 hover:underline">
            Manage →
          </a>
        </div>
      </header>
      {tasks.length === 0 ? (
        <p className="text-xs text-ink-tertiary italic">No linked tasks yet.</p>
      ) : (
        <ul className="divide-y divide-border-soft/60 border border-border-soft rounded-sm">
          {tasks.map((t) => (
            <CardInlineTaskRow key={t.id} task={t} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </section>
  );
}

// v1.95.1: context-consumer wrapper around AddTaskToggle. Reading
// from BookTopicsContext here keeps the per-card panel's signature
// unchanged for all 14+ editor call-sites that render through
// CardChrome — none of them need to know about the topic lists.
function AddCardTaskToggle({
  users,
  subsectionId,
}: {
  users: UserOpt[];
  subsectionId: string;
}) {
  const { bookSections, bookSubsections } = useBookTopics();
  return (
    <AddTaskToggle
      users={users}
      bookSections={bookSections}
      bookSubsections={bookSubsections}
      defaultBookSubsectionIds={[subsectionId]}
      // v1.96.0: surface the Task/Question/Decision picker so couples
      // can capture Q&D inline on a card without bouncing to
      // /questions. Button stays generic to read for all three types.
      buttonLabel="+ New"
      showType={true}
    />
  );
}

function CardInlineTaskRow({ task, canEdit }: { task: LinkedTaskRow; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState(task.status);
  const isDone = optimisticStatus === "DONE" || optimisticStatus === "ARCHIVED";

  function statusClass(s: string): string {
    if (s === "DONE") return "text-moss-700 bg-moss-50 border-moss-300";
    if (s === "OPEN") return "text-marigold-700 bg-marigold-100/40 border-marigold-700/30";
    if (s === "IN_PROGRESS") return "text-info bg-canvas border-border-soft";
    return "text-ink-tertiary bg-canvas border-border-soft";
  }
  function statusLabel(s: string): string {
    if (s === "OPEN") return "Open";
    if (s === "IN_PROGRESS") return "Doing";
    if (s === "WAITING") return "Waiting";
    if (s === "DONE") return "Done";
    if (s === "ARCHIVED") return "Archived";
    return s;
  }

  function toggle() {
    if (!canEdit) return;
    const next = isDone ? "OPEN" : "DONE";
    setOptimisticStatus(next);
    startTransition(async () => {
      await setTaskStatus(task.id, next as "OPEN" | "DONE");
    });
  }

  return (
    <li className="px-3 py-1.5 flex items-center gap-2">
      {canEdit && (
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
              <path d="M1 3l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}
      {/* v1.99.2: type identifier renders in BOTH modes so couples
          editing the card can still tell tasks / questions / decisions
          apart at a glance. Pre-v1.99.2 this was an either-or with the
          checkbox — useful for read-only viewers, invisible to editors. */}
      <TaskTypeBadge type={task.type} />
      <span className={`flex-1 min-w-0 truncate text-sm ${isDone ? "text-ink-tertiary line-through" : "text-ink-primary"}`}>
        {task.title}
      </span>
      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border flex-shrink-0 ${statusClass(optimisticStatus)}`}>
        {statusLabel(optimisticStatus)}
      </span>
      {task.dueDate && (
        <span className="text-[10px] text-ink-tertiary tabular-nums whitespace-nowrap flex-shrink-0">
          {task.dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
        </span>
      )}
      {/* v1.96.3: per-row Edit. Couples can fix title / assignees /
          topics / due date without bouncing to /tasks. Hidden in
          read-only mode (the button is the only thing requiring the
          edit gate; the rest of the row is a status indicator). */}
      {canEdit && <EditTaskDialog taskId={task.id} taskTitle={task.title} />}
    </li>
  );
}

// v1.99.2: shared identifier chip for task / question / decision rows.
// Tone-coded so the three kinds read at a glance even in dense lists:
//   - TASK     → muted (it's the default; no signal needed)
//   - QUESTION → marigold ("needs answer" — matches the in-progress pill)
//   - DECISION → info-blue ("needs deciding" — distinct from questions)
// Width-locked to keep the title column aligned across rows of mixed
// types. Kept inline here (and duplicated in LinkedTasksPanel) because
// extracting to a shared lib for two callers + one tiny function isn't
// worth the indirection.
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
