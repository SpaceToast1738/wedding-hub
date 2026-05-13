"use client";

import { useState, useTransition } from "react";
import type { PerHeadSource } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoneyDecimal } from "@/lib/format";
import { applyMinimum, computeActual, computeCompositeActual, computeCompositePaid, computeEstimated, computePaid, isManualOverride, sumOfPayments } from "@/lib/budget";
import { createComponent, deleteComponent, updateComponent } from "./actions";
import { perHeadSourceLabel, perHeadSourceNoun } from "@/lib/headcount";
import { createCategory, createLine, deleteCategory, deleteLine, updateLine } from "./actions";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type Supplier = { id: string; name: string };

// v1.80.0: composite-line component. Either flat or per-head.
// v1.81.0: + minimumHeadcount for vendor minimum-cover clauses.
export type Component = {
  id: string;
  label: string;
  flatPence: number | null;
  perHeadPence: number | null;
  headcountSource: PerHeadSource | null;
  manualHeadcount: number | null;
  minimumHeadcount: number | null;
  notes: string | null;
  order: number;
  // v1.82.0: + payment status so the Paid column can sum PAID-only.
  payments: { amount: string; status: string }[];
};

type Line = {
  id: string;
  description: string;
  estimated: { toString: () => string } | null;
  actual: { toString: () => string } | null;
  paid: { toString: () => string } | null;
  supplierId: string | null;
  notes: string | null;
  // B2: linked payments so `actual` can be recomputed when null.
  // v1.82.0: + payment status so the Paid column can sum PAID-only.
  payments: { amount: string; status: string }[];
  // v1.77.0: per-head pricing config. When perHeadPence + headcountSource
  // are both set, the row's effective estimated is computed live.
  perHeadPence: number | null;
  headcountSource: PerHeadSource | null;
  manualHeadcount: number | null;
  // v1.81.0: vendor minimum-cover floor.
  minimumHeadcount: number | null;
  // v1.80.0: composite-line components. When non-empty, the line's
  // effective estimated is the sum of components' effective values
  // (and the line-level flat/perHead fields are ignored by the
  // renderer until all components are removed).
  components: Component[];
};

type Category = { id: string; name: string; lines: Line[] };

type HeadcountMap = Record<Exclude<PerHeadSource, "MANUAL">, number>;

// v1.77.0: resolve a line's effective estimated against the
// pre-fetched headcounts map.
function resolveHeadcount(line: Line, headcounts: HeadcountMap): number | null {
  if (line.headcountSource == null) return null;
  if (line.headcountSource === "MANUAL") return Math.max(0, line.manualHeadcount ?? 0);
  return headcounts[line.headcountSource];
}
// v1.80.0: same shape for a component.
function resolveComponentHeadcount(component: Component, headcounts: HeadcountMap): number | null {
  if (component.headcountSource == null) return null;
  if (component.headcountSource === "MANUAL") return Math.max(0, component.manualHeadcount ?? 0);
  return headcounts[component.headcountSource];
}
function componentEffectiveEstimated(component: Component, headcounts: HeadcountMap): number {
  if (component.perHeadPence != null && component.headcountSource != null) {
    const raw = resolveComponentHeadcount(component, headcounts) ?? 0;
    const effective = applyMinimum(raw, component.minimumHeadcount ?? null);
    return (component.perHeadPence * effective) / 100;
  }
  if (component.flatPence != null) return component.flatPence / 100;
  return 0;
}

// v1.81.0: compute the resolved + effective counts together for the
// breakdown display. `resolved` is the count from the source (or
// manual); `effective` is `max(resolved, minimum)`. When they
// differ, the minimum is doing work — UI shows both.
function resolveComponentCount(
  component: Component,
  headcounts: HeadcountMap,
): { resolved: number; effective: number } {
  const raw = resolveComponentHeadcount(component, headcounts) ?? 0;
  const effective = applyMinimum(raw, component.minimumHeadcount ?? null);
  return { resolved: raw, effective };
}
function resolveLineCount(
  line: Line,
  headcounts: HeadcountMap,
): { resolved: number; effective: number } {
  const raw = resolveHeadcount(line, headcounts) ?? 0;
  const effective = applyMinimum(raw, line.minimumHeadcount ?? null);
  return { resolved: raw, effective };
}
function componentActual(component: Component): number {
  return component.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

function effectiveEstimated(line: Line, headcounts: HeadcountMap): number {
  // v1.80.0: components win when present.
  if (line.components.length > 0) {
    return line.components.reduce(
      (sum, c) => sum + componentEffectiveEstimated(c, headcounts),
      0,
    );
  }
  const count = resolveHeadcount(line, headcounts);
  return computeEstimated(
    {
      estimated: line.estimated,
      perHeadPence: line.perHeadPence,
      headcountSource: line.headcountSource,
      minimumHeadcount: line.minimumHeadcount,
    },
    count,
  );
}

// v1.80.0: line actual — sum of line-level payments AND any
// component-level payments (manual override on the line still wins
// per the B2 contract). Wraps computeCompositeActual for the
// general case; falls through to plain computeActual when no
// components exist so the existing B2 tests don't drift.
function lineActual(line: Line): number {
  if (line.components.length > 0) {
    return computeCompositeActual(line);
  }
  return computeActual(line);
}

// v1.82.0: line paid — same shape as lineActual, but filters
// payments to PAID status only. Manual `paid` on the line still wins
// per the B2 contract. Pre-fix the Paid column rendered the manual
// value verbatim and ignored linked PAID payments.
function linePaid(line: Line): number {
  if (line.components.length > 0) {
    return computeCompositePaid(line);
  }
  return computePaid(line);
}


// v1.57.0 (XL5): map of budgetLineId → BUILD card so each LineRow
// can render a deep-link chip back to the source card.
type BuildCardLink = { sectionSlug: string; subsectionSlug: string; title: string };

export function BudgetClient({
  categories,
  suppliers,
  buildCardByLineId = {},
  headcounts,
}: {
  categories: Category[];
  suppliers: Supplier[];
  buildCardByLineId?: Record<string, BuildCardLink>;
  /** v1.77.0: live per-source counts for resolving per-head lines. */
  headcounts: HeadcountMap;
}) {
  const totals = categories.reduce(
    (acc, c) => {
      for (const l of c.lines) {
        acc.estimated += effectiveEstimated(l, headcounts);
        acc.actual += lineActual(l);
        acc.paid += linePaid(l);
      }
      return acc;
    },
    { estimated: 0, actual: 0, paid: 0 },
  );
  const remaining = totals.actual - totals.paid;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <SummaryBar totals={totals} remaining={remaining} />
        {categories.length === 0 ? (
          <p className="text-sm text-ink-tertiary text-center py-12">
            No budget categories yet. Add one below to get started.
          </p>
        ) : (
          categories.map((c) => (
            <CategoryBlock
              key={c.id}
              category={c}
              suppliers={suppliers}
              buildCardByLineId={buildCardByLineId}
              headcounts={headcounts}
            />
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

function CategoryBlock({
  category,
  suppliers,
  buildCardByLineId = {},
  headcounts,
}: {
  category: Category;
  suppliers: Supplier[];
  buildCardByLineId?: Record<string, BuildCardLink>;
  headcounts: HeadcountMap;
}) {
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function onDeleteCat() {
    // v1.53.0: server action validates the empty-category constraint
    // and returns a friendly message. Pre-fix used raw alert() — now
    // we just attempt + show the toast on rejection. (Belt-and-braces
    // client-side check below for the common path so the user doesn't
    // see a network round-trip on the obvious case.)
    if (category.lines.length > 0) {
      notify(
        "error",
        `Can't delete "${category.name}" — ${category.lines.length} line${category.lines.length === 1 ? "" : "s"} still in this category. Move or delete them first.`,
      );
      return;
    }
    if (!(await confirm({ title: `Delete category "${category.name}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      const res = await deleteCategory(category.id);
      if (res.ok) notify("success", "Category deleted");
      else notify("error", res.error);
    });
  }

  // Subtotals so the user gets per-category numbers without having to scan rows.
  const subtotals = category.lines.reduce(
    (acc, l) => ({
      estimated: acc.estimated + effectiveEstimated(l, headcounts),
      actual: acc.actual + lineActual(l),
      paid: acc.paid + linePaid(l),
    }),
    { estimated: 0, actual: 0, paid: 0 },
  );
  // v1.77.0: any line over its effective estimated triggers a small
  // warning chip on the category header so the user can spot
  // problem categories at a glance.
  const overBudgetLineCount = category.lines.filter((l) => {
    const est = effectiveEstimated(l, headcounts);
    return est > 0 && lineActual(l) > est;
  }).length;

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
          {overBudgetLineCount > 0 && (
            <span
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border bg-danger-bg text-danger border-danger-border"
              title={`${overBudgetLineCount} line${overBudgetLineCount === 1 ? "" : "s"} over budget`}
            >
              ⚠ {overBudgetLineCount} over
            </span>
          )}
          <span className="flex-1" />
          <span className="text-xs text-ink-secondary tabular-nums hidden sm:inline">
            Planned {formatMoneyDecimal(subtotals.estimated as unknown as { toString(): string })}
          </span>
          <span className="text-xs text-moss-700 tabular-nums font-medium hidden sm:inline">
            Paid {formatMoneyDecimal(subtotals.paid as unknown as { toString(): string })}
          </span>
        </button>
        <div className="flex gap-1 flex-shrink-0">
          <a
            href={`/payments?category=${category.id}`}
            className="text-[11px] text-info hover:underline self-center mr-1"
            title={`Show all payments in ${category.name}`}
          >
            ↗ Payments
          </a>
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
              <LineRow key={l.id} line={l} categoryId={category.id} suppliers={suppliers} buildCard={buildCardByLineId[l.id]} headcounts={headcounts} />
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

function LineRow({
  line,
  categoryId,
  suppliers,
  buildCard,
  headcounts,
}: {
  line: Line;
  categoryId: string;
  suppliers: Supplier[];
  buildCard?: BuildCardLink;
  headcounts: HeadcountMap;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const supplierName = line.supplierId ? suppliers.find((s) => s.id === line.supplierId)?.name : null;
  const confirm = useConfirm();

  async function onDelete() {
    if (!(await confirm({ title: `Delete "${line.description}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      const res = await deleteLine(line.id);
      if (res.ok) notify("success", "Line deleted");
      else notify("error", res.error);
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
              perHeadPence: line.perHeadPence,
              headcountSource: line.headcountSource,
              manualHeadcount: line.manualHeadcount,
            }}
            paymentsSum={sumOfPayments(line)}
            paymentsCount={line.payments.length}
            onDone={() => setEditing(false)}
            existingId={line.id}
            submitLabel="Save"
            headcounts={headcounts}
          />
          {/* v1.80.0: composite breakdown editor — live, separate
              from the line form. Components can be added / deleted
              without dirtying the line save. */}
          <ComponentsPanel
            lineId={line.id}
            components={line.components}
            headcounts={headcounts}
          />
        </td>
      </tr>
    );
  }

  // B2: actual is the manual override if set, otherwise sum of payments.
  // The "Σ" pill marks computed totals so the user can tell at a glance
  // which lines are pinned vs. derived.
  const actualResolved = lineActual(line);
  const isManual = isManualOverride(line);
  const paymentsSum = sumOfPayments(line);
  // v1.77.0: per-head breakdown chip + over-budget flag.
  // v1.81.0: + minimumHeadcount can floor the multiplier.
  const isPerHead = line.perHeadPence != null && line.headcountSource != null;
  const { resolved: rawCount, effective: effectiveCount } = resolveLineCount(line, headcounts);
  const minimumKickedIn = isPerHead && effectiveCount > rawCount;
  const estimatedResolved = effectiveEstimated(line, headcounts);
  const overBudget = estimatedResolved > 0 && actualResolved > estimatedResolved;

  return (
    <>
    <tr className="border-b border-border-soft last:border-b-0 hover:bg-muted/30">
      <td className="px-4 py-2">
        <div className="text-sm text-ink-primary flex items-baseline gap-2 flex-wrap">
          <span>{line.description}</span>
          {/* v1.57.0 (XL5): chip linking back to the source BUILD
              card when this line was created via "Copy materials to
              Budget" (v1.31.0). */}
          {buildCard && (
            <a
              href={`/book/${buildCard.sectionSlug}#${buildCard.subsectionSlug}`}
              className="text-[10px] text-info bg-[color:#eef4f5] dark:bg-muted border border-[color:#d0e4e8] dark:border-border-soft px-1 rounded hover:underline"
              title={`Linked from DIY card: ${buildCard.title}`}
            >
              ↗ DIY · {buildCard.title}
            </a>
          )}
          {overBudget && (
            <span
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border bg-danger-bg text-danger border-danger-border"
              title={`Actual exceeds planned by £${(actualResolved - estimatedResolved).toFixed(2)}`}
            >
              ⚠ Over
            </span>
          )}
        </div>
        {line.notes && <div className="text-xs text-ink-tertiary line-clamp-1">{line.notes}</div>}
        {isPerHead && line.perHeadPence != null && (
          <div className="text-[11px] text-ink-tertiary mt-0.5">
            £{(line.perHeadPence / 100).toFixed(2)} ×{" "}
            <span className={minimumKickedIn ? "text-marigold-700 font-semibold" : undefined}>
              {effectiveCount}
            </span>{" "}
            {minimumKickedIn ? (
              <>(min, actual {rawCount})</>
            ) : (
              <>
                {perHeadSourceNoun(line.headcountSource!, effectiveCount)}
                {line.headcountSource !== "MANUAL" && (
                  <> ({perHeadSourceLabel(line.headcountSource!)})</>
                )}
              </>
            )}
            {" = "}
            <span className="text-ink-secondary tabular-nums">
              £{estimatedResolved.toFixed(2)}
            </span>
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-right text-sm text-ink-secondary tabular-nums">
        {isPerHead
          ? `£${estimatedResolved.toFixed(2)}`
          : formatMoneyDecimal(line.estimated)}
      </td>
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
      <td className="px-4 py-2 text-right text-sm text-moss-700 tabular-nums font-medium">
        {formatMoneyDecimal(linePaid(line) as unknown as { toString(): string })}
        {/* v1.82.0: when paid is computed (not a manual override) AND
            any linked payments are PAID, show the Σ pill so the user
            knows it's a rollup. Mirrors the Actual column treatment. */}
        {line.paid == null && linePaid(line) > 0 && (
          <span className="ml-1 text-[9px] text-ink-tertiary font-bold">Σ</span>
        )}
      </td>
      <td className="px-4 py-2 text-xs text-ink-tertiary truncate">{supplierName ?? "—"}</td>
      <td className="px-4 py-2">
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>×</Button>
        </div>
      </td>
    </tr>
      {/* v1.80.0: composite breakdown — render each component as
          an indented sub-row beneath the line. Component-level
          estimated derives the same way the line does (flat or
          per-head); component-level actual sums its linked
          payments. No over-budget chip at the component level — the
          line aggregates that already. */}
      {line.components.length > 0 &&
        line.components.map((c) => {
          const compEst = componentEffectiveEstimated(c, headcounts);
          const compActual = componentActual(c);
          const { resolved: rawC, effective: effC } = resolveComponentCount(c, headcounts);
          const minKick = c.perHeadPence != null && c.headcountSource != null && effC > rawC;
          return (
            <tr key={c.id} className="border-b border-border-soft/50 last:border-b-0 bg-canvas/40">
              <td className="px-4 py-1.5 pl-10">
                <div className="text-[12px] text-ink-secondary">
                  <span className="text-ink-tertiary">└ </span>
                  {c.label}
                </div>
                {c.perHeadPence != null && c.headcountSource && (
                  <div className="text-[10px] text-ink-tertiary pl-3.5">
                    £{(c.perHeadPence / 100).toFixed(2)} ×{" "}
                    <span className={minKick ? "text-marigold-700 font-semibold" : undefined}>
                      {effC}
                    </span>{" "}
                    {minKick ? (
                      <>(min, actual {rawC})</>
                    ) : (
                      <>
                        {perHeadSourceNoun(c.headcountSource, effC)}
                        {c.headcountSource !== "MANUAL" && (
                          <> ({perHeadSourceLabel(c.headcountSource)})</>
                        )}
                      </>
                    )}
                  </div>
                )}
              </td>
              <td className="px-4 py-1.5 text-right text-[12px] text-ink-tertiary tabular-nums">
                £{compEst.toFixed(2)}
              </td>
              <td className="px-4 py-1.5 text-right text-[12px] text-ink-tertiary tabular-nums">
                {compActual > 0 ? `£${compActual.toFixed(2)}` : "—"}
              </td>
              <td className="px-4 py-1.5"></td>
              <td className="px-4 py-1.5"></td>
              <td className="px-4 py-1.5"></td>
            </tr>
          );
        })}
    </>
  );
}

// v1.80.0: inline editor for a single line's components. Each row
// has Edit / Delete affordances. Click Edit → row swaps for a
// ComponentForm in update mode. + Add component at the bottom opens
// the same form in create mode. v1.82.0: form supports MANUAL source
// + notes textarea; new headcount sources (adults / children + pending).
function ComponentsPanel({
  lineId,
  components,
  headcounts,
}: {
  lineId: string;
  components: Component[];
  headcounts: HeadcountMap;
}) {
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const confirm = useConfirm();

  async function onDelete(c: Component) {
    if (
      !(await confirm({
        title: `Delete "${c.label}"?`,
        body: "Linked payments stay; their component link clears.",
        confirmLabel: "Delete",
        tone: "danger",
      }))
    )
      return;
    startTransition(async () => {
      const res = await deleteComponent(c.id);
      if (res.ok) notify("success", "Component deleted");
      else notify("error", res.error ?? "Couldn't delete");
    });
  }

  return (
    <div className="mt-2 p-3 border border-border-soft bg-canvas/60 rounded-sm">
      <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-2">
        Components ({components.length})
      </div>
      {components.length === 0 ? (
        <p className="text-[11px] text-ink-tertiary italic mb-2">
          No components yet. Add one to split this line into sub-costs (e.g. meals,
          drinks, fees) — the line&apos;s estimated will become the sum.
        </p>
      ) : (
        <ul className="space-y-1 mb-2">
          {components.map((c) => {
            if (editingId === c.id) {
              return (
                <li key={c.id}>
                  <ComponentForm
                    mode="edit"
                    initial={c}
                    pending={pending}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(payload) =>
                      new Promise((resolve) => {
                        startTransition(async () => {
                          const res = await updateComponent(c.id, payload);
                          if (res.ok) {
                            notify("success", "Component saved");
                            setEditingId(null);
                          } else {
                            notify("error", res.error ?? "Couldn't save");
                          }
                          resolve();
                        });
                      })
                    }
                  />
                </li>
              );
            }
            const est = componentEffectiveEstimated(c, headcounts);
            const { resolved, effective } = resolveComponentCount(c, headcounts);
            const minKick =
              c.perHeadPence != null && c.headcountSource != null && effective > resolved;
            return (
              <li key={c.id} className="flex items-center gap-2 text-[12px]">
                <span className="flex-1 text-ink-primary">
                  {c.label}
                  {c.notes && (
                    <span className="ml-1 text-[10px] text-ink-tertiary italic" title={c.notes}>
                      📝
                    </span>
                  )}
                </span>
                <span className="text-ink-tertiary tabular-nums">
                  {c.perHeadPence != null && c.headcountSource ? (
                    <>
                      £{(c.perHeadPence / 100).toFixed(2)} ×{" "}
                      <span className={minKick ? "text-marigold-700 font-semibold" : undefined}>
                        {effective}
                      </span>
                      {minKick && (
                        <span className="text-marigold-700"> (min, actual {resolved})</span>
                      )}{" "}
                      = £{est.toFixed(2)}
                    </>
                  ) : (
                    <>£{est.toFixed(2)}</>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingId(c.id)}
                  disabled={pending}
                  className="text-[11px] text-ink-tertiary hover:text-moss-700 px-1"
                  title="Edit component"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(c)}
                  disabled={pending}
                  className="text-ink-tertiary hover:text-danger px-1"
                  title="Delete component"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {showAdd ? (
        <ComponentForm
          mode="create"
          pending={pending}
          onCancel={() => setShowAdd(false)}
          onSubmit={(payload) =>
            new Promise((resolve) => {
              startTransition(async () => {
                const res = await createComponent({ lineId, ...payload });
                if (res.ok) {
                  notify("success", `Added "${payload.label}"`);
                  setShowAdd(false);
                } else {
                  notify("error", res.error ?? "Couldn't add");
                }
                resolve();
              });
            })
          }
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAdd(true)}
          disabled={pending}
        >
          + Add component
        </Button>
      )}
    </div>
  );
}

// v1.82.0: shared component editor used by both add (create) and per-
// row edit (update). Mode + initial state drive defaults; submit
// returns a payload the parent persists via the appropriate action.
type ComponentFormPayload = {
  label: string;
  flatPence: number | null;
  perHeadPence: number | null;
  headcountSource: PerHeadSource | null;
  manualHeadcount: number | null;
  minimumHeadcount: number | null;
  notes: string | null;
};

function ComponentForm({
  mode,
  initial,
  pending,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial?: Component;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (payload: ComponentFormPayload) => Promise<void>;
}) {
  const initialMode: "flat" | "perHead" =
    initial?.perHeadPence != null ? "perHead" : "flat";
  const [label, setLabel] = useState(initial?.label ?? "");
  const [costMode, setCostMode] = useState<"flat" | "perHead">(initialMode);
  const [pounds, setPounds] = useState<string>(() => {
    if (initial?.perHeadPence != null) return (initial.perHeadPence / 100).toFixed(2);
    if (initial?.flatPence != null) return (initial.flatPence / 100).toFixed(2);
    return "";
  });
  const [source, setSource] = useState<PerHeadSource | "">(
    initial?.headcountSource ?? "CONFIRMED_PLUS_PENDING",
  );
  const [manualStr, setManualStr] = useState<string>(
    initial?.manualHeadcount != null ? String(initial.manualHeadcount) : "",
  );
  const [minimumStr, setMinimumStr] = useState<string>(
    initial?.minimumHeadcount != null ? String(initial.minimumHeadcount) : "",
  );
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");

  function submit() {
    const trimmedLabel = label.trim();
    const pence = Math.round((parseFloat(pounds) || 0) * 100);
    if (!trimmedLabel) {
      notify("error", "Component needs a label");
      return;
    }
    if (pence <= 0) {
      notify("error", "Component needs a price > 0");
      return;
    }
    const minimum = (() => {
      const n = parseInt(minimumStr, 10);
      return isNaN(n) || n <= 0 ? null : n;
    })();
    const manual = (() => {
      const n = parseInt(manualStr, 10);
      return isNaN(n) || n < 0 ? null : n;
    })();
    void onSubmit({
      label: trimmedLabel,
      flatPence: costMode === "flat" ? pence : null,
      perHeadPence: costMode === "perHead" ? pence : null,
      headcountSource: costMode === "perHead" && source ? source : null,
      manualHeadcount: costMode === "perHead" && source === "MANUAL" ? manual : null,
      minimumHeadcount: costMode === "perHead" ? minimum : null,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end pt-2 border-t border-border-soft">
      <div className="sm:col-span-2">
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Meals"
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2.5 py-1.5"
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Mode
        </label>
        <select
          value={costMode}
          onChange={(e) => setCostMode(e.target.value as "flat" | "perHead")}
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5"
        >
          <option value="flat">Flat £</option>
          <option value="perHead">£ × head</option>
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          {costMode === "flat" ? "Amount £" : "Per head £"}
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={pounds}
          onChange={(e) => setPounds(e.target.value)}
          placeholder="0.00"
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2.5 py-1.5 tabular-nums"
        />
      </div>
      {costMode === "perHead" && (
        <>
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Source
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as PerHeadSource)}
              className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5"
            >
              <option value="ALL_INVITED">All invited</option>
              <option value="CONFIRMED_PLUS_PENDING">Confirmed + pending</option>
              <option value="ADULTS_PENDING_OR_CONFIRMED">Adults confirmed + pending</option>
              <option value="CHILDREN_PENDING_OR_CONFIRMED">Children confirmed + pending</option>
              <option value="ALL_CONFIRMED">Confirmed</option>
              <option value="ADULTS_CONFIRMED">Adults confirmed</option>
              <option value="CHILDREN_CONFIRMED">Children confirmed</option>
              <option value="MANUAL">Manual count</option>
            </select>
          </div>
          {source === "MANUAL" && (
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Manual count
              </label>
              <input
                type="number"
                min="0"
                value={manualStr}
                onChange={(e) => setManualStr(e.target.value)}
                placeholder="e.g. 4"
                className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2.5 py-1.5 tabular-nums"
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Min
            </label>
            <input
              type="number"
              min="0"
              value={minimumStr}
              onChange={(e) => setMinimumStr(e.target.value)}
              placeholder="optional"
              title="Vendor minimum — multiplier = max(count, minimum)"
              className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2.5 py-1.5 tabular-nums"
            />
          </div>
        </>
      )}
      {/* Notes spans the full row width so the textarea has room. */}
      <div className="sm:col-span-6">
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. quoted by venue 12 Apr"
          className="w-full text-xs bg-surface border border-border-soft rounded-sm px-2.5 py-1.5"
        />
      </div>
      <div className="sm:col-span-6 flex gap-1 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={submit} disabled={pending}>
          {pending ? "…" : mode === "create" ? "Add" : "Save"}
        </Button>
      </div>
    </div>
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
  headcounts,
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
    // v1.77.0
    perHeadPence?: number | null;
    headcountSource?: PerHeadSource | null;
    manualHeadcount?: number | null;
    // v1.81.0
    minimumHeadcount?: number | null;
  };
  existingId?: string;
  submitLabel?: string;
  // B2: when editing an existing line, pass through the payments sum so
  // the form can show "Computed from £X" beneath the Actual field.
  paymentsSum?: number;
  paymentsCount?: number;
  /** v1.77.0: pre-fetched counts so the form can preview "= £X" live
   *  as the user types per-head price + picks a source. Optional —
   *  the create-form path doesn't have it yet (would need page
   *  threading); the edit-form path does. */
  headcounts?: HeadcountMap;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hasManualActual = !!initial?.actual;
  const hasPayments = (paymentsCount ?? 0) > 0;

  // v1.77.0: Variable cost toggle. When on, the line's "Planned" stat
  // is derived from `perHeadPence × headcount` and the flat
  // `estimated` field is hidden.
  const [variableMode, setVariableMode] = useState<boolean>(
    initial?.perHeadPence != null || initial?.headcountSource != null,
  );
  const [perHeadStr, setPerHeadStr] = useState<string>(
    initial?.perHeadPence != null ? (initial.perHeadPence / 100).toFixed(2) : "",
  );
  const [source, setSource] = useState<PerHeadSource | "">(
    initial?.headcountSource ?? "",
  );
  const [manualStr, setManualStr] = useState<string>(
    initial?.manualHeadcount != null ? String(initial.manualHeadcount) : "",
  );
  // v1.81.0: minimum-cover input. Empty = no minimum; integer ≥ 0
  // floors the multiplier when the resolved count is lower.
  const [minimumStr, setMinimumStr] = useState<string>(
    initial?.minimumHeadcount != null ? String(initial.minimumHeadcount) : "",
  );
  // Live preview of the computed total based on current inputs.
  // v1.81.0: minimum applies to the multiplier before pricing.
  const previewCount = (() => {
    if (source === "") return null;
    if (source === "MANUAL") {
      const n = parseInt(manualStr, 10);
      return isNaN(n) ? null : Math.max(0, n);
    }
    if (!headcounts) return null;
    return headcounts[source];
  })();
  const previewMinimum = (() => {
    const n = parseInt(minimumStr, 10);
    return isNaN(n) ? null : Math.max(0, n);
  })();
  const previewEffectiveCount =
    previewCount != null && previewMinimum != null
      ? Math.max(previewCount, previewMinimum)
      : previewCount;
  const previewPerHead = parseFloat(perHeadStr);
  const previewTotal =
    !isNaN(previewPerHead) && previewEffectiveCount != null
      ? previewPerHead * previewEffectiveCount
      : null;
  const previewMinimumKicked =
    previewMinimum != null &&
    previewCount != null &&
    previewMinimum > previewCount;

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
        {variableMode ? (
          // v1.77.0: hide the flat estimated input but pass null
          // through so the server clears it when switching modes.
          <input type="hidden" name="estimated" value="" />
        ) : (
          <Input name="estimated" type="number" step="0.01" defaultValue={initial?.estimated ?? ""} placeholder="Planned £" />
        )}
        <Input name="actual" type="number" step="0.01" defaultValue={initial?.actual ?? ""}
          placeholder={hasPayments && !hasManualActual ? `Σ £${(paymentsSum ?? 0).toFixed(2)}` : "Actual £"}
          className={variableMode ? "md:col-start-4" : undefined} />
        <Input name="paid" type="number" step="0.01" defaultValue={initial?.paid ?? ""} placeholder="Paid £" />
        <select name="supplierId" defaultValue={initial?.supplierId ?? ""} className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
          <option value="">— supplier —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {/* v1.77.0: variable / per-head pricing toggle. */}
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-[11px] text-ink-secondary">
          <input
            type="checkbox"
            checked={variableMode}
            onChange={(e) => setVariableMode(e.target.checked)}
          />
          Variable cost (£ × headcount)
        </label>
      </div>
      {variableMode && (
        <div className="bg-canvas/40 border border-border-soft rounded-sm p-2.5 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Per head £
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="perHeadPence"
                value={perHeadStr}
                onChange={(e) => setPerHeadStr(e.target.value)}
                placeholder="50.00"
                className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Headcount source
              </label>
              <select
                name="headcountSource"
                value={source}
                onChange={(e) => setSource((e.target.value as PerHeadSource) || "")}
                className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1.5 outline-none"
              >
                <option value="">— pick —</option>
                <option value="ALL_INVITED">All invited</option>
                <option value="CONFIRMED_PLUS_PENDING">Confirmed + pending</option>
                <option value="ADULTS_PENDING_OR_CONFIRMED">Adults confirmed + pending</option>
                <option value="CHILDREN_PENDING_OR_CONFIRMED">Children confirmed + pending</option>
                <option value="ALL_CONFIRMED">Confirmed</option>
                <option value="ADULTS_CONFIRMED">Adults confirmed</option>
                <option value="CHILDREN_CONFIRMED">Children confirmed</option>
                <option value="MANUAL">Manual count</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                {source === "MANUAL" ? "Manual count" : "Live count"}
              </label>
              {source === "MANUAL" ? (
                <input
                  type="number"
                  min="0"
                  name="manualHeadcount"
                  value={manualStr}
                  onChange={(e) => setManualStr(e.target.value)}
                  placeholder="e.g. 4"
                  className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500 tabular-nums"
                />
              ) : (
                <div className="text-sm text-ink-secondary px-2.5 py-1.5 tabular-nums bg-canvas border border-dashed border-border-soft rounded-sm">
                  {previewCount ?? "—"}
                </div>
              )}
              {source !== "MANUAL" && (
                // hidden field so the form action sees null/empty
                <input type="hidden" name="manualHeadcount" value="" />
              )}
            </div>
            {/* v1.81.0: optional vendor minimum-cover floor. */}
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Minimum
              </label>
              <input
                type="number"
                min="0"
                name="minimumHeadcount"
                value={minimumStr}
                onChange={(e) => setMinimumStr(e.target.value)}
                placeholder="optional"
                className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500 tabular-nums"
                title="Vendor minimum — multiplier = max(count, minimum)"
              />
            </div>
          </div>
          {previewTotal != null && (
            <p className="text-[11px] text-ink-tertiary">
              Live preview: <strong className="text-ink-secondary tabular-nums">£{previewTotal.toFixed(2)}</strong> (
              {previewMinimumKicked ? (
                <span className="text-marigold-700">
                  {previewEffectiveCount} min, actual {previewCount}
                </span>
              ) : (
                <>{previewEffectiveCount}</>
              )}{" "}
              × £{(previewPerHead || 0).toFixed(2)})
            </p>
          )}
        </div>
      )}
      {/* When variableMode is off, still send the per-head fields as
          null so the server clears any previously-set values. */}
      {!variableMode && (
        <>
          <input type="hidden" name="perHeadPence" value="" />
          <input type="hidden" name="headcountSource" value="" />
          <input type="hidden" name="manualHeadcount" value="" />
          <input type="hidden" name="minimumHeadcount" value="" />
        </>
      )}
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
