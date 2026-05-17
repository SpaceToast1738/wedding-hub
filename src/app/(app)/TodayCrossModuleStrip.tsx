// v1.37.5 (P7b/C): Today-page strip showing cross-module widgets.
// v1.93.0: dropped the OUTFIT "Fittings & pickups" widget. Two
// widgets remain (legal deadlines, open decisions). Server component
// — pure presentational; the page does the DB fetch + helper call.
// Empty widgets are auto-hidden so the strip collapses on a quiet day.

import Link from "next/link";
import type { LegalDeadlineHit, DecisionTask } from "@/lib/today-widgets";

type Props = {
  legalHits: LegalDeadlineHit[];
  decisions: DecisionTask[];
};

export function TodayCrossModuleStrip({ legalHits, decisions }: Props) {
  // v1.90.0: build the widget list dynamically + use auto-fit so empty
  // widgets don't leave blank grid cells.
  const widgets: React.ReactNode[] = [];
  if (legalHits.length > 0) widgets.push(<LegalWidget key="legal" hits={legalHits} />);
  if (decisions.length > 0) widgets.push(<DecisionsWidget key="decisions" decisions={decisions} />);
  if (widgets.length === 0) return null;
  return (
    <div
      className="grid gap-4 mb-4 items-stretch"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
    >
      {widgets}
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

// v1.93.0: OutfitWidget retired — fitting / alterations / pickup
// dates no longer live on the OUTFIT card.

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
