"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { notify } from "@/lib/notify";
import { isoForInput } from "@/lib/format";
import { answerQuestion, deleteTask, updateTask } from "./actions";
import { suggestTaskBreakdown } from "@/app/(app)/ai/actions";
import type { UserOpt, SupplierOpt, BookSectionOpt, NavTagOpt, GuestGroupOpt } from "./TaskForm";
import { TopicPicker, type BookSubsectionOpt } from "./TopicPicker";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type Task = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  // v1.96.0: multi-assignee.
  assignees: Array<{ id: string }>;
  dueDate: Date | null;
  tags: string[];
  notes: string | null;
  // v2.5.0 (mod #5): backing field for the Answer textarea on
  // QUESTION/DECISION rows.
  questionAnswer: string | null;
  // v1.28.0: optional supplier link.
  supplierId: string | null;
  // v1.30.5: replaces v1.30.0's bookSubsectionId. Multi-select
  // relations — current selections come from m2m relation rows.
  bookSections: Array<{ id: string; title: string }>;
  // v1.51.0: parallel card-level m2m. Optional in the type so old
  // callers that don't load this relation don't break — the drawer
  // defaults to an empty list.
  bookSubsections?: Array<{ id: string; title: string; sectionTitle: string }>;
  navTags: Array<{ id: string; name: string }>;
  // v1.61.0 (XL1): guest-group memberships of this task. Optional in
  // the type so callers that don't load this relation render an empty
  // chip group rather than crashing.
  guestGroups?: Array<{ id: string; name: string; colour?: string | null }>;
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
  bookSections = [],
  bookSubsections = [],
  navTags = [],
  guestGroups = [],
  canEdit,
  onClose,
}: {
  task: Task;
  users: UserOpt[];
  suppliers?: SupplierOpt[];
  // v1.30.5: lists for the combined Topics multi-select.
  // v1.51.0: + bookSubsections (cards).
  // v1.61.0 (XL1): + guestGroups.
  bookSections?: BookSectionOpt[];
  bookSubsections?: BookSubsectionOpt[];
  navTags?: NavTagOpt[];
  guestGroups?: GuestGroupOpt[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [type, setType] = useState(task.type);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  // v1.96.0: multi-assignee — track a Set of IDs locally, post each
  // as a repeated `assigneeIds` input on save.
  const initialAssigneeIds = task.assignees.map((a) => a.id).sort();
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initialAssigneeIds);
  const [dueDate, setDueDate] = useState(isoForInput(task.dueDate) ?? "");
  // v1.96.0: Category field removed. The tags column stays in the DB
  // but the drawer no longer reads or writes it.
  const [notes, setNotes] = useState(task.notes ?? "");
  // v2.5.0 (mod #5): Question/Decision Answer field.
  const [questionAnswer, setQuestionAnswer] = useState(task.questionAnswer ?? "");
  const [supplierId, setSupplierId] = useState(task.supplierId ?? "");
  // v1.30.5: m2m selections live as ID arrays. The TopicPicker emits
  // hidden inputs but we mirror the state here for the dirty check
  // and to set FormData on save.
  // v1.51.0: + bookSubsectionIds for the parallel card-level m2m.
  const initialBookSectionIds = task.bookSections.map((s) => s.id).sort();
  const initialBookSubsectionIds = (task.bookSubsections ?? []).map((s) => s.id).sort();
  const initialNavTagIds = task.navTags.map((t) => t.id).sort();
  // v1.61.0 (XL1): + guestGroupIds.
  const initialGuestGroupIds = (task.guestGroups ?? []).map((g) => g.id).sort();
  const [bookSectionIds, setBookSectionIds] = useState<string[]>(initialBookSectionIds);
  const [bookSubsectionIds, setBookSubsectionIds] = useState<string[]>(initialBookSubsectionIds);
  const [navTagIds, setNavTagIds] = useState<string[]>(initialNavTagIds);
  const [guestGroupIds, setGuestGroupIds] = useState<string[]>(initialGuestGroupIds);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const dirty =
    title !== task.title ||
    type !== task.type ||
    status !== task.status ||
    priority !== task.priority ||
    assigneeIds.slice().sort().join(",") !== initialAssigneeIds.join(",") ||
    dueDate !== (isoForInput(task.dueDate) ?? "") ||
    notes !== (task.notes ?? "") ||
    questionAnswer !== (task.questionAnswer ?? "") ||
    (supplierId || null) !== (task.supplierId ?? null) ||
    bookSectionIds.slice().sort().join(",") !== initialBookSectionIds.join(",") ||
    bookSubsectionIds.slice().sort().join(",") !== initialBookSubsectionIds.join(",") ||
    navTagIds.slice().sort().join(",") !== initialNavTagIds.join(",") ||
    guestGroupIds.slice().sort().join(",") !== initialGuestGroupIds.join(",");

  // v2.5.0 (mod #6): shared guarded-close — ESC, backdrop click, and
  // the × button all used to discard dirty edits silently. One helper,
  // one confirm prompt, used by all three dismiss paths below. (The
  // footer's explicit "Cancel" button is left ungated — clicking a
  // button labelled Cancel already signals discard intent.)
  const guardedClose = useCallback(async () => {
    if (dirty) {
      const ok = await confirm({
        title: "Discard changes?",
        body: "You have unsaved edits on this task.",
        confirmLabel: "Discard",
        tone: "danger",
      });
      if (!ok) return;
    }
    onClose();
  }, [dirty, confirm, onClose]);

  // ESC key dismisses the drawer (guarded when dirty).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") guardedClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guardedClose]);

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
    // v1.96.0: multi-assignee — emit one input per ID plus a touched
    // marker so the server can distinguish "set to empty" from
    // "field not posted". Mirrors the TopicPicker pattern.
    fd.set("assigneeIds", "__touched__");
    for (const id of assigneeIds) fd.append("assigneeIds", id);
    fd.set("dueDate", dueDate);
    // v1.96.0: Category field dropped — no longer written on save.
    fd.set("notes", notes);
    fd.set("supplierId", supplierId);
    // v1.30.5: emit one topicKeys entry per selected ID (FormData
    // supports duplicate keys via append). Server-side parser splits
    // by `bookSection:` / `bookSubsection:` / `navTag:` prefix.
    // v1.61.1 (bug-check): `__touched__` sentinel always — see
    // TopicPicker.tsx for the matching emit on the form-submit path.
    // Without this, a user clearing every chip would result in zero
    // topicKeys entries; `formData.has("topicKeys")` returns false on
    // the server; the m2m `set:` ops get skipped; existing relations
    // stay intact. The sentinel doesn't match any prefix in
    // parseTopicKeys so it's silently dropped.
    fd.append("topicKeys", "__touched__");
    for (const id of bookSectionIds) fd.append("topicKeys", `bookSection:${id}`);
    for (const id of bookSubsectionIds) fd.append("topicKeys", `bookSubsection:${id}`);
    for (const id of navTagIds) fd.append("topicKeys", `navTag:${id}`);
    // v1.61.0 (XL1): + guestGroup keys.
    for (const id of guestGroupIds) fd.append("topicKeys", `guestGroup:${id}`);
    // v2.5.0 (mod #5): whether the answer changed this save, captured
    // before the transition so it reads the pre-await state.
    const answerChanged =
      (type === "QUESTION" || type === "DECISION") && questionAnswer !== (task.questionAnswer ?? "");
    startTransition(async () => {
      try {
        await updateTask(task.id, fd);
        // updateTask's schema has no `questionAnswer` field — the
        // Answer textarea persists through the existing answerQuestion
        // action instead (same one the /questions page's AnswerForm
        // uses), run right after so a fresh answer is saved with the
        // rest of the form in one Save click. Note: answerQuestion
        // auto-derives status from whether the answer is non-empty
        // (DONE vs OPEN) — same semantics as /questions — so it can
        // override a manually-picked Status chip when the answer text
        // changed in this save.
        if (answerChanged) {
          await answerQuestion(task.id, questionAnswer);
        }
        notify("success", "Saved");
        onClose();
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  async function onDelete() {
    if (!(await confirm({ title: `Delete "${task.title}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      try {
        await deleteTask(task.id);
        onClose();
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't delete");
      }
    });
  }

  // v2.4.0: one-shot AI breakdown. Emits 3–8 task.create proposals
  // (one approval batch on /ai); this task itself is untouched until
  // someone reviews them.
  function onBreakdown() {
    startTransition(async () => {
      try {
        const res = await suggestTaskBreakdown(task.id);
        if (res.ok) {
          notify("success", `Drafted ${res.count} subtasks — review them on /ai`);
        } else {
          notify("error", res.error);
        }
      } catch (err) {
        // Network-level failure of the action POST itself — app-level
        // failures come back as { ok: false } above.
        notify("error", err instanceof Error ? err.message : "Breakdown failed");
      }
    });
  }

  // v1.96.0: multi-assignee — read-only chips iterate task.assignees
  // directly (see the Assignees field below). No top-level `assignee`
  // helper needed; the per-row Avatar lookup happens inline.

  return (
    <>
      {/* Backdrop — click to dismiss (guarded when dirty, see
          guardedClose above). Soft tint so the list behind stays
          visible (matches the screenshot mockup). Escape key also
          dismisses (see useEffect above). */}
      <div
        className="fixed inset-0 z-[400] bg-black/10"
        onClick={guardedClose}
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
              {/* v1.96.0: category subtitle removed alongside the field. */}
              {task.type === "TASK" ? "Task" : task.type === "QUESTION" ? "Question" : "Decision"}
            </div>
          </div>
          <button
            type="button"
            onClick={guardedClose}
            aria-label="Close"
            className="text-ink-tertiary hover:text-ink-primary text-xl leading-none px-1 flex-shrink-0"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {/* v2.5.0 (mod #5): Answer field for QUESTION/DECISION rows,
              at the top of the body — this is the thing someone opens
              the drawer to read/update. Persists via answerQuestion()
              (see save() above) rather than updateTask's schema. */}
          {(type === "QUESTION" || type === "DECISION") && (
            <div>
              <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
                Answer
              </strong>
              {canEdit ? (
                <MentionableTextarea
                  value={questionAnswer}
                  onChange={(e) => setQuestionAnswer(e.target.value)}
                  placeholder="Add the answer…"
                  rows={3}
                  className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1.5 outline-none focus:border-moss-500 resize-y"
                />
              ) : (
                <p className="text-sm text-ink-primary whitespace-pre-wrap">
                  {questionAnswer || <span className="text-ink-tertiary italic">—</span>}
                </p>
              )}
            </div>
          )}

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
                        ? "bg-moss-500 text-on-moss border-moss-500"
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
                        ? "bg-moss-500 text-on-moss border-moss-500"
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
                        ? "bg-moss-500 text-on-moss border-moss-500"
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
                Assignees
              </strong>
              {canEdit ? (
                // v1.96.0: multi-assignee chip toggle.
                <div className="flex flex-wrap gap-1.5">
                  {users.length === 0 ? (
                    <span className="text-xs text-ink-tertiary italic">
                      No users available.
                    </span>
                  ) : (
                    users.map((u) => {
                      const isOn = assigneeIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() =>
                            setAssigneeIds((prev) =>
                              isOn
                                ? prev.filter((id) => id !== u.id)
                                : [...prev, u.id],
                            )
                          }
                          aria-pressed={isOn}
                          className={[
                            "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                            isOn
                              ? "bg-moss-500 text-on-moss border-moss-500"
                              : "bg-canvas text-ink-secondary border-border-soft hover:border-moss-300",
                          ].join(" ")}
                        >
                          {u.name ?? u.email}
                        </button>
                      );
                    })
                  )}
                </div>
              ) : task.assignees.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {task.assignees.map((a) => {
                    const u = users.find((x) => x.id === a.id);
                    if (!u) return null;
                    return (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 text-sm text-ink-primary"
                      >
                        <Avatar name={u.name ?? u.email} size={20} />
                        {u.name ?? u.email}
                      </span>
                    );
                  })}
                </div>
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

          {/* v1.96.0: Category section removed. The single-string
              tag the field wrote was never grouped/filtered elsewhere
              in the app — dead UX. */}

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

          {/* v1.30.5: combined Topics multi-select (Wedding Book
              sections + Nav tags). Replaces v1.30.0's single-select
              subsection picker. */}
          {(bookSections.length > 0 || bookSubsections.length > 0 || navTags.length > 0) && (
            <div>
              <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
                Topics
              </strong>
              <TopicPicker
                bookSections={bookSections}
                bookSubsections={bookSubsections}
                navTags={navTags}
                guestGroups={guestGroups}
                initialBookSectionIds={initialBookSectionIds}
                initialBookSubsectionIds={initialBookSubsectionIds}
                initialNavTagIds={initialNavTagIds}
                initialGuestGroupIds={initialGuestGroupIds}
                canEdit={canEdit}
                onChange={(next) => {
                  setBookSectionIds(next.bookSectionIds);
                  setBookSubsectionIds(next.bookSubsectionIds);
                  setNavTagIds(next.navTagIds);
                  setGuestGroupIds(next.guestGroupIds);
                }}
              />
            </div>
          )}

          <div>
            <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
              Notes
            </strong>
            {canEdit ? (
              <MentionableTextarea
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
          // v2.5.0 (mod #9): Delete used to sit directly beside Break
          // down — a destructive action one misclick away from a
          // generative one. `justify-between` now pins Delete alone on
          // the far left; Break down moves in with Cancel/Save on the
          // right where the rest of the "finishing this edit" actions
          // live.
          <footer className="px-5 py-3 border-t border-border-soft flex justify-between items-center">
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
              Delete
            </Button>
            <div className="flex gap-2 items-center">
              {type === "TASK" && (
                // v2.4.0: one-shot AI breakdown — splits this task into
                // 3–8 subtask proposals on /ai. Server action gates on
                // ai_write; without it the click just reports the error.
                <Button variant="ghost" size="sm" onClick={onBreakdown} disabled={pending}>
                  ✨ Break down
                </Button>
              )}
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
