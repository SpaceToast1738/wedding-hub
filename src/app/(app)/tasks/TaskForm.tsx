"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
};

export type UserOpt = { id: string; name: string | null; email: string };

type Props = {
  initial?: Initial;
  users: UserOpt[];
  submitLabel?: string;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel?: () => void;
  showType?: boolean;
};

export function TaskForm({ initial, users, submitLabel = "Create", onSubmit, onCancel, showType = true }: Props) {
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
    </form>
  );
}
