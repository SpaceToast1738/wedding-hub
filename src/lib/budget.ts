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
  payments: { amount: DecimalLike; status?: string }[];
};

// `computeActual` returns the resolved actual amount as a Number.
// Manual override wins; otherwise sum of payments.
export function computeActual(line: BudgetLineForCompute): number {
  if (line.actual !== null && line.actual !== undefined) {
    return toNumber(line.actual);
  }
  return line.payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
}

// v1.82.0: `computePaid` follows the same B2 contract pattern as
// computeActual — manual override on the line wins; otherwise it
// sums payments WHOSE STATUS IS "PAID". Pre-fix, the Paid column
// rendered the manual value verbatim and PAID-status payments only
// fed Actual (which couldn't distinguish committed from settled).
// Now Paid = "money that's already gone out the door" and Actual =
// "total committed including pending payments".
export type BudgetLineForPaid = {
  paid: DecimalLike;
  payments: { amount: DecimalLike; status?: string }[];
};
export function computePaid(line: BudgetLineForPaid): number {
  if (line.paid !== null && line.paid !== undefined) {
    return toNumber(line.paid);
  }
  return line.payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + toNumber(p.amount), 0);
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

// v1.77.0: effective estimated value. When the line has a per-head
// price + source set, we derive `perHeadPence × computed-count` and
// return that (in pounds). Otherwise the manual `estimated` column
// wins. Pure — caller passes in the resolved count so this stays
// off the DB.
// v1.81.0: + `minimumHeadcount` — when set, the multiplier becomes
// `max(resolvedCount, minimum)` so vendor minimum-cover clauses are
// honoured. Same rule for MANUAL source (a typed count is still
// floored by the vendor minimum).
export type BudgetLineForEstimate = {
  estimated: DecimalLike;
  perHeadPence: number | null;
  headcountSource: string | null;
  minimumHeadcount?: number | null;
};
export function computeEstimated(
  line: BudgetLineForEstimate,
  headcount: number | null,
): number {
  if (
    line.perHeadPence != null &&
    line.headcountSource != null &&
    headcount != null
  ) {
    const effective = applyMinimum(headcount, line.minimumHeadcount ?? null);
    // perHeadPence is integer pence; convert to pounds via /100.
    return (line.perHeadPence * effective) / 100;
  }
  return toNumber(line.estimated);
}

// v1.81.0: apply the vendor minimum to a resolved headcount.
// Returns `max(resolved, minimum)`; null minimum is a passthrough.
// Caller is responsible for substituting the manual count when the
// source is MANUAL — this helper doesn't care about source.
export function applyMinimum(
  resolved: number,
  minimum: number | null,
): number {
  if (minimum == null) return resolved;
  return Math.max(resolved, minimum);
}

// v1.77.0: is this line over budget? Used by the warning chips on
// /budget rows and category headers. Returns true when the actual
// amount strictly exceeds the effective estimated. A line with no
// estimated (estimated === 0 and not per-head) returns false even
// if there's spend — caller should check that case separately.
export function isOverBudget(
  line: BudgetLineForCompute & BudgetLineForEstimate,
  headcount: number | null,
): boolean {
  const estimated = computeEstimated(line, headcount);
  if (estimated <= 0) return false;
  return computeActual(line) > estimated;
}

// v1.80.0: per-component estimated. A component is either flat OR
// per-head — exclusive. Same shape as the line-level helper.
// v1.81.0: + minimumHeadcount support (same `applyMinimum` rule).
export type ComponentForEstimate = {
  flatPence: number | null;
  perHeadPence: number | null;
  headcountSource: string | null;
  minimumHeadcount?: number | null;
};
export function computeComponentEstimated(
  component: ComponentForEstimate,
  headcount: number | null,
): number {
  if (
    component.perHeadPence != null &&
    component.headcountSource != null &&
    headcount != null
  ) {
    const effective = applyMinimum(headcount, component.minimumHeadcount ?? null);
    return (component.perHeadPence * effective) / 100;
  }
  if (component.flatPence != null) {
    return component.flatPence / 100;
  }
  return 0;
}

// v1.80.0: per-component actual. Sums payments linked specifically
// to this component via Payment.budgetLineComponentId. No B2
// manual-override at the component level — that lives on the line.
export type ComponentForActual = {
  payments: { amount: DecimalLike }[];
};
export function computeComponentActual(component: ComponentForActual): number {
  return component.payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
}

// v1.80.0: composite-line actuals. Sum of payments linked directly
// to the line PLUS sum of payments linked to any of its components.
// Manual override on the line still wins (B2 contract preserved).
export type LineForCompositeActual = BudgetLineForCompute & {
  components: { payments: { amount: DecimalLike; status?: string }[] }[];
};
export function computeCompositeActual(line: LineForCompositeActual): number {
  if (line.actual !== null && line.actual !== undefined) {
    return toNumber(line.actual);
  }
  const lineLevel = line.payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
  const componentLevel = line.components.reduce(
    (sum, c) => sum + c.payments.reduce((cs, p) => cs + toNumber(p.amount), 0),
    0,
  );
  return lineLevel + componentLevel;
}

// v1.82.0: composite-line paid. Same shape as computeCompositeActual
// but filters payments to PAID status. Manual `paid` override on the
// line still wins. Used by /budget so the Paid column reflects all
// money-settled payments across line + components.
export type LineForCompositePaid = BudgetLineForPaid & {
  components: { payments: { amount: DecimalLike; status?: string }[] }[];
};
export function computeCompositePaid(line: LineForCompositePaid): number {
  if (line.paid !== null && line.paid !== undefined) {
    return toNumber(line.paid);
  }
  const lineLevel = line.payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + toNumber(p.amount), 0);
  const componentLevel = line.components.reduce(
    (sum, c) =>
      sum +
      c.payments
        .filter((p) => p.status === "PAID")
        .reduce((cs, p) => cs + toNumber(p.amount), 0),
    0,
  );
  return lineLevel + componentLevel;
}

