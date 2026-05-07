"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const STATUSES = ["DUE", "SCHEDULED", "PAID", "OVERDUE", "CANCELLED"] as const;

type Initial = {
  description?: string;
  amount?: string;
  status?: string;
  dueDate?: string;
  paidDate?: string;
  method?: string;
  supplierId?: string | null;
  notes?: string;
};

export function PaymentForm({
  initial,
  suppliers,
  submitLabel = "Create",
  onSubmit,
  onCancel,
  // v1.75.0: hidden field passthrough — preserves the linked book row
  // + existing receipts across edit-form saves so updatePayment doesn't
  // clobber them. The PaymentRow edit panel manages those values via
  // their own UI; the form just relays them.
  hiddenFields,
}: {
  initial?: Initial;
  suppliers: { id: string; name: string }[];
  submitLabel?: string;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel?: () => void;
  hiddenFields?: {
    bookBuildMaterialId?: string | null;
    bookOutfitId?: string | null;
    fileIds?: string[];
  };
}) {
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
      {hiddenFields?.bookBuildMaterialId && (
        <input type="hidden" name="bookBuildMaterialId" value={hiddenFields.bookBuildMaterialId} />
      )}
      {hiddenFields?.bookOutfitId && (
        <input type="hidden" name="bookOutfitId" value={hiddenFields.bookOutfitId} />
      )}
      {hiddenFields?.fileIds?.map((fid) => (
        <input key={fid} type="hidden" name="fileIds" value={fid} />
      ))}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Description</label>
          <Input name="description" required defaultValue={initial?.description ?? ""} placeholder="e.g. Florist final balance" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Amount (£)</label>
          <Input name="amount" type="number" min="0" step="0.01" required defaultValue={initial?.amount ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Status</label>
          <select name="status" defaultValue={initial?.status ?? "DUE"} className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Due</label>
          <Input type="date" name="dueDate" defaultValue={initial?.dueDate ?? ""} />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Paid</label>
          <Input type="date" name="paidDate" defaultValue={initial?.paidDate ?? ""} />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Method</label>
          <Input name="method" defaultValue={initial?.method ?? ""} placeholder="Bank transfer" />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Supplier</label>
        <select name="supplierId" defaultValue={initial?.supplierId ?? ""} className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
          <option value="">— none —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Notes</label>
        <textarea name="notes" rows={2} defaultValue={initial?.notes ?? ""}
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
