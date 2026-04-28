"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoneyDecimal } from "@/lib/format";
import { computeActual, isManualOverride, sumOfPayments } from "@/lib/budget";
import { createCategory, createLine, deleteCategory, deleteLine, updateLine } from "./actions";

type Supplier = { id: string; name: string };

type Line = {
  id: string;
  description: string;
  estimated: { toString: () => string } | null;
  actual: { toString: () => string } | null;
  paid: { toString: () => string } | null;
  supplierId: string | null;
  notes: string | null;
  // B2: linked payments so `actual` can be recomputed when null.
  payments: { amount: string }[];
};

type Category = { id: string; name: string; lines: Line[] };

function num(d: { toString: () => string } | null | undefined): number {
  if (!d) return 0;
  const n = Number(d.toString());
  return isNaN(n) ? 0 : n;
}

export function BudgetClient({ categories, suppliers }: { categories: Category[]; suppliers: Supplier[] }) {
  const totals = categories.reduce(
    (acc, c) => {
      for (const l of c.lines) {
        acc.estimated += num(l.estimated);
        acc.actual += computeActual(l);
        acc.paid += num(l.paid);
      }
      return acc;
    },
    { estimated: 0, actual: 0, paid: 0 },
  );
  const remaining = totals.actual - totals.paid;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <SummaryBar totals={totals} remaining={remaining} />
        {categories.length === 0 ? (
          <p className="text-sm text-ink-tertiary text-center py-12">
            No budget categories yet. Add one below to get started.
          </p>
        ) : (
          categories.map((c) => (
            <CategoryBlock key={c.id} category={c} suppliers={suppliers} />
          ))
        )}
        <AddCategory />
      </div>
    </div>
  );
}

function SummaryBar({ totals, remaining }: { totals: { estimated: number; actual: number; paid: number }; remaining: number }) {
  const Tile = ({ label, value, accent = "text-ink-primary" }: { label: string; value: string; accent?: string }) => (
    <div className="bg-surface border border-border-soft rounded-md px-4 py-3 flex-1 min-w-[140px]">
      <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">{label}</div>
      <div className={`font-display text-2xl font-semibold mt-1 ${accent}`}>
        {value}
      </div>
    </div>
  );

  // Stacked progress: paid (moss) + (actual - paid) outstanding (marigold)
  // shown against the planned total. If actual > planned the bar caps at
  // the actual total instead and we surface a small "over" note.
  const denominator = Math.max(totals.estimated, totals.actual);
  const paidPct = denominator === 0 ? 0 : (totals.paid / denominator) * 100;
  const actualPct = denominator === 0 ? 0 : (totals.actual / denominator) * 100;
  const overBudget = totals.actual > totals.estimated && totals.estimated > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Tile label="Planned" value={formatMoneyDecimal(totals.estimated as unknown as { toString(): string })} />
        <Tile label="Actual" value={formatMoneyDecimal(totals.actual as unknown as { toString(): string })} accent={overBudget ? "text-danger" : "text-ink-primary"} />
        <Tile label="Paid" value={formatMoneyDecimal(totals.paid as unknown as { toString(): string })} accent="text-moss-700" />
        <Tile label="Outstanding" value={formatMoneyDecimal(remaining as unknown as { toString(): string })} accent={remaining > 0 ? "text-marigold-700" : "text-ink-primary"} />
      </div>
      {denominator > 0 && (
        <div>
          <div className="relative h-2 bg-canvas border border-border-soft rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-marigold-500"
              style={{ width: `${Math.min(actualPct, 100)}%` }}
              aria-hidden
            />
            <div
              className="absolute inset-y-0 left-0 bg-moss-500"
              style={{ width: `${Math.min(paidPct, 100)}%` }}
              aria-hidden
            />
          </div>
          <div className="text-[11px] text-ink-tertiary mt-1.5 flex justify-between flex-wrap gap-2">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-moss-500 mr-1 align-middle" />
              Paid {paidPct.toFixed(0)}%
              <span className="mx-2">·</span>
              <span className="inline-block w-2 h-2 rounded-full bg-marigold-500 mr-1 align-middle" />
              Committed {actualPct.toFixed(0)}%
            </span>
            {overBudget && (
              <span className="text-danger font-medium">
                ⚠ Actual exceeds planned by {formatMoneyDecimal((totals.actual - totals.estimated) as unknown as { toString(): string })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryBlock({ category, suppliers }: { category: Category; suppliers: Supplier[] }) {
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDeleteCat() {
    if (category.lines.length > 0) {
      alert("Delete the lines in this category first.");
      return;
    }
    if (!confirm(`Delete category "${category.name}"?`)) return;
    startTransition(async () => {
      await deleteCategory(category.id);
    });
  }

  // Subtotals so the user gets per-category numbers without having to scan rows.
  const subtotals = category.lines.reduce(
    (acc, l) => ({
      estimated: acc.estimated + num(l.estimated),
      actual: acc.actual + computeActual(l),
      paid: acc.paid + num(l.paid),
    }),
    { estimated: 0, actual: 0, paid: 0 },
  );

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-soft gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-baseline gap-2 flex-1 text-left hover:text-moss-700"
          aria-expanded={!collapsed}
        >
          <span className="text-ink-tertiary text-xs">{collapsed ? "▸" : "▾"}</span>
          <h2 className="text-sm font-semibold text-ink-primary">{category.name}</h2>
          <span className="text-[11px] text-ink-tertiary">
            {category.lines.length} {category.lines.length === 1 ? "line" : "lines"}
          </span>
          <span className="flex-1" />
          <span className="text-xs text-ink-secondary tabular-nums hidden sm:inline">
            Planned {formatMoneyDecimal(subtotals.estimated as unknown as { toString(): string })}
          </span>
          <span className="text-xs text-moss-700 tabular-nums font-medium hidden sm:inline">
            Paid {formatMoneyDecimal(subtotals.paid as unknown as { toString(): string })}
          </span>
        </button>
        <div className="flex gap-1 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)} disabled={pending}>+ Line</Button>
          <Button variant="ghost" size="sm" onClick={onDeleteCat} disabled={pending}>Delete</Button>
        </div>
      </div>
      {!collapsed && (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider bg-canvas">
              <th className="px-4 py-2 text-left">Item</th>
              <th className="px-4 py-2 text-right w-28">Planned</th>
              <th className="px-4 py-2 text-right w-28">Actual</th>
              <th className="px-4 py-2 text-right w-28">Paid</th>
              <th className="px-4 py-2 w-32">Supplier</th>
              <th className="px-4 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {category.lines.map((l) => (
              <LineRow key={l.id} line={l} categoryId={category.id} suppliers={suppliers} />
            ))}
            {category.lines.length === 0 && !adding && (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-xs text-ink-tertiary italic text-center">No lines yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
      {adding && (
        <div className="border-t border-border-soft p-3">
          <NewLineForm
            categoryId={category.id}
            suppliers={suppliers}
            onDone={() => setAdding(false)}
          />
        </div>
      )}
    </section>
  );
}

function LineRow({ line, categoryId, suppliers }: { line: Line; categoryId: string; suppliers: Supplier[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const supplierName = line.supplierId ? suppliers.find((s) => s.id === line.supplierId)?.name : null;

  function onDelete() {
    if (!confirm(`Delete "${line.description}"?`)) return;
    startTransition(async () => {
      await deleteLine(line.id);
    });
  }

  if (editing) {
    return (
      <tr className="border-b border-border-soft last:border-b-0">
        <td colSpan={6} className="p-3 bg-moss-50/30">
          <NewLineForm
            categoryId={categoryId}
            suppliers={suppliers}
            initial={{
              description: line.description,
              estimated: line.estimated ? line.estimated.toString() : "",
              actual: line.actual ? line.actual.toString() : "",
              paid: line.paid ? line.paid.toString() : "",
              supplierId: line.supplierId,
              notes: line.notes ?? "",
            }}
            paymentsSum={sumOfPayments(line)}
            paymentsCount={line.payments.length}
            onDone={() => setEditing(false)}
            existingId={line.id}
            submitLabel="Save"
          />
        </td>
      </tr>
    );
  }

  // B2: actual is the manual override if set, otherwise sum of payments.
  // The "Σ" pill marks computed totals so the user can tell at a glance
  // which lines are pinned vs. derived.
  const actualResolved = computeActual(line);
  const isManual = isManualOverride(line);
  const paymentsSum = sumOfPayments(line);

  return (
    <tr className="border-b border-border-soft last:border-b-0 hover:bg-muted/30">
      <td className="px-4 py-2">
        <div className="text-sm text-ink-primary">{line.description}</div>
        {line.notes && <div className="text-xs text-ink-tertiary line-clamp-1">{line.notes}</div>}
      </td>
      <td className="px-4 py-2 text-right text-sm text-ink-secondary tabular-nums">{formatMoneyDecimal(line.estimated)}</td>
      <td className="px-4 py-2 text-right text-sm text-ink-secondary tabular-nums">
        <span title={isManual
          ? `Manual override. Sum of ${line.payments.length} payment${line.payments.length === 1 ? "" : "s"}: ${formatMoneyDecimal(paymentsSum as unknown as { toString(): string })}`
          : `Computed from ${line.payments.length} payment${line.payments.length === 1 ? "" : "s"}. Edit and set "Actual" to pin a manual override.`}>
          {formatMoneyDecimal(actualResolved as unknown as { toString(): string })}
          {!isManual && line.payments.length > 0 && (
            <span className="ml-1 text-[9px] text-ink-tertiary font-bold">Σ</span>
          )}
        </span>
      </td>
      <td className="px-4 py-2 text-right text-sm text-moss-700 tabular-nums font-medium">{formatMoneyDecimal(line.paid)}</td>
      <td className="px-4 py-2 text-xs text-ink-tertiary truncate">{supplierName ?? "—"}</td>
      <td className="px-4 py-2">
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>×</Button>
        </div>
      </td>
    </tr>
  );
}

function NewLineForm({
  categoryId,
  suppliers,
  onDone,
  initial,
  existingId,
  submitLabel = "Add line",
  paymentsSum,
  paymentsCount,
}: {
  categoryId: string;
  suppliers: Supplier[];
  onDone: () => void;
  initial?: {
    description?: string;
    estimated?: string;
    actual?: string;
    paid?: string;
    supplierId?: string | null;
    notes?: string;
  };
  existingId?: string;
  submitLabel?: string;
  // B2: when editing an existing line, pass through the payments sum so
  // the form can show "Computed from £X" beneath the Actual field.
  paymentsSum?: number;
  paymentsCount?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hasManualActual = !!initial?.actual;
  const hasPayments = (paymentsCount ?? 0) > 0;

  async function handle(formData: FormData) {
    setError(null);
    formData.set("categoryId", categoryId);
    startTransition(async () => {
      try {
        if (existingId) {
          await updateLine(existingId, formData);
        } else {
          await createLine(formData);
        }
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form action={handle} className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <Input name="description" defaultValue={initial?.description ?? ""} required placeholder="Item description" className="md:col-span-2" />
        <Input name="estimated" type="number" step="0.01" defaultValue={initial?.estimated ?? ""} placeholder="Planned £" />
        <Input name="actual" type="number" step="0.01" defaultValue={initial?.actual ?? ""}
          placeholder={hasPayments && !hasManualActual ? `Σ £${(paymentsSum ?? 0).toFixed(2)}` : "Actual £"} />
        <Input name="paid" type="number" step="0.01" defaultValue={initial?.paid ?? ""} placeholder="Paid £" />
        <select name="supplierId" defaultValue={initial?.supplierId ?? ""} className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
          <option value="">— supplier —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {existingId && hasPayments && (
        <p className="text-[11px] text-ink-tertiary">
          {hasManualActual
            ? `Manual override active. Clear "Actual" to recompute from payments (£${(paymentsSum ?? 0).toFixed(2)} across ${paymentsCount} payment${paymentsCount === 1 ? "" : "s"}).`
            : `Actual is computed from ${paymentsCount} payment${paymentsCount === 1 ? "" : "s"} (£${(paymentsSum ?? 0).toFixed(2)}). Set a value to pin a manual override.`}
        </p>
      )}
      <textarea name="notes" defaultValue={initial?.notes ?? ""} rows={2} placeholder="Notes (optional)"
        className="w-full text-xs bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500" />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}

function AddCategory() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>+ New category</Button>;
  }
  return (
    <form
      action={(fd) => startTransition(async () => { await createCategory(fd); setOpen(false); })}
      className="flex gap-2 items-center"
    >
      <Input name="name" required autoFocus placeholder="Category name" />
      <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "…" : "Add"}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
    </form>
  );
}
