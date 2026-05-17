// v1.37.5 (P7b/C): pure-decision helpers for the Today page widgets.
// Each function takes plain inputs (no DB, no React) so the unit
// tests lock the contract without setup. The page-level component
// fetches data, calls these, and renders the result.
//
// v1.93.0: dropped nextOutfitMilestones — OUTFIT cards no longer
// carry fitting / alterations / pickup dates. Those live as Tasks
// now (Topic-linked to the card via the existing v1.51.0 m2m).
//
// Two widgets:
//   1. nextLegalDeadlines — LEGAL cards with `dueByDate` or items
//      `expiresAt` falling within the next N days.
//   2. oldestOpenDecisions — open Tasks of type=DECISION, oldest
//      first, capped to N.

const MS_PER_DAY = 86_400_000;

// ─── 1. LEGAL deadlines ───────────────────────────────────────────

export type LegalDeadlineCard = {
  cardId: string;
  cardTitle: string;
  sectionSlug: string;
  subsectionSlug: string;
  dueByDate?: Date | null;
  items: Array<{
    id: string;
    label: string;
    obtained: boolean;
    expiresAt?: Date | null;
  }>;
};

export type LegalDeadlineHit =
  | {
      kind: "card";
      cardId: string;
      cardTitle: string;
      sectionSlug: string;
      subsectionSlug: string;
      date: Date;
      daysToDue: number;
      isOverdue: boolean;
    }
  | {
      kind: "item";
      cardId: string;
      cardTitle: string;
      sectionSlug: string;
      subsectionSlug: string;
      itemLabel: string;
      date: Date;
      daysToDue: number;
      isExpired: boolean;
    };

/**
 * Pick LEGAL deadlines coming up within `daysAhead`. Includes:
 *   - cards whose `dueByDate` is within the window AND not every item
 *     is `obtained` (skipped when fully complete).
 *   - items whose `expiresAt` is within the window.
 *
 * Past-but-still-actionable items (expired AND not obtained) are
 * always included so they don't fall off the radar; past completed
 * cards are excluded.
 *
 * Returns soonest-first, ties broken by cardTitle.
 */
export function nextLegalDeadlines(
  cards: LegalDeadlineCard[],
  now: Date,
  daysAhead: number,
): LegalDeadlineHit[] {
  const cutoff = now.getTime() + daysAhead * MS_PER_DAY;
  const hits: LegalDeadlineHit[] = [];

  for (const card of cards) {
    // Card-level due date.
    if (card.dueByDate) {
      const t = card.dueByDate.getTime();
      const allObtained = card.items.length > 0 && card.items.every((i) => i.obtained);
      if (t <= cutoff && !allObtained) {
        hits.push({
          kind: "card",
          cardId: card.cardId,
          cardTitle: card.cardTitle,
          sectionSlug: card.sectionSlug,
          subsectionSlug: card.subsectionSlug,
          date: card.dueByDate,
          daysToDue: Math.round((t - now.getTime()) / MS_PER_DAY),
          isOverdue: t < now.getTime(),
        });
      }
    }
    // Per-item expiry.
    for (const item of card.items) {
      if (!item.expiresAt) continue;
      const t = item.expiresAt.getTime();
      if (t <= cutoff) {
        hits.push({
          kind: "item",
          cardId: card.cardId,
          cardTitle: card.cardTitle,
          sectionSlug: card.sectionSlug,
          subsectionSlug: card.subsectionSlug,
          itemLabel: item.label,
          date: item.expiresAt,
          daysToDue: Math.round((t - now.getTime()) / MS_PER_DAY),
          isExpired: t < now.getTime(),
        });
      }
    }
  }
  hits.sort((a, b) => {
    const d = a.date.getTime() - b.date.getTime();
    if (d !== 0) return d;
    return a.cardTitle.localeCompare(b.cardTitle);
  });
  return hits;
}

// v1.93.0: nextOutfitMilestones + OutfitMilestoneHit + OutfitMilestoneCard
// removed. OUTFIT cards no longer carry fitting / alterations / pickup
// dates — couples track those as Tasks now.

// ─── 3. Open decisions ────────────────────────────────────────────

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
