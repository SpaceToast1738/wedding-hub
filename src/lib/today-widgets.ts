// v1.37.5 (P7b/C): pure-decision helpers for the Today page widgets.
// Each function takes plain inputs (no DB, no React) so the unit
// tests lock the contract without setup. The page-level component
// fetches data, calls these, and renders the result.
//
// v1.93.0: dropped nextOutfitMilestones — OUTFIT cards no longer
// carry fitting / alterations / pickup dates. Those live as Tasks
// now (Topic-linked to the card via the existing v1.51.0 m2m).
//
// v2.0.0: dropped nextLegalDeadlines — LEGAL card kind retired
// (was UK-marriage-law-centric). Today widget previously surfaced
// LEGAL `dueByDate` / item `expiresAt` deadlines in the next N days.
//
// Remaining widget:
//   - oldestOpenDecisions — open Tasks of type=DECISION, oldest
//     first, capped to N.

// ─── Open decisions ────────────────────────────────────────────

export type DecisionTask = {
  id: string;
  title: string;
  type: string;
  status: string;
  /** Priority is an enum on the DB; we accept any tag here since the
   *  helper doesn't sort by it (only used downstream for display). */
  priority?: string | number | null;
  dueDate?: Date | null;
  createdAt: Date;
};

/**
 * Oldest-open decisions, capped at `limit`. Filter is conservative —
 * we accept only tasks of `type === "DECISION"` and `status` not in
 * the closed set. Sort: due date ascending (nulls last), then
 * createdAt ascending (oldest first).
 */
export function oldestOpenDecisions(tasks: DecisionTask[], limit: number): DecisionTask[] {
  const open = tasks.filter(
    (t) => t.type === "DECISION" && !["DONE", "ARCHIVED", "CANCELLED"].includes(t.status),
  );
  open.sort((a, b) => {
    const ad = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const bd = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return open.slice(0, limit);
}
