// v1.86.0: funding-source resolver + inheritance helpers. Pure
// module — no DB calls — so it can be reused from server pages,
// /budget client, /payments client, /glance, and unit tests.
//
// Inheritance: payment > component > line. Each level's fund can
// be NULL (explicit "inherit"); if everything up the chain is NULL
// the row is `UNASSIGNED` — a fifth bucket the UI surfaces alongside
// the four explicit enum values so the user can spot rows that
// haven't been categorised yet.
//
// The fund labels (especially bride / groom) are looked up from
// `WeddingSettings.brideFirst` / `.groomFirst` at render time. The
// rest of the app already uses these fields for couple naming, so
// renaming the couple in Settings cascades to every fund chip.

import type { FundSource } from "@prisma/client";

// Includes "UNASSIGNED" — a synthetic key for rows whose effective
// fund is null. Not a DB enum value; only used in the resolver +
// UI layer.
export type FundKey = FundSource | "UNASSIGNED";

// All five fund keys, in the canonical UI order (matches the chip
// row on /budget). UNASSIGNED is last so the eye lands on the four
// explicit buckets first.
export const FUND_KEYS: readonly FundKey[] = [
  "JOINT",
  "PERSONAL_BRIDE",
  "PERSONAL_GROOM",
  "OTHER",
  "UNASSIGNED",
] as const;

export type FundLabels = Record<FundKey, string>;

// `WeddingSettings`-ish input — only the two fields we care about
// here. Keeping the shape minimal lets tests + render paths pass
// either the full settings row or a mock.
export type FundLabelSource = {
  brideFirst: string | null;
  groomFirst: string | null;
};

// Returns display labels for all five fund keys. PERSONAL_BRIDE /
// PERSONAL_GROOM resolve to the couple's first names; fall back to
// "Bride" / "Groom" when WeddingSettings haven't been populated yet.
export function resolveFundLabels(settings: FundLabelSource): FundLabels {
  const bride = (settings.brideFirst ?? "").trim() || "Bride";
  const groom = (settings.groomFirst ?? "").trim() || "Groom";
  return {
    JOINT: "Joint",
    PERSONAL_BRIDE: bride,
    PERSONAL_GROOM: groom,
    OTHER: "Other",
    UNASSIGNED: "Unassigned",
  };
}

// Pretty-print a row's fund. Returns just the bucket name when there's
// no fundLabel; appends ": <label>" when the label is set. Used by the
// chip renderers on /budget + /payments.
//
// Example outputs:
//   JOINT + null         → "Joint"
//   JOINT + "Monzo pot"  → "Joint: Monzo pot"
//   OTHER + "parents"    → "Other: parents"
//   null (unassigned)    → "Unassigned"
export function formatFundChip(
  fund: FundKey,
  fundLabel: string | null | undefined,
  labels: FundLabels,
): string {
  const base = labels[fund];
  const trimmed = (fundLabel ?? "").trim();
  if (!trimmed) return base;
  return `${base}: ${trimmed}`;
}

// Carrier types — minimal interfaces so callers can pass any row
// shape that exposes the two columns. Keeps tests easy.
export type FundCarrier = {
  fundSource: FundSource | null;
  fundLabel: string | null;
};

// Component fund: own value wins; else inherit from parent line.
// Returns { fund, label } so the caller can render a "Joint: parents"
// chip (label) AND apply a filter (fund) in one step. `fund` is
// "UNASSIGNED" when everything up the chain is null.
export function effectiveFundForComponent(
  component: FundCarrier,
  line: FundCarrier,
): { fund: FundKey; label: string | null; inherited: boolean } {
  if (component.fundSource != null) {
    return { fund: component.fundSource, label: component.fundLabel, inherited: false };
  }
  if (line.fundSource != null) {
    return { fund: line.fundSource, label: line.fundLabel, inherited: true };
  }
  return { fund: "UNASSIGNED", label: null, inherited: false };
}

// Payment fund: own value wins; else component (if linked) wins;
// else line (if linked). Returns the same triple as
// effectiveFundForComponent. `component` / `line` are optional —
// pass null when the payment isn't linked at that level.
export function effectiveFundForPayment(
  payment: FundCarrier,
  component: FundCarrier | null,
  line: FundCarrier | null,
): { fund: FundKey; label: string | null; inherited: boolean } {
  if (payment.fundSource != null) {
    return { fund: payment.fundSource, label: payment.fundLabel, inherited: false };
  }
  if (component && component.fundSource != null) {
    return { fund: component.fundSource, label: component.fundLabel, inherited: true };
  }
  if (line && line.fundSource != null) {
    return { fund: line.fundSource, label: line.fundLabel, inherited: true };
  }
  return { fund: "UNASSIGNED", label: null, inherited: false };
}

// Small reducer for /glance + the /budget "By fund" strip. Iterates
// `rows`, computes each row's fund via `getFund`, and adds
// `getAmount(row)` into the bucket. Returns the full {JOINT, ...,
// UNASSIGNED} record so callers can render even-zero buckets when
// they want to.
export function groupTotalsByFund<T>(
  rows: readonly T[],
  getFund: (row: T) => FundKey,
  getAmount: (row: T) => number,
): Record<FundKey, number> {
  const totals: Record<FundKey, number> = {
    JOINT: 0,
    PERSONAL_BRIDE: 0,
    PERSONAL_GROOM: 0,
    OTHER: 0,
    UNASSIGNED: 0,
  };
  for (const row of rows) {
    totals[getFund(row)] += getAmount(row);
  }
  return totals;
}

// Helper used by /budget + /payments filters. The filter has a tri-
// state: "ALL" (show everything), one of the five fund keys (show
// only matching rows). Returns true when the row should be visible.
export function rowMatchesFundFilter(
  rowFund: FundKey,
  filter: FundKey | "ALL",
): boolean {
  if (filter === "ALL") return true;
  return rowFund === filter;
}
