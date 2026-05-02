// v1.52.0: reusable "tasks linked to this page" strip.
// v1.71.0: + interactive status toggle + optional AddTaskToggle.
//
// Backlog #7 — surfaces tasks tagged with a NavTag whose route
// matches the current page on /songs, /seating/ceremony, /guests.
// Server component when used without canEdit; the interactive rows
// are a nested client component so the strip can still be mostly
// server-rendered.

import Link from "next/link";
import { AddTaskToggle, type UserOpt } from "@/app/(app)/tasks/AddTaskToggle";
import { PageLinkedTasksRows } from "./PageLinkedTasksRows";

export type StripTaskRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: Date | null;
};

export function PageLinkedTasksStrip({
  tasks,
  navTagName,
  navTagId,
  manageHref = "/tasks",
  canEdit = false,
  users = [],
}: {
  tasks: StripTaskRow[];
  /** Display label for the source nav tag, e.g. "Music" / "Guests". */
  navTagName: string;
  /** Nav tag ID for pre-linking new tasks. Required for AddTaskToggle. */
  navTagId?: string;
  /** Deep link to the full task list. Defaults to /tasks. */
  manageHref?: string;
  canEdit?: boolean;
  users?: UserOpt[];
}) {
  if (tasks.length === 0 && !canEdit) return null;

  const open = tasks.filter((t) => t.status !== "DONE" && t.status !== "ARCHIVED");
  const done = tasks.filter((t) => t.status === "DONE" || t.status === "ARCHIVED");

  return (
    <section className="bg-surface border-l-2 border-l-moss-300 border border-border-soft rounded-md shadow-sm mx-auto max-w-5xl mt-3">
      <header className="px-4 py-2 border-b border-border-soft flex items-center gap-2 flex-wrap">
        <span aria-hidden className="text-moss-700">📋</span>
        <h2 className="text-xs font-semibold text-ink-primary">
          Linked tasks · {navTagName}
        </h2>
        {tasks.length > 0 && (
          <span className="text-[11px] text-ink-tertiary tabular-nums">
            {open.length} open
            {done.length > 0 && (
              <span className="text-ink-tertiary"> · {done.length} done</span>
            )}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canEdit && navTagId && (
            <AddTaskToggle
              users={users}
              defaultNavTagIds={[navTagId]}
              buttonLabel="+ Task"
              showType={false}
            />
          )}
          <Link
            href={manageHref}
            className="text-[11px] text-moss-700 hover:underline font-medium"
          >
            Manage →
          </Link>
        </div>
      </header>
      {tasks.length === 0 ? (
        <p className="px-4 py-2 text-xs text-ink-tertiary italic">No linked tasks yet.</p>
      ) : (
        <PageLinkedTasksRows tasks={[...open, ...done]} canEdit={canEdit} />
      )}
    </section>
  );
}
