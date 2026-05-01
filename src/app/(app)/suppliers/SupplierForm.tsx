"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const STATUSES = ["SHORTLIST", "CONTACTED", "QUOTED", "BOOKED", "PAID", "REJECTED"] as const;
const COMMON_CATEGORIES = [
  "Venue", "Photographer", "Videographer", "Florist", "Caterer",
  "Cake", "DJ / Music", "Hair & Makeup", "Transport", "Stationery",
  "Suit Hire", "Dress", "Decoration", "Officiant",
];

export type Initial = {
  name?: string;
  category?: string;
  status?: string;
  website?: string;
  notes?: string;
  amountAgreed?: string;
};

type Props = {
  initial?: Initial;
  submitLabel?: string;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel?: () => void;
};

export function SupplierForm({ initial, submitLabel = "Create", onSubmit, onCancel }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // v1.60.0 (P3): dirty-check so the Save button disables when no
  // edits are pending. Pre-fix you could mash Save → Save → Save and
  // each click fired a server round-trip with the same body. We keep
  // the inputs uncontrolled (defaultValue, no useState explosion);
  // form-level onChange flips this flag the moment any field
  // changes. Create path (no `initial`) starts dirty so the button
  // is immediately useful for new rows.
  const [dirty, setDirty] = useState(!initial);

  async function handle(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await onSubmit(formData);
        // After a successful save the form's defaultValues are
        // effectively the new baseline; reset dirty so a second click
        // doesn't fire a duplicate save.
        setDirty(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form action={handle} onChange={() => setDirty(true)} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Name</label>
          <Input name="name" defaultValue={initial?.name ?? ""} required autoFocus placeholder="e.g. Paintbox Blooms" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Category</label>
          <input name="category" defaultValue={initial?.category ?? ""} list="supplier-categories" required placeholder="e.g. Florist"
            className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500" />
          <datalist id="supplier-categories">
            {COMMON_CATEGORIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Status</label>
          <select name="status" defaultValue={initial?.status ?? "SHORTLIST"} className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Amount agreed (£)</label>
          <Input name="amountAgreed" type="number" min="0" step="0.01" defaultValue={initial?.amountAgreed ?? ""} placeholder="0.00" />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Website</label>
        <Input name="website" type="url" defaultValue={initial?.website ?? ""} placeholder="https://…" />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Notes</label>
        <textarea name="notes" defaultValue={initial?.notes ?? ""} rows={3}
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
          placeholder="Anything important to remember…" />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>}
        <Button type="submit" variant="primary" size="sm" disabled={pending || !dirty}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
