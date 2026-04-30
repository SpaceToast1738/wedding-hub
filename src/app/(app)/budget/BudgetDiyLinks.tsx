// v1.37.5 (P7b/C): "Linked from DIY" panel on the Budget page —
// surfaces every BudgetLine that was created (or later linked) via a
// BUILD card's "Copy materials total to budget" action. Renders only
// when there's at least one such link. Each row deep-links back to
// the source DIY card so the couple can audit the rolled-up cost.

import Link from "next/link";

type LinkedRow = {
  buildCardId: string;
  buildCardTitle: string;
  buildSectionSlug: string;
  buildSubsectionSlug: string;
  budgetLineId: string;
  budgetLineDescription: string;
  estimated: number | null;
};

type Props = { links: LinkedRow[] };

function fmt(p: number | null): string {
  if (p == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(p);
}

export function BudgetDiyLinks({ links }: Props) {
  if (links.length === 0) return null;
  const total = links.reduce((sum, r) => sum + (r.estimated ?? 0), 0);
  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-primary">
          Linked from DIY
          <span className="ml-2 text-[11px] font-normal text-ink-tertiary">
            {links.length} {links.length === 1 ? "card" : "cards"}
          </span>
        </h2>
        <span className="text-xs text-ink-tertiary tabular-nums">
          Total: <span className="font-semibold text-ink-primary">{fmt(total)}</span>
        </span>
      </header>
      <ul className="divide-y divide-border-soft text-sm">
        {links.map((r) => (
          <li key={r.budgetLineId} className="px-4 py-2.5 flex items-baseline gap-3">
            <Link
              href={`/book/${r.buildSectionSlug}#${r.buildSubsectionSlug}`}
              className="text-ink-primary hover:text-moss-700 hover:underline truncate flex-1"
              title={`Open ${r.buildCardTitle} on the Wedding Book`}
            >
              {r.buildCardTitle}
            </Link>
            <span className="text-xs text-ink-tertiary truncate max-w-[200px]" title={r.budgetLineDescription}>
              → {r.budgetLineDescription}
            </span>
            <span className="text-sm tabular-nums text-ink-primary font-medium">
              {fmt(r.estimated)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
