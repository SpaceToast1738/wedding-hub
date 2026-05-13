import { db } from "@/lib/db";
import type { PerHeadSource } from "@prisma/client";

// v1.77.0: shared headcount resolver for variable-cost BudgetLines.
// Single source of truth — /budget calls this, and the (still-to-come
// in v1.78.0) per-head card kind will too. Pure async — querying
// the Guest table per source rather than caching to keep the count
// honest as RSVPs change.

/**
 * Human-readable label for a `PerHeadSource`. Used in the breakdown
 * chip on /budget rows ("£50 × 60 confirmed = £3,000") and the
 * source dropdown in edit mode.
 */
export function perHeadSourceLabel(source: PerHeadSource): string {
  switch (source) {
    case "ALL_INVITED":
      return "all invited";
    case "CONFIRMED_PLUS_PENDING":
      return "confirmed + pending";
    case "ALL_CONFIRMED":
      return "confirmed";
    case "ADULTS_CONFIRMED":
      return "adults confirmed";
    case "CHILDREN_CONFIRMED":
      return "children confirmed";
    // v1.82.0: age-split "+ pending" variants.
    case "ADULTS_PENDING_OR_CONFIRMED":
      return "adults confirmed + pending";
    case "CHILDREN_PENDING_OR_CONFIRMED":
      return "children confirmed + pending";
    case "MANUAL":
      return "manual";
  }
}

/**
 * Short pluralised noun for the count, e.g. "guests" / "adults" /
 * "children" / "people". Suffixed onto the count in the breakdown.
 */
export function perHeadSourceNoun(source: PerHeadSource, n: number): string {
  switch (source) {
    case "ADULTS_CONFIRMED":
    case "ADULTS_PENDING_OR_CONFIRMED":
      return n === 1 ? "adult" : "adults";
    case "CHILDREN_CONFIRMED":
    case "CHILDREN_PENDING_OR_CONFIRMED":
      return n === 1 ? "child" : "children";
    case "MANUAL":
      return n === 1 ? "person" : "people";
    default:
      return n === 1 ? "guest" : "guests";
  }
}

/**
 * Resolve a per-head source to a live integer count by querying the
 * Guest table. Manual mode reads `manualHeadcount` instead — null
 * manual count returns 0 (caller is expected to validate).
 *
 * `archived: false` is enforced everywhere — archived guests never
 * count regardless of source.
 */
export async function computeHeadcount(
  source: PerHeadSource,
  manualCount: number | null,
): Promise<number> {
  if (source === "MANUAL") {
    return Math.max(0, manualCount ?? 0);
  }
  const where = (() => {
    switch (source) {
      case "ALL_INVITED":
        return { archived: false };
      case "CONFIRMED_PLUS_PENDING":
        return {
          archived: false,
          OR: [{ rsvp: "ATTENDING" as const }, { rsvp: "PENDING" as const }],
        };
      case "ALL_CONFIRMED":
        return { archived: false, rsvp: "ATTENDING" as const };
      case "ADULTS_CONFIRMED":
        return { archived: false, rsvp: "ATTENDING" as const, isChild: false };
      case "CHILDREN_CONFIRMED":
        return { archived: false, rsvp: "ATTENDING" as const, isChild: true };
      // v1.82.0
      case "ADULTS_PENDING_OR_CONFIRMED":
        return {
          archived: false,
          isChild: false,
          OR: [{ rsvp: "ATTENDING" as const }, { rsvp: "PENDING" as const }],
        };
      case "CHILDREN_PENDING_OR_CONFIRMED":
        return {
          archived: false,
          isChild: true,
          OR: [{ rsvp: "ATTENDING" as const }, { rsvp: "PENDING" as const }],
        };
    }
  })();
  return db.guest.count({ where });
}

/**
 * Pre-fetch live counts for every PerHeadSource value in a single
 * batch — used by /budget's render so we don't fire one COUNT query
 * per per-head line. Returns a `Record<PerHeadSource, number>` keyed
 * by enum value (MANUAL is undefined here — manual lines resolve via
 * their own manualHeadcount).
 */
export async function fetchAllHeadcounts(): Promise<
  Record<Exclude<PerHeadSource, "MANUAL">, number>
> {
  const [
    allInvited,
    confirmedPlusPending,
    confirmed,
    adults,
    children,
    adultsPendingOrConfirmed,
    childrenPendingOrConfirmed,
  ] = await Promise.all([
    db.guest.count({ where: { archived: false } }),
    db.guest.count({
      where: { archived: false, OR: [{ rsvp: "ATTENDING" }, { rsvp: "PENDING" }] },
    }),
    db.guest.count({ where: { archived: false, rsvp: "ATTENDING" } }),
    db.guest.count({ where: { archived: false, rsvp: "ATTENDING", isChild: false } }),
    db.guest.count({ where: { archived: false, rsvp: "ATTENDING", isChild: true } }),
    db.guest.count({
      where: {
        archived: false,
        isChild: false,
        OR: [{ rsvp: "ATTENDING" }, { rsvp: "PENDING" }],
      },
    }),
    db.guest.count({
      where: {
        archived: false,
        isChild: true,
        OR: [{ rsvp: "ATTENDING" }, { rsvp: "PENDING" }],
      },
    }),
  ]);
  return {
    ALL_INVITED: allInvited,
    CONFIRMED_PLUS_PENDING: confirmedPlusPending,
    ALL_CONFIRMED: confirmed,
    ADULTS_CONFIRMED: adults,
    CHILDREN_CONFIRMED: children,
    ADULTS_PENDING_OR_CONFIRMED: adultsPendingOrConfirmed,
    CHILDREN_PENDING_OR_CONFIRMED: childrenPendingOrConfirmed,
  };
}

/**
 * Resolve a BudgetLine's per-head config to its computed estimated
 * total, in pounds (Decimal-friendly via Number return — the BudgetLine
 * estimated column is Decimal but the consumer only needs to display).
 * Returns null if the line isn't per-head.
 *
 * Pre-fetched counts are passed in so a /budget page render with N
 * per-head lines fires the count queries once, not N times.
 */
export function effectiveEstimatedFromPerHead(
  line: {
    perHeadPence: number | null;
    headcountSource: PerHeadSource | null;
    manualHeadcount: number | null;
  },
  counts: Record<Exclude<PerHeadSource, "MANUAL">, number>,
): { totalPence: number; count: number } | null {
  if (line.perHeadPence == null || line.headcountSource == null) return null;
  const count =
    line.headcountSource === "MANUAL"
      ? Math.max(0, line.manualHeadcount ?? 0)
      : counts[line.headcountSource];
  return { totalPence: line.perHeadPence * count, count };
}
