"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CustomFieldsBlock } from "@/components/ui/CustomFieldsBlock";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { setTaskCustomField } from "./actions";
import { TopicPicker, type BookSectionOpt, type BookSubsectionOpt, type NavTagOpt, type GuestGroupOpt } from "./TopicPicker";

const TYPES = ["TASK", "QUESTION", "DECISION"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"] as const;

// v1.96.0: COMMON_CATEGORIES + the Category input dropped. The
// previous Category field wrote a single-element `tags` array
// that the rest of the app didn't actually read or group by —
// dead UX without dropping any real functionality.

export type Initial = {
  title?: string;
  type?: string;
  priority?: string;
  status?: string;
  // v1.96.0: array of user-ids for multi-assignee.
  assigneeIds?: string[];
  dueDate?: string;
  notes?: string;
  // v1.28.0: optional supplier link.
  supplierId?: string | null;
  // v1.30.5: replaces v1.30.0's bookSubsectionId. Multi-select arrays.
  bookSectionIds?: string[];
  navTagIds?: string[];
  // v1.51.0: parallel m2m at the card level — drives the inline
  // tasks panel below each card on /book/[slug].
  bookSubsectionIds?: string[];
  // v1.61.0 (XL1): GuestGroup ids; tagged tasks surface on each
  // member's /guests/[id] page.
  guestGroupIds?: string[];
};

export type UserOpt = { id: string; name: string | null; email: string };
// v1.28.0: minimal supplier shape for the picker.
export type SupplierOpt = { id: string; name: string; category: string };
// v1.30.5: re-exported from TopicPicker for the parent surfaces
// (page.tsx, AddTaskToggle, TaskList) so callers don't have to import
// from two files. Replaces v1.30.0's BookSubsectionOpt.
// v1.51.0: BookSubsectionOpt re-introduced (for the parallel m2m).
// v1.61.0 (XL1): + GuestGroupOpt.
export type { BookSectionOpt, BookSubsectionOpt, NavTagOpt, GuestGroupOpt };

type Props = {
  initial?: Initial;
  users: UserOpt[];
  // v1.28.0: optional list of suppliers for the supplier-link picker.
  // Empty array hides the picker entirely (e.g. when no suppliers
  // have been added yet, or on contexts where the link isn't useful).
  suppliers?: SupplierOpt[];
  // v1.30.5: lists for the unified Topics multi-select. All empty
  // hides the picker entirely.
  // v1.61.0 (XL1): + guestGroups.
  bookSections?: BookSectionOpt[];
  bookSubsections?: BookSubsectionOpt[];
  navTags?: NavTagOpt[];
  guestGroups?: GuestGroupOpt[];
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
  bookSubsections = [],
  navTags = [],
  guestGroups = [],
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
      {/* v1.96.0: multi-assignee chip picker replaces the
          single-select. Couple co-owning a task ("buy rings" =
          both Jamie + Bryony) was previously impossible. Category
          field dropped — never read elsewhere in the app. */}
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Assignees</label>
        <AssigneePicker
          users={users}
          initialIds={initial?.assigneeIds ?? []}
        />
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
          tags). v1.51.0: + Book subsections (cards).
          v1.61.0 (XL1): + Guest groups. */}
      {(bookSections.length > 0 || bookSubsections.length > 0 || navTags.length > 0 || guestGroups.length > 0) && (
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Topics</label>
          <TopicPicker
            bookSections={bookSections}
            bookSubsections={bookSubsections}
            navTags={navTags}
            guestGroups={guestGroups}
            initialBookSectionIds={initial?.bookSectionIds ?? []}
            initialBookSubsectionIds={initial?.bookSubsectionIds ?? []}
            initialNavTagIds={initial?.navTagIds ?? []}
            initialGuestGroupIds={initial?.guestGroupIds ?? []}
          />
        </div>
      )}
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Notes</label>
        <MentionableTextarea name="notes" defaultValue={initial?.notes ?? ""} rows={3}
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

// v1.96.0: chip-style multi-assignee picker. Renders one hidden
// `<input name="assigneeIds" value={userId}>` per selected user, so
// the server action's `formData.getAll("assigneeIds")` pulls the
// full list (matching the topicKeys + cellSchema patterns used
// elsewhere in the app). Always emits at least the marker input so
// the action's `formData.has("assigneeIds")` returns true even when
// the picker is empty — that lets "set the list to empty" round-trip
// distinct from "field wasn't posted".
function AssigneePicker({
  users,
  initialIds,
}: {
  users: UserOpt[];
  initialIds: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialIds),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {users.length === 0 ? (
          <span className="text-xs text-ink-tertiary italic">No users available.</span>
        ) : (
          users.map((u) => {
            const isOn = selected.has(u.id);
            const label = u.name ?? u.email;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className={[
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  isOn
                    ? "bg-moss-500 text-on-moss border-moss-500"
                    : "bg-canvas text-ink-secondary border-border-soft hover:border-moss-300",
                ].join(" ")}
                aria-pressed={isOn}
              >
                {label}
              </button>
            );
          })
        )}
      </div>
      {/* Marker hidden input — guarantees `formData.has("assigneeIds")`
          even when nothing is selected, so the server can distinguish
          "explicitly empty" from "field not posted". */}
      <input type="hidden" name="assigneeIds" value="__touched__" />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="assigneeIds" value={id} />
      ))}
    </div>
  );
}
