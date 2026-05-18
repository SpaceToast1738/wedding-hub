"use client";

import { useEffect, useState, useTransition } from "react";
import type { FundSource, PerHeadSource } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { formatMoneyDecimal } from "@/lib/format";
import { applyMinimum, computeActual, computeCompositeActual, computeCompositePaid, computeEstimated, computePaid, isManualOverride, sumOfPayments, type BudgetFundFilter } from "@/lib/budget";
import { effectiveFundForComponent, effectiveFundForPayment, formatFundChip, FUND_KEYS, resolveFundLabels, type FundKey, type FundLabels } from "@/lib/funds";
import { createComponent, deleteComponent, setComponentFund, setLineFund, updateComponent } from "./actions";
import { perHeadSourceLabel, perHeadSourceNoun } from "@/lib/headcount";
import { createCategory, createLine, deleteCategory, deleteLine, renameCategory, reorderCategories, updateLine } from "./actions";
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
  // v1.86.0: + payment fund fields so the client filter+rollup is
  // self-contained.
  payments: { amount: string; status: string; fundSource: FundSource | null; fundLabel: string | null }[];
  // v1.86.0: per-component fund override. Null inherits the parent
  // line's fund silently.
  fundSource: FundSource | null;
  fundLabel: string | null;
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
  // v1.86.0: + payment fund fields.
  payments: { amount: string; status: string; fundSource: FundSource | null; fundLabel: string | null }[];
  // v1.86.0: line-level fund (default for child components +
  // payments). Null = unassigned.
  fundSource: FundSource | null;
  fundLabel: string | null;
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
function componentEffectiveEstimated(
  component: Component,
  headcounts: HeadcountMap,
  // v1.86.0: filter + parent line so per-component fund overrides
  // are honoured. Pass undefined to opt out (matches pre-v1.86 behaviour).
  filter?: BudgetFundFilter,
  parentLine?: Line,
): number {
  if (filter && filter.fund !== "ALL") {
    const resolved = parentLine
      ? effectiveFundForComponent(component, parentLine).fund
      : (component.fundSource ?? "UNASSIGNED");
    if (resolved !== filter.fund) return 0;
  }
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
function componentActual(component: Component, parentLine?: Line, filter?: BudgetFundFilter): number {
  // v1.86.0: when a filter is active, only payments whose effective
  // fund matches contribute. Payment fund resolves via the standard
  // payment > component > line chain.
  return component.payments.reduce((sum, p) => {
    if (filter && filter.fund !== "ALL") {
      const fund = effectiveFundForPayment(p, component, parentLine ?? null).fund;
      if (fund !== filter.fund) return sum;
    }
    return sum + (Number(p.amount) || 0);
  }, 0);
}

// v1.86.0: + a small fund-only helper for the component PAID column.
function componentPaid(component: Component, parentLine?: Line, filter?: BudgetFundFilter): number {
  return component.payments.reduce((sum, p) => {
    if (p.status !== "PAID") return sum;
    if (filter && filter.fund !== "ALL") {
      const fund = effectiveFundForPayment(p, component, parentLine ?? null).fund;
      if (fund !== filter.fund) return sum;
    }
    return sum + (Number(p.amount) || 0);
  }, 0);
}

function effectiveEstimated(line: Line, headcounts: HeadcountMap, filter?: BudgetFundFilter): number {
  // v1.80.0: components win when present.
  if (line.components.length > 0) {
    return line.components.reduce(
      (sum, c) => sum + componentEffectiveEstimated(c, headcounts, filter, line),
      0,
    );
  }
  // v1.86.0: filter at the line level.
  if (filter && filter.fund !== "ALL") {
    const lineFund: FundKey = line.fundSource ?? "UNASSIGNED";
    if (lineFund !== filter.fund) return 0;
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
function lineActual(line: Line, filter?: BudgetFundFilter): number {
  if (line.components.length > 0) {
    return computeCompositeActual(line, filter);
  }
  return computeActual(line, filter);
}

// v1.82.0: line paid — same shape as lineActual, but filters
// payments to PAID status only. Manual `paid` on the line still wins
// per the B2 contract. Pre-fix the Paid column rendered the manual
// value verbatim and ignored linked PAID payments.
// v1.86.0: + optional fund filter.
function linePaid(line: Line, filter?: BudgetFundFilter): number {
  if (line.components.length > 0) {
    return computeCompositePaid(line, filter);
  }
  return computePaid(line, filter);
}


// v1.57.0 (XL5): map of budgetLineId → BUILD card so each LineRow
// can render a deep-link chip back to the source card.
type BuildCardLink = { sectionSlug: string; subsectionSlug: string; title: string };

export function BudgetClient({
  categories,
  suppliers,
  buildCardByLineId = {},
  headcounts,
  fundLabelSource,
}: {
  categories: Category[];
  suppliers: Supplier[];
  buildCardByLineId?: Record<string, BuildCardLink>;
  /** v1.77.0: live per-source counts for resolving per-head lines. */
  headcounts: HeadcountMap;
  /** v1.86.0: WeddingSettings bride/groom names → fund chip labels. */
  fundLabelSource: { brideFirst: string; groomFirst: string };
}) {
  // v1.86.0: fund filter. "ALL" is the default (no filter); the four
  // enum values + UNASSIGNED narrow the view. URL ?fund= wins on
  // first render; otherwise localStorage; otherwise "ALL".
  const [fundFilter, setFundFilter] = useState<FundKey | "ALL">("ALL");
  useEffect(() => {
    try {
      // URL param wins first.
      const url = new URLSearchParams(window.location.search);
      const fromUrl = url.get("fund");
      const candidate = fromUrl
        ?? window.localStorage.getItem("wh_budget_fund_filter");
      if (
        candidate === "ALL" ||
        candidate === "JOINT" ||
        candidate === "PERSONAL_BRIDE" ||
        candidate === "PERSONAL_GROOM" ||
        candidate === "OTHER" ||
        candidate === "UNASSIGNED"
      ) {
        setFundFilter(candidate);
      }
    } catch {
      // privacy / SSR — accept default
    }
  }, []);
  const handleFundFilter = (next: FundKey | "ALL") => {
    setFundFilter(next);
    try {
      window.localStorage.setItem("wh_budget_fund_filter", next);
    } catch {
      // best-effort persistence
    }
  };
  const fundLabels = resolveFundLabels(fundLabelSource);
  // The active filter passed into every compute helper below. Memoise-
  // free shape (just an object literal) is fine — the components
  // re-render on every filter change anyway.
  const filter: BudgetFundFilter = { fund: fundFilter };
  const totals = categories.reduce(
    (acc, c) => {
      for (const l of c.lines) {
        acc.estimated += effectiveEstimated(l, headcounts, filter);
        acc.actual += lineActual(l, filter);
        acc.paid += linePaid(l, filter);
      }
      return acc;
    },
    { estimated: 0, actual: 0, paid: 0 },
  );
  // v1.86.0: per-fund totals for the "By fund" strip below the
  // SummaryBar. Computed once per render by re-running each helper
  // five times — cheap (the helpers fold over the same in-memory
  // arrays) and lets the strip render side-by-side with the filter.
  const perFundTotals = FUND_KEYS.reduce(
    (acc, fund) => {
      const sub = categories.reduce(
        (s, c) => {
          for (const l of c.lines) {
            s.estimated += effectiveEstimated(l, headcounts, { fund });
            s.paid += linePaid(l, { fund });
          }
          return s;
        },
        { estimated: 0, paid: 0 },
      );
      acc[fund] = sub;
      return acc;
    },
    {} as Record<FundKey, { estimated: number; paid: number }>,
  );
  // v1.84.0: Outstanding can be computed two ways. "actual" (default,
  // pre-v1.84 behaviour) is "what's been committed but not yet settled" —
  // money the couple has agreed to spend but the cash hasn't left the
  // account yet. "planned" is "how much more we need to find against the
  // budget" — useful when forecasting cashflow rather than tracking
  // commitments. Persisted to localStorage so the user's preference
  // sticks across reloads.
  const [outstandingMode, setOutstandingMode] = useState<"actual" | "planned">("actual");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("wh_budget_outstanding_mode");
      if (stored === "actual" || stored === "planned") {
        setOutstandingMode(stored);
      }
    } catch {
      // localStorage unavailable (SSR / privacy mode) — accept default
    }
  }, []);
  const handleOutstandingMode = (mode: "actual" | "planned") => {
    setOutstandingMode(mode);
    try {
      window.localStorage.setItem("wh_budget_outstanding_mode", mode);
    } catch {
      // best-effort persistence
    }
  };
  const remaining =
    outstandingMode === "planned"
      ? totals.estimated - totals.paid
      : totals.actual - totals.paid;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* v1.86.0: fund filter chips above the tile row. */}
        <FundFilterChips
          active={fundFilter}
          labels={fundLabels}
          onChange={handleFundFilter}
        />
        <SummaryBar
          totals={totals}
          remaining={remaining}
          outstandingMode={outstandingMode}
          onOutstandingModeChange={handleOutstandingMode}
          activeFund={fundFilter}
          fundLabels={fundLabels}
          onClearFund={() => handleFundFilter("ALL")}
        />
        {/* v1.86.0: per-fund summary strip. Hidden when a fund is
            already filtered (the SummaryBar tiles already show that
            fund's numbers). */}
        {fundFilter === "ALL" && (
          <ByFundStrip totals={perFundTotals} labels={fundLabels} onPick={handleFundFilter} />
        )}
        {categories.length === 0 ? (
          <p className="text-sm text-ink-tertiary text-center py-12">
            No budget categories yet. Add one below to get started.
          </p>
        ) : (
          categories.map((c, idx) => (
            <CategoryBlock
              key={c.id}
              category={c}
              suppliers={suppliers}
              buildCardByLineId={buildCardByLineId}
              headcounts={headcounts}
              // v1.86.0: thread the active fund filter + labels down
              // so subtotals + chips re-render.
              fundFilter={filter}
              fundLabels={fundLabels}
              // v1.85.0: reorder controls — ▲/▼ buttons in the header.
              // Parent computes the new id-order and dispatches in one
              // server call so reorder is atomic.
              isFirst={idx === 0}
              isLast={idx === categories.length - 1}
              onMove={(direction) => {
                const i = idx;
                const j = direction === "up" ? i - 1 : i + 1;
                if (j < 0 || j >= categories.length) return;
                const ids = categories.map((x) => x.id);
                const tmp = ids[i]!;
                ids[i] = ids[j]!;
                ids[j] = tmp;
                void reorderCategories(ids).then((res) => {
                  if (!res.ok) notify("error", res.error);
                });
              }}
            />
          ))
        )}
        <AddCategory />
      </div>
    </div>
  );
}

// v1.86.0: chip-row above the SummaryBar. One pill per fund (plus
// ALL); active pill rendered in marigold. Picking a fund recomputes
// every total on the page (the parent component re-derives via
// `effectiveEstimated` / `linePaid` with `filter = { fund }`).
function FundFilterChips({
  active,
  labels,
  onChange,
}: {
  active: FundKey | "ALL";
  labels: FundLabels;
  onChange: (next: FundKey | "ALL") => void;
}) {
  const options: ReadonlyArray<{ key: FundKey | "ALL"; label: string }> = [
    { key: "ALL", label: "All funds" },
    ...FUND_KEYS.map((k) => ({ key: k, label: labels[k] })),
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mr-1">By fund</span>
      {options.map((o) => {
        const isActive = active === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              isActive
                ? "bg-marigold-100 text-marigold-700 border-marigold-300"
                : "bg-surface text-ink-secondary border-border-soft hover:border-border-strong"
            }`}
            aria-pressed={isActive}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// v1.86.0: side-by-side mini-tiles for each fund. Renders only buckets
// with nonzero planned OR paid so a Joint-only wedding doesn't display
// four empty stubs. Clicking a tile narrows the filter.
function ByFundStrip({
  totals,
  labels,
  onPick,
}: {
  totals: Record<FundKey, { estimated: number; paid: number }>;
  labels: FundLabels;
  onPick: (fund: FundKey) => void;
}) {
  const visible = FUND_KEYS.filter(
    (f) => totals[f].estimated > 0 || totals[f].paid > 0,
  );
  if (visible.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
        Breakdown by fund
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onPick(f)}
            className="flex-1 min-w-[140px] text-left bg-surface border border-border-soft hover:border-border-strong rounded-md px-3 py-2 transition-colors"
            title={`Show only ${labels[f]}`}
          >
            <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">
              {labels[f]}
            </div>
            <div className="font-display text-base font-semibold text-ink-primary tabular-nums mt-0.5">
              {formatMoneyDecimal(totals[f].estimated as unknown as { toString(): string })}
            </div>
            <div className="text-[11px] text-moss-700 tabular-nums font-medium">
              Paid {formatMoneyDecimal(totals[f].paid as unknown as { toString(): string })}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// v1.86.0: per-row fund chip + popover picker. Sits in LineRow's
// action area and in each component sub-row. Click → expands a tiny
// inline form: radio of four buckets + an optional free-text label.
// "Inherit" (leftmost option) clears the fund on the row.
function FundChipPicker({
  fundSource,
  fundLabel,
  labels,
  // True when the rendered fund came from a parent (line for component,
  // line for payment-row use case). Drives the "(inherited)" italic.
  inherited,
  onSave,
  disabled,
}: {
  fundSource: FundSource | null;
  fundLabel: string | null;
  labels: FundLabels;
  inherited: boolean;
  onSave: (next: { fundSource: FundSource | null; fundLabel: string | null }) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draftSource, setDraftSource] = useState<FundSource | null>(fundSource);
  const [draftLabel, setDraftLabel] = useState(fundLabel ?? "");
  const effective: FundKey = fundSource ?? "UNASSIGNED";
  const display = formatFundChip(effective, fundLabel, labels);

  function onCommit() {
    onSave({
      fundSource: draftSource,
      fundLabel: draftSource === "OTHER" ? (draftLabel.trim() || null) : null,
    });
    setOpen(false);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          setDraftSource(fundSource);
          setDraftLabel(fundLabel ?? "");
          setOpen((v) => !v);
        }}
        disabled={disabled}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[10px] font-medium ${
          fundSource == null
            ? "bg-canvas text-ink-tertiary border-border-soft"
            : "bg-surface text-ink-secondary border-border-soft"
        } hover:border-border-strong`}
        title={inherited ? `${display} (inherited from parent line)` : display}
      >
        <span>▣</span>
        <span>{display}</span>
        {inherited && <span className="italic text-ink-tertiary ml-0.5">(inh.)</span>}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 right-0 bg-surface border border-border-soft rounded-md shadow-lg p-2 w-56 text-xs">
          <div className="font-medium text-ink-primary mb-1">Set fund</div>
          <div className="space-y-1">
            {([
              { val: null, label: "Inherit / Unassigned" },
              { val: "JOINT" as FundSource, label: labels.JOINT },
              { val: "PERSONAL_BRIDE" as FundSource, label: labels.PERSONAL_BRIDE },
              { val: "PERSONAL_GROOM" as FundSource, label: labels.PERSONAL_GROOM },
              { val: "OTHER" as FundSource, label: labels.OTHER },
            ] as const).map((o) => (
              <label key={o.label} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="fund"
                  checked={draftSource === o.val}
                  onChange={() => setDraftSource(o.val)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {draftSource === "OTHER" && (
            <Input
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="e.g. Bryony's parents"
              className="mt-2 text-xs"
            />
          )}
          <div className="flex gap-1 justify-end mt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-ink-tertiary hover:text-ink-secondary px-2 py-0.5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onCommit}
              className="px-2 py-0.5 rounded-sm bg-moss-500 text-white hover:bg-moss-600"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryBar({
  totals,
  remaining,
  outstandingMode,
  onOutstandingModeChange,
  activeFund,
  fundLabels,
  onClearFund,
}: {
  totals: { estimated: number; actual: number; paid: number };
  remaining: number;
  // v1.84.0: Outstanding can be computed against Actual or Planned.
  outstandingMode: "actual" | "planned";
  onOutstandingModeChange: (mode: "actual" | "planned") => void;
  // v1.86.0: the active fund filter (so the header can show a
  // "Filtered" banner) and a callback to clear it.
  activeFund: FundKey | "ALL";
  fundLabels: FundLabels;
  onClearFund: () => void;
}) {
  const Tile = ({ label, value, accent = "text-ink-primary" }: { label: string; value: string; accent?: string }) => (
    <div className="bg-surface border border-border-soft rounded-md px-4 py-3 flex-1 min-w-[140px]">
      <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">{label}</div>
      <div className={`font-display text-2xl font-semibold mt-1 ${accent}`}>
        {value}
      </div>
    </div>
  );

  // v1.84.0: Outstanding tile gets its own tile renderer so the two-pill
  // mode toggle sits inside the label row. Keeps the Tile API simple for
  // the other three.
  const OutstandingTile = () => {
    const label = outstandingMode === "planned" ? "vs Planned" : "vs Actual";
    const pillClass = (active: boolean) =>
      `px-1.5 py-0.5 rounded text-[10px] font-medium tracking-normal transition-colors ${
        active
          ? "bg-marigold-100 text-marigold-700 border border-marigold-300"
          : "text-ink-tertiary hover:text-ink-secondary border border-transparent"
      }`;
    return (
      <div className="bg-surface border border-border-soft rounded-md px-4 py-3 flex-1 min-w-[140px]">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">
            Outstanding · {label}
          </div>
          <div className="flex items-center gap-0.5" role="group" aria-label="Outstanding computation mode">
            <button
              type="button"
              onClick={() => onOutstandingModeChange("actual")}
              className={pillClass(outstandingMode === "actual")}
              aria-pressed={outstandingMode === "actual"}
              title="Actual − Paid: what's committed but not yet settled"
            >
              Actual
            </button>
            <button
              type="button"
              onClick={() => onOutstandingModeChange("planned")}
              className={pillClass(outstandingMode === "planned")}
              aria-pressed={outstandingMode === "planned"}
              title="Planned − Paid: how much more to find against the budget"
            >
              Planned
            </button>
          </div>
        </div>
        <div
          className={`font-display text-2xl font-semibold mt-1 ${
            remaining > 0 ? "text-marigold-700" : "text-ink-primary"
          }`}
        >
          {formatMoneyDecimal(remaining as unknown as { toString(): string })}
        </div>
      </div>
    );
  };

  // Stacked progress: paid (moss) + (actual - paid) outstanding (marigold)
  // shown against the planned total. If actual > planned the bar caps at
  // the actual total instead and we surface a small "over" note.
  const denominator = Math.max(totals.estimated, totals.actual);
  const paidPct = denominator === 0 ? 0 : (totals.paid / denominator) * 100;
  const actualPct = denominator === 0 ? 0 : (totals.actual / denominator) * 100;
  const overBudget = totals.actual > totals.estimated && totals.estimated > 0;

  return (
    <div className="space-y-3">
      {/* v1.86.0: tiny "Filtered" banner above the tiles when a fund
          filter is active. Clear-link returns to ALL. */}
      {activeFund !== "ALL" && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-marigold-50 border border-marigold-200 text-xs">
          <span className="text-marigold-700">
            Showing <strong>{fundLabels[activeFund]}</strong> only — totals + outstanding scoped to this fund.
          </span>
          <button
            type="button"
            onClick={onClearFund}
            className="text-marigold-700 hover:text-marigold-900 underline"
          >
            Clear filter
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Tile label="Planned" value={formatMoneyDecimal(totals.estimated as unknown as { toString(): string })} />
        <Tile label="Actual" value={formatMoneyDecimal(totals.actual as unknown as { toString(): string })} accent={overBudget ? "text-danger" : "text-ink-primary"} />
        <Tile label="Paid" value={formatMoneyDecimal(totals.paid as unknown as { toString(): string })} accent="text-moss-700" />
        <OutstandingTile />
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
  isFirst = false,
  isLast = false,
  onMove,
  fundFilter,
  fundLabels,
}: {
  category: Category;
  suppliers: Supplier[];
  buildCardByLineId?: Record<string, BuildCardLink>;
  headcounts: HeadcountMap;
  // v1.85.0: reorder + rename. Parent owns the ordering so the action
  // call stays a single round-trip.
  isFirst?: boolean;
  isLast?: boolean;
  onMove?: (direction: "up" | "down") => void;
  // v1.86.0: fund filter threaded from BudgetClient so subtotals +
  // chip rendering on each line / component honour the filter.
  fundFilter: BudgetFundFilter;
  fundLabels: FundLabels;
}) {
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  // v1.85.0: rename mode. Click the title (or the pencil) to swap the
  // header text for an inline <input>; Enter saves, Esc cancels.
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(category.name);

  async function onSaveRename() {
    const next = draftName.trim();
    if (!next) {
      notify("error", "Name can't be empty");
      return;
    }
    if (next === category.name) {
      setRenaming(false);
      return;
    }
    startTransition(async () => {
      const res = await renameCategory(category.id, next);
      if (res.ok) {
        notify("success", "Renamed");
        setRenaming(false);
      } else {
        notify("error", res.error);
      }
    });
  }

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
  // v1.86.0: + fund filter (subtotals scope to filtered fund).
  const subtotals = category.lines.reduce(
    (acc, l) => ({
      estimated: acc.estimated + effectiveEstimated(l, headcounts, fundFilter),
      actual: acc.actual + lineActual(l, fundFilter),
      paid: acc.paid + linePaid(l, fundFilter),
    }),
    { estimated: 0, actual: 0, paid: 0 },
  );
  // v1.77.0: any line over its effective estimated triggers a small
  // warning chip on the category header so the user can spot
  // problem categories at a glance. (Always uses ALL-funds totals so
  // the warning isn't hidden by a fund filter.)
  const overBudgetLineCount = category.lines.filter((l) => {
    const est = effectiveEstimated(l, headcounts);
    return est > 0 && lineActual(l) > est;
  }).length;

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-soft gap-2">
        {renaming ? (
          // v1.85.0: inline-rename mode. Stay laid out roughly like the
          // collapsed-toggle so the header doesn't jump.
          <div className="flex items-center gap-2 flex-1">
            <span className="text-ink-tertiary text-xs">{collapsed ? "▸" : "▾"}</span>
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onSaveRename();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setDraftName(category.name);
                  setRenaming(false);
                }
              }}
              className="text-sm font-semibold max-w-xs"
              aria-label="Category name"
              disabled={pending}
            />
            <Button variant="ghost" size="sm" onClick={() => void onSaveRename()} disabled={pending}>Save</Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraftName(category.name);
                setRenaming(false);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        ) : (
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
        )}
        {!renaming && (
          <div className="flex gap-1 flex-shrink-0 items-center">
            {/* v1.85.0: reorder buttons. Disabled at the ends of the list. */}
            <button
              type="button"
              onClick={() => onMove?.("up")}
              disabled={isFirst || pending || !onMove}
              className="text-ink-tertiary hover:text-ink-primary disabled:opacity-30 disabled:cursor-not-allowed text-xs px-1 py-0.5"
              title="Move category up"
              aria-label={`Move ${category.name} up`}
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => onMove?.("down")}
              disabled={isLast || pending || !onMove}
              className="text-ink-tertiary hover:text-ink-primary disabled:opacity-30 disabled:cursor-not-allowed text-xs px-1 py-0.5"
              title="Move category down"
              aria-label={`Move ${category.name} down`}
            >
              ▼
            </button>
            {/* v1.85.0: rename pencil. Quietly themed so the row stays clean. */}
            <button
              type="button"
              onClick={() => {
                setDraftName(category.name);
                setRenaming(true);
              }}
              disabled={pending}
              className="text-ink-tertiary hover:text-ink-primary text-xs px-1 py-0.5"
              title="Rename category"
              aria-label={`Rename ${category.name}`}
            >
              ✎
            </button>
            <a
              href={`/payments?category=${category.id}`}
              className="text-[11px] text-info hover:underline self-center mr-1 ml-1"
              title={`Show all payments in ${category.name}`}
            >
              ↗ Payments
            </a>
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)} disabled={pending}>+ Line</Button>
            <Button variant="ghost" size="sm" onClick={onDeleteCat} disabled={pending}>Delete</Button>
          </div>
        )}
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
              <LineRow key={l.id} line={l} categoryId={category.id} suppliers={suppliers} buildCard={buildCardByLineId[l.id]} headcounts={headcounts} fundFilter={fundFilter} fundLabels={fundLabels} />
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
  fundFilter,
  fundLabels,
}: {
  line: Line;
  categoryId: string;
  suppliers: Supplier[];
  buildCard?: BuildCardLink;
  headcounts: HeadcountMap;
  // v1.86.0
  fundFilter: BudgetFundFilter;
  fundLabels: FundLabels;
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
  // v1.86.0: actual/paid/estimated use the active fund filter so the
  // row's visible numbers match the filtered SummaryBar totals.
  const actualResolved = lineActual(line, fundFilter);
  const isManual = isManualOverride(line);
  const paymentsSum = sumOfPayments(line);
  // v1.77.0: per-head breakdown chip + over-budget flag.
  // v1.81.0: + minimumHeadcount can floor the multiplier.
  const isPerHead = line.perHeadPence != null && line.headcountSource != null;
  const { resolved: rawCount, effective: effectiveCount } = resolveLineCount(line, headcounts);
  const minimumKickedIn = isPerHead && effectiveCount > rawCount;
  const estimatedResolved = effectiveEstimated(line, headcounts, fundFilter);
  const overBudget = estimatedResolved > 0 && actualResolved > estimatedResolved;
  // v1.86.0: line's own paid total (re-used in the Paid cell + Σ pill).
  const linePaidResolved = linePaid(line, fundFilter);

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
        {/* v1.83.0: composite lines surface the component-sum here.
            Σ pill marks it as a rollup (same convention as Actual). */}
        {line.components.length > 0 ? (
          <>
            £{estimatedResolved.toFixed(2)}
            <span className="ml-1 text-[9px] text-ink-tertiary font-bold">Σ</span>
          </>
        ) : isPerHead ? (
          `£${estimatedResolved.toFixed(2)}`
        ) : (
          formatMoneyDecimal(line.estimated)
        )}
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
        {formatMoneyDecimal(linePaidResolved as unknown as { toString(): string })}
        {/* v1.82.0: when paid is computed (not a manual override) AND
            any linked payments are PAID, show the Σ pill so the user
            knows it's a rollup. Mirrors the Actual column treatment. */}
        {line.paid == null && linePaidResolved > 0 && (
          <span className="ml-1 text-[9px] text-ink-tertiary font-bold">Σ</span>
        )}
      </td>
      <td className="px-4 py-2 text-xs text-ink-tertiary truncate">{supplierName ?? "—"}</td>
      <td className="px-4 py-2">
        <div className="flex gap-1 justify-end items-center">
          {/* v1.86.0: per-line fund chip. */}
          <FundChipPicker
            fundSource={line.fundSource}
            fundLabel={line.fundLabel}
            labels={fundLabels}
            inherited={false}
            disabled={pending}
            onSave={({ fundSource, fundLabel }) => {
              startTransition(async () => {
                const res = await setLineFund(line.id, { fundSource, fundLabel });
                if (!res.ok) notify("error", res.error);
              });
            }}
          />
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
          // v1.86.0: filter all per-component numbers by the active fund.
          const compEst = componentEffectiveEstimated(c, headcounts, fundFilter, line);
          const compActual = componentActual(c, line, fundFilter);
          const compPaid = componentPaid(c, line, fundFilter);
          const { resolved: rawC, effective: effC } = resolveComponentCount(c, headcounts);
          const minKick = c.perHeadPence != null && c.headcountSource != null && effC > rawC;
          // v1.86.0: resolve the component's effective fund chip via
          // inheritance.
          const compEffective = effectiveFundForComponent(c, line);
          return (
            <tr key={c.id} className="border-b border-border-soft/50 last:border-b-0 bg-canvas/40">
              <td className="px-4 py-1.5 pl-10">
                {/* v1.88.0: fund chip moved out of the label cell to
                    the action column (last cell) so the label has
                    room and the chip lines up with the parent line's
                    chip column. The breakdown chip (per-head £ × N)
                    now wraps under the label as a clean second line. */}
                <div className="text-[12px] text-ink-secondary flex items-baseline gap-1">
                  <span className="text-ink-tertiary">└ </span>
                  <span>{c.label}</span>
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
                {compActual > 0 ? (
                  <>
                    £{compActual.toFixed(2)}
                    <span className="ml-1 text-[9px] text-ink-tertiary font-bold">Σ</span>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-1.5 text-right text-[12px] text-moss-700 tabular-nums font-medium">
                {compPaid > 0 ? (
                  <>
                    £{compPaid.toFixed(2)}
                    <span className="ml-1 text-[9px] text-ink-tertiary font-bold">Σ</span>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-1.5"></td>
              <td className="px-4 py-1.5">
                {/* v1.88.0: component fund chip lives here, aligned
                    with the parent line's chip column. */}
                <div className="flex justify-end">
                  <FundChipPicker
                    fundSource={c.fundSource}
                    fundLabel={compEffective.label}
                    labels={fundLabels}
                    inherited={compEffective.inherited}
                    onSave={({ fundSource, fundLabel }) => {
                      void setComponentFund(c.id, { fundSource, fundLabel }).then(
                        (res) => {
                          if (!res.ok) notify("error", res.error);
                        },
                      );
                    }}
                  />
                </div>
              </td>
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
        <MentionableTextarea
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
      <MentionableTextarea name="notes" defaultValue={initial?.notes ?? ""} rows={2} placeholder="Notes (optional)"
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
