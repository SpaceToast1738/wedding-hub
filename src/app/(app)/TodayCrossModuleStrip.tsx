// v1.37.5 (P7b/C): Today-page strip showing cross-module widgets.
// v1.93.0: dropped the OUTFIT "Fittings & pickups" widget.
// v2.0.0: dropped the LEGAL deadlines widget (LEGAL kind retired).
// One widget remains (open decisions). Server component — pure
// presentational; the page does the DB fetch + helper call.
// Auto-hidden when the decisions list is empty.

import Link from "next/link";
import type { DecisionTask } from "@/lib/today-widgets";

type Props = {
  decisions: DecisionTask[];
};

export function TodayCrossModuleStrip({ decisions }: Props) {
  // v1.90.0: build the widget list dynamically + use auto-fit so empty
  // widgets don't leave blank grid cells.
  // v2.0.0: only DecisionsWidget remains. Keeping the strip framework
  // so re-introducing widgets later is one push to the array.
  const widgets: React.ReactNode[] = [];
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

// v1.93.0: OutfitWidget retired — fitting / alterations / pickup
// dates no longer live on the OUTFIT card.
// v2.0.0: LegalWidget + Pill / dayPill helpers retired with the
// LEGAL kind. DecisionsWidget renders its own dates inline so
// neither helper is needed any more.

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
              // v2.5.x: load-bearing metadata (an actual due date, not
              // section-label chrome) — bumped from 11px/ink-tertiary
              // to text-xs/ink-secondary for legibility.
              <span className="text-xs text-ink-secondary tabular-nums flex-shrink-0">
                {shortDate(t.dueDate)}
              </span>
            ) : (
              <span className="text-xs text-ink-tertiary italic flex-shrink-0">no date</span>
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
