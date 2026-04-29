"use client";

import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { isoForInput } from "@/lib/format";
import { deleteTask, updateTask } from "./actions";
import type { UserOpt, SupplierOpt, BookSubsectionOpt } from "./TaskForm";

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
  // v1.28.0: optional supplier link.
  supplierId: string | null;
  // v1.30.0: optional Wedding Book subsection link.
  bookSubsectionId: string | null;
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "OPEN", label: "TODO" },
  { value: "IN_PROGRESS", label: "DOING" },
  { value: "WAITING", label: "WAITING" },
  { value: "DONE", label: "DONE" },
];

const PRIORITY_OPTIONS = ["URGENT", "HIGH", "MEDIUM", "LOW"];

// v1.27.8: Type changer in the drawer. Pre-fix the drawer hard-coded
// `task.type` on save, so a row created as TASK could never become a
// QUESTION/DECISION (or vice versa) without going through the
// admin-only updateTask path. The model has always been polymorphic;
// this just exposes the toggle.
const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "TASK", label: "Task" },
  { value: "QUESTION", label: "Question" },
  { value: "DECISION", label: "Decision" },
];

// v1.27.0: right-side drawer for task detail / quick edit. Replaces
// the v1.0.x inline-expand-to-edit pattern that buried the form
// inside the row. UX: click any task in the list → drawer slides in
// from the right; the list stays visible so the user can pivot
// quickly between tasks. ESC + backdrop click + × button all close.
//
// Shape mirrors the Seating FocusPanel (v1.22.x): no full-screen
// modal, no router push, no URL state — just a local React state
// flag managed by the parent. Cheap to mount/unmount.
export function TaskDrawer({
  task,
  users,
  suppliers = [],
  bookSubsections = [],
  canEdit,
  onClose,
}: {
  task: Task;
  users: UserOpt[];
  // v1.28.0: optional list of suppliers for the supplier-link picker.
  // Empty array hides the field entirely.
  suppliers?: SupplierOpt[];
  // v1.30.0: optional list of Wedding Book subsections for the
  // book-link picker. Empty array hides the field.
  bookSubsections?: BookSubsectionOpt[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [type, setType] = useState(task.type);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(isoForInput(task.dueDate) ?? "");
  const [category, setCategory] = useState(task.tags[0] ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [supplierId, setSupplierId] = useState(task.supplierId ?? "");
  const [bookSubsectionId, setBookSubsectionId] = useState(task.bookSubsectionId ?? "");
  const [pending, startTransition] = useTransition();

  // ESC key dismisses the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dirty =
    title !== task.title ||
    type !== task.type ||
    status !== task.status ||
    priority !== task.priority ||
    (assigneeId || null) !== (task.assigneeId ?? null) ||
    dueDate !== (isoForInput(task.dueDate) ?? "") ||
    category !== (task.tags[0] ?? "") ||
    notes !== (task.notes ?? "") ||
    (supplierId || null) !== (task.supplierId ?? null) ||
    (bookSubsectionId || null) !== (task.bookSubsectionId ?? null);

  function save() {
    if (!title.trim()) {
      notify("error", "Title is required");
      return;
    }
    const fd = new FormData();
    fd.set("title", title);
    fd.set("type", type);
    fd.set("status", status);
    fd.set("priority", priority);
    fd.set("assigneeId", assigneeId);
    fd.set("dueDate", dueDate);
    fd.set("category", category);
    fd.set("notes", notes);
    fd.set("supplierId", supplierId);
    fd.set("bookSubsectionId", bookSubsectionId);
    startTransition(async () => {
      try {
        await updateTask(task.id, fd);
        notify("success", "Saved");
        onClose();
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  function onDelete() {
    if (!confirm(`Delete "${task.title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteTask(task.id);
        onClose();
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't delete");
      }
    });
  }

  const assignee = users.find((u) => u.id === task.assigneeId);

  return (
    <>
      {/* Backdrop — click to dismiss. Soft tint so the list behind
          stays visible (matches the screenshot mockup). Escape key
          also dismisses (see useEffect above). */}
      <div
        className="fixed inset-0 z-[400] bg-black/10"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] z-[401] bg-surface border-l border-border-soft shadow-lg flex flex-col"
        role="dialog"
        aria-label="Task details"
      >
        <header className="px-5 py-4 border-b border-border-soft flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {canEdit ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-lg font-semibold bg-transparent border-0 outline-none focus:bg-canvas focus:px-2 focus:rounded-sm text-ink-primary"
              />
            ) : (
              <h2 className="text-lg font-semibold text-ink-primary truncate">
                {task.title}
              </h2>
            )}
            <div className="text-xs text-ink-tertiary mt-0.5">
              {task.type === "TASK" ? "Task" : task.type === "QUESTION" ? "Question" : "Decision"}
              {category && ` · ${category}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-tertiary hover:text-ink-primary text-xl leading-none px-1 flex-shrink-0"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {/* v1.27.8: Type changer — TASK/QUESTION/DECISION. The
              model has always been polymorphic; this just exposes
              the toggle so a row created as the wrong kind can be
              converted in place. */}
          <div>
            <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
              Type
            </strong>
            {canEdit ? (
              <div className="flex flex-wrap gap-1">
                {TYPE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setType(o.value)}
                    className={[
                      "text-[11px] px-2.5 py-1 rounded-md border transition-colors",
                      type === o.value
                        ? "bg-moss-500 text-white border-moss-500"
                        : "bg-canvas text-ink-secondary border-border-soft hover:border-moss-300",
                    ].join(" ")}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-sm text-ink-primary">
                {TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type}
              </span>
            )}
          </div>

          <div>
            <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
              Status
            </strong>
            {canEdit ? (
              <div className="flex flex-wrap gap-1">
                {STATUS_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setStatus(o.value)}
                    className={[
                      "text-[11px] px-2.5 py-1 rounded-md border transition-colors",
                      status === o.value
                        ? "bg-moss-500 text-white border-moss-500"
                        : "bg-canvas text-ink-secondary border-border-soft hover:border-moss-300",
                    ].join(" ")}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-sm text-ink-primary">
                {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
              </span>
            )}
          </div>

          <div>
            <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
              Priority
            </strong>
            {canEdit ? (
              <div className="flex flex-wrap gap-1">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={[
                      "text-[11px] px-2.5 py-1 rounded-md border transition-colors",
                      priority === p
                        ? "bg-moss-500 text-white border-moss-500"
                        : "bg-canvas text-ink-secondary border-border-soft hover:border-moss-300",
                    ].join(" ")}
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-sm text-ink-primary">{priority}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
                Assignee
              </strong>
              {canEdit ? (
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
                >
                  <option value="">— unassigned —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.email}
                    </option>
                  ))}
                </select>
              ) : assignee ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-ink-primary">
                  <Avatar name={assignee.name ?? assignee.email} size={20} />
                  {assignee.name ?? assignee.email}
                </span>
              ) : (
                <span className="text-sm text-ink-tertiary italic">—</span>
              )}
            </div>
            <div>
              <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
                Due date
              </strong>
              {canEdit ? (
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
                />
              ) : (
                <span className="text-sm text-ink-primary">
                  {task.dueDate ? task.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : <span className="text-ink-tertiary italic">—</span>}
                </span>
              )}
            </div>
          </div>

          <div>
            <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
              Category
            </strong>
            {canEdit ? (
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Budget, Groom Prep, Admin"
                className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
              />
            ) : (
              <span className="text-sm text-ink-primary">{category || <span className="text-ink-tertiary italic">—</span>}</span>
            )}
          </div>

          {/* v1.28.0: optional supplier link. Only rendered when the
              parent passes a non-empty suppliers array — keeps fresh
              workspaces uncluttered. */}
          {suppliers.length > 0 && (
            <div>
              <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
                Supplier
              </strong>
              {canEdit ? (
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
                >
                  <option value="">— none —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.category ? ` · ${s.category}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-ink-primary">
                  {(() => {
                    const s = suppliers.find((x) => x.id === task.supplierId);
                    return s ? s.name : <span className="text-ink-tertiary italic">—</span>;
                  })()}
                </span>
              )}
            </div>
          )}

          {/* v1.30.0: optional Wedding Book subsection link. */}
          {bookSubsections.length > 0 && (
            <div>
              <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
                Wedding Book card
              </strong>
              {canEdit ? (
                <select
                  value={bookSubsectionId}
                  onChange={(e) => setBookSubsectionId(e.target.value)}
                  className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
                >
                  <option value="">— none —</option>
                  {bookSubsections.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.sectionTitle} · {b.title}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-ink-primary">
                  {(() => {
                    const b = bookSubsections.find((x) => x.id === task.bookSubsectionId);
                    return b ? `${b.sectionTitle} · ${b.title}` : <span className="text-ink-tertiary italic">—</span>;
                  })()}
                </span>
              )}
            </div>
          )}

          <div>
            <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
              Notes
            </strong>
            {canEdit ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add more detail…"
                rows={4}
                className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1.5 outline-none focus:border-moss-500 resize-y"
              />
            ) : (
              <p className="text-sm text-ink-primary whitespace-pre-wrap">
                {notes || <span className="text-ink-tertiary italic">—</span>}
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <footer className="px-5 py-3 border-t border-border-soft flex justify-between items-center">
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={save}
                disabled={pending || !dirty}
              >
                Save changes
              </Button>
            </div>
          </footer>
        )}
      </aside>
    </>
  );
}
