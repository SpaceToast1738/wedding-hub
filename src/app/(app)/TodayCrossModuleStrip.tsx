// v1.37.5 (P7b/C): Today-page strip showing the three new
// cross-module widgets (legal deadlines, outfit milestones, open
// decisions). Server component — pure presentational. The page
// component does the DB fetch + helper call and passes the
// already-shaped data here. Empty widgets are auto-hidden so the
// strip collapses on a quiet day.

import Link from "next/link";
import type { LegalDeadlineHit, OutfitMilestoneHit, DecisionTask } from "@/lib/today-widgets";

type Props = {
  legalHits: LegalDeadlineHit[];
  outfitHits: OutfitMilestoneHit[];
  decisions: DecisionTask[];
};

export function TodayCrossModuleStrip({ legalHits, outfitHits, decisions }: Props) {
  if (legalHits.length === 0 && outfitHits.length === 0 && decisions.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-3 mb-4 items-stretch">
      <LegalWidget hits={legalHits} />
      <OutfitWidget hits={outfitHits} />
      <DecisionsWidget decisions={decisions} />
    </div>
  );
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function dayPill(days: number): { label: string; tone: "moss" | "marigold" | "danger" | "muted" } {
  if (days < 0) return { label: `${-days}d ago`, tone: "danger" };
  if (days === 0) return { label: "today", tone: "marigold" };
  if (days <= 7) return { label: `${days}d`, tone: "marigold" };
  return { label: `${days}d`, tone: "muted" };
}

function Pill({ tone, children }: { tone: "moss" | "marigold" | "danger" | "muted"; children: React.ReactNode }) {
  const cls =
    tone === "moss"
      ? "bg-moss-50 border-moss-300 text-moss-700"
      : tone === "marigold"
        ? "bg-marigold-100 border-marigold-700/30 text-marigold-700"
        : tone === "danger"
          ? "bg-danger/10 border-danger/30 text-danger"
          : "bg-canvas border-border-soft text-ink-tertiary";
  return (
    <span className={`text-[10px] uppercase tracking-wider rounded-full px-1.5 py-0.5 border ${cls} flex-shrink-0`}>
      {children}
    </span>
  );
}

function LegalWidget({ hits }: { hits: LegalDeadlineHit[] }) {
  if (hits.length === 0) return null;
  const cap = 5;
  return (
    <section className="bg-surface border border-border-soft rounded-lg p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-primary">Legal deadlines</h2>
        <span className="text-xs text-ink-tertiary">next 30 days</span>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm">
        {hits.slice(0, cap).map((h, i) => {
          const pill = dayPill(h.daysToDue);
          return (
            <li key={i} className="flex items-baseline gap-2">
              <Link
                href={`/book/${h.sectionSlug}#${h.subsectionSlug}`}
                className="text-ink-secondary hover:text-moss-700 hover:underline truncate flex-1"
                title={h.kind === "item" ? `${h.cardTitle} → ${h.itemLabel}` : h.cardTitle}
              >
                {h.kind === "card" ? h.cardTitle : `${h.cardTitle} · ${h.itemLabel}`}
              </Link>
              <span className="text-[11px] text-ink-tertiary tabular-nums flex-shrink-0">
                {shortDate(h.date)}
              </span>
              <Pill tone={pill.tone}>{pill.label}</Pill>
            </li>
          );
        })}
      </ul>
      {hits.length > cap && (
        <div className="mt-3 pt-3 border-t border-border-soft text-xs text-ink-tertiary">
          + {hits.length - cap} more
        </div>
      )}
    </section>
  );
}

function OutfitWidget({ hits }: { hits: OutfitMilestoneHit[] }) {
  if (hits.length === 0) return null;
  const cap = 5;
  return (
    <section className="bg-surface border border-border-soft rounded-lg p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-primary">Fittings & pickups</h2>
        <span className="text-xs text-ink-tertiary">next 30 days</span>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm">
        {hits.slice(0, cap).map((h, i) => {
          const pill = dayPill(h.daysToDate);
          return (
            <li key={i} className="flex items-baseline gap-2">
              <Link
                href={`/book/${h.sectionSlug}#${h.subsectionSlug}`}
                className="text-ink-secondary hover:text-moss-700 hover:underline truncate flex-1"
                title={`${h.personName} — ${h.milestone}`}
              >
                {h.personName}{" "}
                <span className="text-[11px] text-ink-tertiary">· {h.milestone}</span>
              </Link>
              <span className="text-[11px] text-ink-tertiary tabular-nums flex-shrink-0">
                {shortDate(h.date)}
              </span>
              <Pill tone={pill.tone}>{pill.label}</Pill>
            </li>
          );
        })}
      </ul>
      {hits.length > cap && (
        <div className="mt-3 pt-3 border-t border-border-soft text-xs text-ink-tertiary">
          + {hits.length - cap} more
        </div>
      )}
    </section>
  );
}

function DecisionsWidget({ decisions }: { decisions: DecisionTask[] }) {
  if (decisions.length === 0) return null;
  return (
    <section className="bg-surface border border-border-soft rounded-lg p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-primary">Open decisions</h2>
        <span className="text-xs text-ink-tertiary">{decisions.length} oldest</span>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm">
        {decisions.map((t) => (
          <li key={t.id} className="flex items-baseline gap-2">
            <Link
              href={`/tasks?id=${t.id}`}
              className="text-ink-secondary hover:text-moss-700 hover:underline truncate flex-1"
              title={t.title}
            >
              {t.title}
            </Link>
            {t.dueDate ? (
              <span className="text-[11px] text-ink-tertiary tabular-nums flex-shrink-0">
                {shortDate(t.dueDate)}
              </span>
            ) : (
              <span className="text-[11px] text-ink-tertiary italic flex-shrink-0">no date</span>
            )}
          </li>
        ))}
      </ul>
      <Link
        href="/tasks?type=DECISION"
        className="block mt-3 pt-3 border-t border-border-soft text-xs text-moss-500 hover:text-moss-700 hover:underline"
      >
        See all decisions →
      </Link>
    </section>
  );
}
