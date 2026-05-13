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

// v1.86.0: fund-filter shape. All compute helpers below accept an
// optional `{ fund }` param. When omitted (or set to "ALL") the
// helpers behave exactly as pre-v1.86. When set to one of the five
// FundKeys (JOINT / PERSONAL_BRIDE / PERSONAL_GROOM / OTHER /
// UNASSIGNED) the helpers drop rows/payments whose effective fund
// doesn't match.
//
// Importing FundKey here would create a cycle (funds.ts has no
// dependencies; budget.ts builds on it). So the type is duplicated
// as a string union locally. The values are kept in sync with
// funds.ts.
type LocalFundKey = "JOINT" | "PERSONAL_BRIDE" | "PERSONAL_GROOM" | "OTHER" | "UNASSIGNED";
export type BudgetFundFilter = { fund: LocalFundKey | "ALL" };

// Same shape as funds.ts FundCarrier (avoid cross-imports). Both
// fields are OPTIONAL so callers that don't track funds can pass
// any object — the filter helpers treat missing fields as null.
type FundFields = { fundSource?: string | null; fundLabel?: string | null };

// Returns the row's effective fund as a LocalFundKey. Mirrors
// funds.ts effectiveFundForX but without the label/inherited info
// (compute helpers only need the bucket).
function resolveOwnFund(carrier: FundFields): LocalFundKey {
  if (carrier.fundSource == null) return "UNASSIGNED";
  return carrier.fundSource as LocalFundKey;
}
function resolveComponentFund(component: FundFields, line: FundFields): LocalFundKey {
  if (component.fundSource != null) return component.fundSource as LocalFundKey;
  if (line.fundSource != null) return line.fundSource as LocalFundKey;
  return "UNASSIGNED";
}
function resolvePaymentFund(
  payment: FundFields,
  component: FundFields | null,
  line: FundFields | null,
): LocalFundKey {
  if (payment.fundSource != null) return payment.fundSource as LocalFundKey;
  if (component && component.fundSource != null) return component.fundSource as LocalFundKey;
  if (line && line.fundSource != null) return line.fundSource as LocalFundKey;
  return "UNASSIGNED";
}
// True when this row should contribute to the filtered totals.
function matchesFilter(rowFund: LocalFundKey, filter: BudgetFundFilter | undefined): boolean {
  if (!filter || filter.fund === "ALL") return true;
  return rowFund === filter.fund;
}

// v1.86.0: payment now carries optional fund fields so fund-aware
// callers can filter. `fundSource` is widened to `string | null` so
// budget.ts stays decoupled from the @prisma/client FundSource enum
// (the runtime values are the same — JOINT / PERSONAL_BRIDE / ...).
type PaymentForCompute = {
  amount: DecimalLike;
  status?: string;
  fundSource?: string | null;
  fundLabel?: string | null;
};
export type BudgetLineForCompute = {
  actual: DecimalLike;
  payments: PaymentForCompute[];
  // v1.86.0: optional — passing a line without these is fine, falls
  // through the same code paths as a non-fund-aware caller.
  fundSource?: string | null;
  fundLabel?: string | null;
};

// `computeActual` returns the resolved actual amount as a Number.
// Manual override wins; otherwise sum of payments.
//
// v1.86.0: optional fund filter. When set, the manual override only
// contributes when the line's own fund matches; otherwise payments
// are summed but only those whose effective fund matches.
export function computeActual(
  line: BudgetLineForCompute,
  filter?: BudgetFundFilter,
): number {
  const lineFund = resolveOwnFund(line);
  if (line.actual !== null && line.actual !== undefined) {
    return matchesFilter(lineFund, filter) ? toNumber(line.actual) : 0;
  }
  return line.payments.reduce((sum, p) => {
    const fund = resolvePaymentFund(p, null, line);
    if (!matchesFilter(fund, filter)) return sum;
    return sum + toNumber(p.amount);
  }, 0);
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
  payments: PaymentForCompute[];
  // v1.86.0: same optional fund fields as BudgetLineForCompute.
  fundSource?: string | null;
  fundLabel?: string | null;
};
export function computePaid(
  line: BudgetLineForPaid,
  filter?: BudgetFundFilter,
): number {
  const lineFund = resolveOwnFund(line);
  if (line.paid !== null && line.paid !== undefined) {
    return matchesFilter(lineFund, filter) ? toNumber(line.paid) : 0;
  }
  return line.payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => {
      const fund = resolvePaymentFund(p, null, line);
      if (!matchesFilter(fund, filter)) return sum;
      return sum + toNumber(p.amount);
    }, 0);
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
  // v1.86.0: optional fund fields. Filter returns 0 when the line's
  // own fund doesn't match (estimates have no payment-level fund to
  // fall through to).
  fundSource?: string | null;
  fundLabel?: string | null;
};
export function computeEstimated(
  line: BudgetLineForEstimate,
  headcount: number | null,
  filter?: BudgetFundFilter,
): number {
  if (!matchesFilter(resolveOwnFund(line), filter)) return 0;
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
  // v1.86.0: optional fund fields. Filter applies the component-vs-
  // line inheritance rule (component own > line) when `parentLine`
  // is passed; otherwise defaults to the component's own fund.
  fundSource?: string | null;
  fundLabel?: string | null;
};
export function computeComponentEstimated(
  component: ComponentForEstimate,
  headcount: number | null,
  filter?: BudgetFundFilter,
  parentLine?: FundFields,
): number {
  const fund = parentLine
    ? resolveComponentFund(component, parentLine)
    : resolveOwnFund(component);
  if (!matchesFilter(fund, filter)) return 0;
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
// v1.86.0: component shape gains optional fund fields so composite
// rollups can honour per-component overrides.
type ComponentForComposite = {
  payments: PaymentForCompute[];
  fundSource?: string | null;
  fundLabel?: string | null;
};
export type LineForCompositeActual = BudgetLineForCompute & {
  components: ComponentForComposite[];
};
export function computeCompositeActual(
  line: LineForCompositeActual,
  filter?: BudgetFundFilter,
): number {
  const lineFund = resolveOwnFund(line);
  if (line.actual !== null && line.actual !== undefined) {
    return matchesFilter(lineFund, filter) ? toNumber(line.actual) : 0;
  }
  const lineLevel = line.payments.reduce((sum, p) => {
    const fund = resolvePaymentFund(p, null, line);
    if (!matchesFilter(fund, filter)) return sum;
    return sum + toNumber(p.amount);
  }, 0);
  const componentLevel = line.components.reduce(
    (sum, c) =>
      sum +
      c.payments.reduce((cs, p) => {
        const fund = resolvePaymentFund(p, c, line);
        if (!matchesFilter(fund, filter)) return cs;
        return cs + toNumber(p.amount);
      }, 0),
    0,
  );
  return lineLevel + componentLevel;
}

// v1.82.0: composite-line paid. Same shape as computeCompositeActual
// but filters payments to PAID status. Manual `paid` override on the
// line still wins. Used by /budget so the Paid column reflects all
// money-settled payments across line + components.
export type LineForCompositePaid = BudgetLineForPaid & {
  components: ComponentForComposite[];
};
export function computeCompositePaid(
  line: LineForCompositePaid,
  filter?: BudgetFundFilter,
): number {
  const lineFund = resolveOwnFund(line);
  if (line.paid !== null && line.paid !== undefined) {
    return matchesFilter(lineFund, filter) ? toNumber(line.paid) : 0;
  }
  const lineLevel = line.payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => {
      const fund = resolvePaymentFund(p, null, line);
      if (!matchesFilter(fund, filter)) return sum;
      return sum + toNumber(p.amount);
    }, 0);
  const componentLevel = line.components.reduce(
    (sum, c) =>
      sum +
      c.payments
        .filter((p) => p.status === "PAID")
        .reduce((cs, p) => {
          const fund = resolvePaymentFund(p, c, line);
          if (!matchesFilter(fund, filter)) return cs;
          return cs + toNumber(p.amount);
        }, 0),
    0,
  );
  return lineLevel + componentLevel;
}

