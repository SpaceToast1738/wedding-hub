// Pure decision functions for budget reads. Extracted so both server-side
// pages (budget, glance) and unit tests can call them without spinning
// up a DB or React.
//
// **B2 contract:** `BudgetLine.actual` is treated as a manual override.
// When `actual !== null`, the stored value wins (someone deliberately
// pinned the figure — e.g. a one-off cash payment we don't have a
// `Payment` row for, or a contract value distinct from what's been
// invoiced). When `actual === null`, we recompute on read by summing
// the linked `Payment.amount` rows.
//
// All arithmetic happens in JS `Number` to match the existing
// `num()` helper in BudgetClient. Decimal precision is fine for
// wedding-scale (~£tens of thousands).

type DecimalLike = { toString(): string } | null | undefined;

function toNumber(d: DecimalLike): number {
  if (d === null || d === undefined) return 0;
  const n = Number(d.toString());
  return Number.isNaN(n) ? 0 : n;
}

export type BudgetLineForCompute = {
  actual: DecimalLike;
  payments: { amount: DecimalLike }[];
};

// `computeActual` returns the resolved actual amount as a Number.
// Manual override wins; otherwise sum of payments.
export function computeActual(line: BudgetLineForCompute): number {
  if (line.actual !== null && line.actual !== undefined) {
    return toNumber(line.actual);
  }
  return line.payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
}

// `isManualOverride` lets the UI label "Manual override — clear to
// recompute" when an explicit `actual` is set, vs. "Computed from
// £X of payments" when null.
export function isManualOverride(line: BudgetLineForCompute): boolean {
  return line.actual !== null && line.actual !== undefined;
}

// `sumOfPayments` is exposed separately so the edit form can show
// "Computed from £X of N payments" without needing to know the
// override-or-not state.
export function sumOfPayments(line: BudgetLineForCompute): number {
  return line.payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
}
