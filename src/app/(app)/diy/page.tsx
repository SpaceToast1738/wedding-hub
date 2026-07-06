import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Illustrations";
import { requireUser } from "@/lib/actions";
import { buildRollups } from "@/lib/book-cards";
import { canViewMoney } from "@/lib/permissions";

// v1.31.1: DIY overview page. Lists every BUILD card across the
// Wedding Book in one place — useful when the couple wants to see
// all their DIY projects' state at a glance without paging through
// each Book section. Read-mostly: each row deep-links into the
// matching section/card for editing.
//
// Sort: in-progress (status NOT "Done") first, ordered by target
// date (sooner first; null targets last); Done at the bottom by
// completion proxy (latest session date). Because dates sort
// ascending, an overdue target (in the past) is numerically smaller
// than a future one, so overdue projects already land at the very
// top of the in-progress group for free — no separate overdue-first
// pass needed (finding #8).

const STATUS_TONE: Record<string, string> = {
  Designing: "bg-canvas border-border-soft text-ink-secondary",
  Prototyping: "bg-info/10 border-info/30 text-info",
  Producing: "bg-marigold-100 border-marigold-700/30 text-marigold-700",
  Done: "bg-moss-50 border-moss-300 text-moss-700",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatGBP(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

// Button.tsx doesn't support rendering as an anchor, so this header
// action hand-rolls the equivalent of Button's secondary/md look for a
// real <Link> — same visual weight, but it needs to navigate rather
// than fire a click handler.
const BOOK_LINK_CLASSES =
  "inline-flex items-center gap-1.5 text-sm font-medium rounded-sm whitespace-nowrap transition-colors bg-muted text-ink-primary border border-border-soft hover:bg-canvas px-3.5 py-1.5 min-h-[40px] sm:min-h-0";

// v2.6.0 (finding #10): DIY-themed empty-state illustration, in the
// same 120×100 / CSS-variable-themed style as Illustrations.tsx's
// other empty states. Kept local rather than added to that shared
// file since it's outside this pass's file ownership.
function IllusDiyBuild() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="18" y="62" width="84" height="9" rx="2" fill="var(--color-moss-100)" stroke="var(--color-moss-500)" strokeWidth="1.2" />
      <rect x="54" y="18" width="11" height="46" rx="3" fill="var(--color-surface)" stroke="var(--color-moss-500)" strokeWidth="1.2" transform="rotate(-20 59.5 41)" />
      <rect x="45" y="10" width="27" height="14" rx="3" fill="var(--color-moss-300)" stroke="var(--color-moss-700)" strokeWidth="1.2" transform="rotate(-20 58.5 17)" />
      <circle cx="32" cy="70" r="3" fill="var(--color-marigold-500)" stroke="var(--color-marigold-700)" strokeWidth="0.8" />
      <circle cx="88" cy="70" r="3" fill="var(--color-marigold-500)" stroke="var(--color-marigold-700)" strokeWidth="0.8" />
      <path d="M28 80 L92 80" stroke="var(--color-moss-300)" strokeWidth="1" strokeDasharray="4 3" />
      <path d="M40 50 L48 58" stroke="var(--color-moss-500)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default async function DiyOverviewPage() {
  const user = await requireUser();
  // v1.76.0: gate the materials-spend totals + per-card £ chip.
  // Non-money users still see project state (units / hours / status)
  // — just not the money values.
  const showMoney = await canViewMoney(user);

  const cards = await db.bookBuildCard.findMany({
    include: {
      subsection: {
        include: { section: true },
      },
      materials: {
        select: { ordered: true, arrived: true, costPence: true, quantity: true },
      },
      sessions: {
        select: { minutes: true, unitsCompleted: true },
      },
      budgetLine: {
        select: { id: true, description: true, estimated: true },
      },
    },
  });

  // Filter visibility: non-couple users don't see COUPLE_ONLY cards.
  const visible = cards.filter((c) => {
    if (user.isCouple) return true;
    return (
      c.subsection.visibility === "EVERYONE" &&
      c.subsection.section.visibility === "EVERYONE"
    );
  });

  // Pre-compute rollups + status priority once per card so the sort is cheap.
  const enriched = visible.map((c) => {
    const r = buildRollups({
      quantityNeeded: c.quantityNeeded,
      estimatedMinutesPerUnit: c.estimatedMinutesPerUnit,
      prototypeDone: c.prototypeDone,
      targetDate: c.targetDate,
      materials: c.materials,
      sessions: c.sessions,
    });
    const isDone = c.status === "Done";
    return { card: c, rollups: r, isDone };
  });

  // Done last; otherwise sooner target first; null targets after dated.
  enriched.sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    const aT = a.card.targetDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bT = b.card.targetDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aT !== bT) return aT - bT;
    return a.card.subsection.title.localeCompare(b.card.subsection.title);
  });

  const totalSpend = enriched.reduce((sum, e) => sum + e.rollups.materialsTotalPence, 0);
  const totalUnitsDone = enriched.reduce((sum, e) => sum + e.rollups.unitsDone, 0);
  const totalUnitsNeeded = enriched.reduce(
    (sum, e) => sum + (e.card.quantityNeeded ?? 0),
    0,
  );
  const totalHours = enriched.reduce((sum, e) => sum + e.rollups.hoursLogged, 0);

  return (
    <>
      <PageHeader
        title="DIY"
        subtitle={`${enriched.length} project${enriched.length === 1 ? "" : "s"} across the Wedding Book`}
        actions={
          // v2.6.0 (finding #10): DIY has no creation path of its own —
          // BUILD cards are added from a Wedding Book section — so this
          // is a lightweight nudge toward that flow rather than a form.
          // Shown regardless of whether the list is empty, since the
          // non-empty view previously had no header action at all.
          <Link href="/book" className={BOOK_LINK_CLASSES}>
            Wedding Book →
          </Link>
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
          {enriched.length === 0 ? (
            <EmptyState
              illustration={IllusDiyBuild}
              title="No DIY projects yet"
              action={
                <p className="text-xs text-ink-tertiary max-w-xs">
                  Add a BUILD card on any{" "}
                  <Link href="/book" className="text-info hover:underline">Wedding Book</Link>{" "}
                  section and it&apos;ll appear here.
                </p>
              }
            />
          ) : (
            <>
              {/* Top-line totals */}
              <section className={`grid grid-cols-2 ${showMoney ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-2`}>
                <Stat label="Projects" value={`${enriched.length}`} />
                <Stat
                  label="Units"
                  value={`${totalUnitsDone}${totalUnitsNeeded > 0 ? ` / ${totalUnitsNeeded}` : ""}`}
                />
                <Stat label="Hours logged" value={`${Math.round(totalHours * 10) / 10}`} />
                {showMoney && <Stat label="Materials spend" value={formatGBP(totalSpend)} />}
              </section>

              {/* Cards list */}
              <section className="bg-surface border border-border-soft rounded-md shadow-sm overflow-hidden">
                <ul className="divide-y divide-border-soft">
                  {enriched.map(({ card, rollups, isDone }) => (
                    <li key={card.id}>
                      <Link
                        href={`/book/${card.subsection.section.slug}#${card.subsection.slug}`}
                        className="block px-4 py-3 hover:bg-canvas/40 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong
                                className={`text-sm font-semibold truncate ${isDone ? "text-ink-tertiary line-through" : "text-ink-primary"}`}
                              >
                                {card.subsection.title}
                              </strong>
                              {card.status && (
                                <span
                                  className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 border ${STATUS_TONE[card.status] ?? STATUS_TONE.Designing}`}
                                >
                                  {card.status}
                                </span>
                              )}
                              {rollups.prototypeBlocker && (
                                <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-marigold-100 border border-marigold-700/30 text-marigold-700 inline-flex items-center gap-1">
                                  <AlertTriangle aria-hidden className="w-3 h-3" />
                                  Prototype
                                </span>
                              )}
                              {card.budgetLine && (
                                <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-moss-50 border border-moss-300 text-moss-700">
                                  Budget linked
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-ink-tertiary mt-0.5">
                              in <span className="text-ink-secondary">{card.subsection.section.title}</span>
                              {card.targetDate && (() => {
                                const days = Math.round(
                                  (card.targetDate.getTime() - Date.now()) / MS_PER_DAY,
                                );
                                // v2.6.0 (finding #8): an overdue target used
                                // to render with identical muted styling to a
                                // comfortably-future one — no escalation at
                                // all on a deadline-driven overview page.
                                // "Done" projects don't count as overdue even
                                // if the target slipped before completion.
                                const overdue = !isDone && days < 0;
                                const dateLabel = card.targetDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                                return (
                                  <>
                                    {" · "}
                                    <span className={overdue ? "text-danger font-semibold" : undefined}>
                                      {overdue
                                        ? `overdue by ${-days}d (target was ${dateLabel})`
                                        : `target ${dateLabel} (${days}d)`}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            <div className="text-xs text-ink-secondary tabular-nums">
                              {rollups.unitsDone}
                              {card.quantityNeeded ? ` / ${card.quantityNeeded}` : ""} units
                            </div>
                            <div className="text-[11px] text-ink-tertiary tabular-nums">
                              {Math.round(rollups.hoursLogged * 10) / 10}h
                              {showMoney && (
                                <> · {formatGBP(rollups.materialsTotalPence)}</>
                              )}
                            </div>
                            {/* v2.6.0 (finding #9): was "Ord 40% · Arr 20%"
                                at 10px, meaning only explained by a hover
                                tooltip — unreachable on touch since the
                                whole row is a Link. Spelled out in full at
                                a slightly larger size so it's self-
                                explanatory without hovering anything. */}
                            <div className="text-[11px] text-ink-tertiary text-right tabular-nums max-w-[110px] sm:max-w-[220px]">
                              materials: {rollups.percentMaterialsOrdered}% ordered, {rollups.percentMaterialsArrived}% arrived
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border-soft rounded-md px-3 py-2 shadow-sm">
      <div className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
        {label}
      </div>
      <div className="text-base text-ink-primary tabular-nums font-semibold mt-0.5">
        {value || "—"}
      </div>
    </div>
  );
}
