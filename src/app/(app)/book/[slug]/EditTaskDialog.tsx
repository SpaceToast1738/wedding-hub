"use client";

// v1.96.3: per-row Edit affordance for the linked-tasks panels on
// /book/[slug]. Pre-v1.96.3 the panels could create tasks (via
// AddTaskToggle's modal) and toggle status (via the checkbox) but
// there was no way to edit title / assignees / due date / topics /
// notes / supplier link without bouncing to /tasks.
//
// Shape:
//   • Lazy load — modal opens on click → calls loadTaskForEdit(id)
//     → shows TaskForm with the returned data. Page-level query stays
//     small (linked-tasks panel only fetches { id, title, type,
//     status, priority, dueDate }).
//   • Pulls the form's option lists from BookTopicsContext so every
//     picker (AssigneePicker / TopicPicker / supplier select) is
//     pre-populated.
//   • On save → updateTask + router.refresh() so the panel reflects
//     the new state without a full navigation.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { notify } from "@/lib/notify";
import { TaskForm } from "@/app/(app)/tasks/TaskForm";
import { loadTaskForEdit, updateTask, type TaskForEdit } from "@/app/(app)/tasks/actions";
import { useBookTopics } from "./BookTopicsContext";

export function EditTaskDialog({
  taskId,
  taskTitle,
}: {
  taskId: string;
  /** Used for the modal title + aria-label so the user sees which
   *  row they're editing before the full data loads. */
  taskTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<TaskForEdit | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { users, suppliers, bookSections, bookSubsections, navTags, guestGroups } =
    useBookTopics();

  function openDialog() {
    setOpen(true);
    setLoadError(null);
    setTask(null);
    startTransition(async () => {
      try {
        const loaded = await loadTaskForEdit(taskId);
        if (!loaded) {
          setLoadError("Task not found.");
        } else {
          setTask(loaded);
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Couldn't load");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label={`Edit "${taskTitle}"`}
        title="Edit task"
        className="text-[10px] text-ink-tertiary hover:text-moss-700 px-1.5 py-0.5 rounded-sm flex-shrink-0"
      >
        Edit
      </button>
      <AddNewModal
        open={open}
        onClose={() => setOpen(false)}
        title={`Edit "${taskTitle}"`}
        width="lg"
      >
        {loadError ? (
          <p className="text-sm text-danger">{loadError}</p>
        ) : !task ? (
          <p className="text-sm text-ink-tertiary italic">
            {pending ? "Loading…" : "Preparing…"}
          </p>
        ) : (
          <TaskForm
            users={users}
            suppliers={suppliers}
            bookSections={bookSections}
            bookSubsections={bookSubsections}
            navTags={navTags}
            guestGroups={guestGroups}
            // Type picker visible so couples can convert a Task into
            // a Question / Decision (or vice versa) from the inline
            // edit modal — same flexibility the v1.27.8 drawer added
            // for the /tasks page.
            showType={true}
            submitLabel="Save"
            initial={{
              title: task.title,
              type: task.type,
              priority: task.priority,
              status: task.status,
              assigneeIds: task.assigneeIds,
              dueDate: task.dueDate
                ? task.dueDate.toISOString().slice(0, 10)
                : "",
              notes: task.notes ?? "",
              supplierId: task.supplierId,
              bookSectionIds: task.bookSectionIds,
              bookSubsectionIds: task.bookSubsectionIds,
              navTagIds: task.navTagIds,
              guestGroupIds: task.guestGroupIds,
            }}
            onSubmit={async (fd) => {
              await updateTask(taskId, fd);
              notify("success", "Task updated");
              // v1.95.4 pattern — explicit refresh so the panel
              // re-renders against the saved state before the modal
              // closes. revalidatePath alone doesn't always reach
              // the active client subtree in time.
              router.refresh();
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        )}
      </AddNewModal>
    </>
  );
}
