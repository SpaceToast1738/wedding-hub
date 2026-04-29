"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CustomFieldsBlock } from "@/components/ui/CustomFieldsBlock";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { setTaskCustomField } from "./actions";
import { TopicPicker, type BookSectionOpt, type NavTagOpt } from "./TopicPicker";

const TYPES = ["TASK", "QUESTION", "DECISION"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"] as const;

const COMMON_CATEGORIES = [
  "Admin", "Legal", "Bride Prep", "Groom Prep",
  "Bridesmaid Prep", "Groomsmen Prep", "Best Man", "Maid of Honour", "Budget",
];

export type Initial = {
  title?: string;
  type?: string;
  priority?: string;
  status?: string;
  assigneeId?: string | null;
  dueDate?: string;
  category?: string;
  notes?: string;
  // v1.28.0: optional supplier link.
  supplierId?: string | null;
  // v1.30.5: replaces v1.30.0's bookSubsectionId. Multi-select arrays.
  bookSectionIds?: string[];
  navTagIds?: string[];
};

export type UserOpt = { id: string; name: string | null; email: string };
// v1.28.0: minimal supplier shape for the picker.
export type SupplierOpt = { id: string; name: string; category: string };
// v1.30.5: re-exported from TopicPicker for the parent surfaces
// (page.tsx, AddTaskToggle, TaskList) so callers don't have to import
// from two files. Replaces v1.30.0's BookSubsectionOpt.
export type { BookSectionOpt, NavTagOpt };

type Props = {
  initial?: Initial;
  users: UserOpt[];
  // v1.28.0: optional list of suppliers for the supplier-link picker.
  // Empty array hides the picker entirely (e.g. when no suppliers
  // have been added yet, or on contexts where the link isn't useful).
  suppliers?: SupplierOpt[];
  // v1.30.5: lists for the unified Topics multi-select. Both empty
  // hides the picker entirely.
  bookSections?: BookSectionOpt[];
  navTags?: NavTagOpt[];
  submitLabel?: string;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel?: () => void;
  showType?: boolean;
  // v1.22.0: when editing an existing task, the parent passes the task
  // id + custom-field defs + current values. The form renders a
  // collapsible CustomFieldsBlock at the bottom. Skipped on the
  // create path (no taskId yet — fields can be filled in after the
  // initial create lands).
  taskId?: string;
  customFieldDefs?: CustomFieldDef[];
  customFieldValues?: Record<string, string | number | null> | null;
};

export function TaskForm({
  initial,
  users,
  suppliers = [],
  bookSections = [],
  navTags = [],
  submitLabel = "Create",
  onSubmit,
  onCancel,
  showType = true,
  taskId,
  customFieldDefs = [],
  customFieldValues,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handle(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await onSubmit(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form action={handle} className="space-y-3">
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Title</label>
        <Input name="title" defaultValue={initial?.title ?? ""} required autoFocus placeholder="Task title…" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {showType && (
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Type</label>
            <select name="type" defaultValue={initial?.type ?? "TASK"} className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
              {TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Priority</label>
          <select name="priority" defaultValue={initial?.priority ?? "MEDIUM"} className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
            {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Status</label>
          <select name="status" defaultValue={initial?.status ?? "OPEN"} className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Due</label>
          <Input type="date" name="dueDate" defaultValue={initial?.dueDate ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Assignee</label>
          <select name="assigneeId" defaultValue={initial?.assigneeId ?? ""} className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
            <option value="">— unassigned —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Category</label>
          <input name="category" defaultValue={initial?.category ?? ""} list="task-categories" placeholder="e.g. Admin"
            className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500" />
          <datalist id="task-categories">
            {COMMON_CATEGORIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
      </div>
      {/* v1.28.0: Supplier link (single-select). */}
      {suppliers.length > 0 && (
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Supplier</label>
          <select
            name="supplierId"
            defaultValue={initial?.supplierId ?? ""}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none"
          >
            <option value="">— none —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.category ? ` · ${s.category}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      {/* v1.30.5: combined Topics multi-select (Book sections + Nav
          tags). Replaces v1.30.0's separate Wedding Book card picker. */}
      {(bookSections.length > 0 || navTags.length > 0) && (
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Topics</label>
          <TopicPicker
            bookSections={bookSections}
            navTags={navTags}
            initialBookSectionIds={initial?.bookSectionIds ?? []}
            initialNavTagIds={initial?.navTagIds ?? []}
          />
        </div>
      )}
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Notes</label>
        <textarea name="notes" defaultValue={initial?.notes ?? ""} rows={3}
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500" />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>}
        <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
      {taskId && customFieldDefs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border-soft">
          <CustomFieldsBlock
            fields={customFieldDefs}
            values={customFieldValues ?? {}}
            canEdit
            onSave={(fieldId, raw) => setTaskCustomField(taskId, fieldId, raw)}
            title="Custom fields"
          />
        </div>
      )}
    </form>
  );
}
