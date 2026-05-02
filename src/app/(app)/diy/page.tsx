import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/actions";
import { buildRollups } from "@/lib/book-cards";

// v1.31.1: DIY overview page. Lists every BUILD card across the
// Wedding Book in one place — useful when the couple wants to see
// all their DIY projects' state at a glance without paging through
// each Book section. Read-mostly: each row deep-links into the
// matching section/card for editing.
//
// Sort: in-progress (status NOT "Done") first, ordered by target
// date (sooner first; null targets last); Done at the bottom by
// completion proxy (latest session date).

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

export default async function DiyOverviewPage() {
  const user = await requireUser();

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
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
          {enriched.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              No DIY projects yet. Add a BUILD card on any Wedding Book section
              and it&apos;ll appear here.
            </p>
          ) : (
            <>
              {/* Top-line totals */}
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Projects" value={`${enriched.length}`} />
                <Stat
                  label="Units"
                  value={`${totalUnitsDone}${totalUnitsNeeded > 0 ? ` / ${totalUnitsNeeded}` : ""}`}
                />
                <Stat label="Hours logged" value={`${Math.round(totalHours * 10) / 10}`} />
                <Stat label="Materials spend" value={formatGBP(totalSpend)} />
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
                                <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-marigold-100 border border-marigold-700/30 text-marigold-700">
                                  ⚠ Prototype
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
                              {card.targetDate && (
                                <>
                                  {" · "}
                                  <span>
                                    target {card.targetDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                    {(() => {
                                      const days = Math.round(
                                        (card.targetDate.getTime() - Date.now()) / MS_PER_DAY,
                                      );
                                      return ` (${days >= 0 ? `${days}d` : `${-days}d ago`})`;
                                    })()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            <div className="text-xs text-ink-secondary tabular-nums">
                              {rollups.unitsDone}
                              {card.quantityNeeded ? ` / ${card.quantityNeeded}` : ""} units
                            </div>
                            <div className="text-[11px] text-ink-tertiary tabular-nums">
                              {Math.round(rollups.hoursLogged * 10) / 10}h ·{" "}
                              {formatGBP(rollups.materialsTotalPence)}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-ink-tertiary">
                              <span title={`${rollups.percentMaterialsOrdered}% of materials ordered`}>
                                Ord {rollups.percentMaterialsOrdered}%
                              </span>
                              <span>·</span>
                              <span title={`${rollups.percentMaterialsArrived}% of materials arrived`}>
                                Arr {rollups.percentMaterialsArrived}%
                              </span>
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
