// v1.39.1 (backlog #2): Recent-activity feed for the Today page.
// Reads the last N audit-log rows and renders a compact, sentenced
// list using the v1.39.0 `formatAuditAction` helper. Couple-only —
// non-couple users get nothing rendered (the AuditLog table includes
// every server-side write across the app, including ones that touch
// budget/payments which are also couple-only).
//
// Lives on the Today page next to the cross-module strip; auto-hides
// when the log is empty so a freshly-seeded prod doesn't render an
// empty card. Limit is 10 by default — bump up via the prop if a
// fuller surface is wanted somewhere else.
//
// Pure presentational from the component's POV — the page-level
// async parent does the DB fetch and passes shaped rows here. That
// keeps the component itself easy to render in isolation later if
// it ever moves into a sidebar / dialog / dedicated page.

import Link from "next/link";
import { formatAuditAction } from "@/lib/audit-format";
import { timeAgo } from "@/lib/time-ago";

type FeedRow = {
  id: string;
  action: string;
  entity: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
};

type Props = {
  rows: FeedRow[];
  isCouple: boolean;
  /** Total audit-row count (informational — shown in the header). */
  totalCount?: number;
};

export function RecentActivityFeed({ rows, isCouple, totalCount }: Props) {
  if (!isCouple) return null;
  if (rows.length === 0) return null;
  return (
    <section className="bg-surface border border-border-soft rounded-lg p-5 shadow-sm">
      <header className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-ink-primary">Recent activity</h2>
        <span className="text-xs text-ink-tertiary">
          {totalCount != null ? `${rows.length} of ${totalCount}` : `last ${rows.length}`}
        </span>
      </header>
      <ul className="space-y-1.5 text-sm">
        {rows.map((r) => {
          const summary = formatAuditAction({
            action: r.action,
            entity: r.entity,
            metadata: r.metadata,
          });
          const who = r.userName ?? r.userEmail ?? "system";
          return (
            <li
              key={r.id}
              className="flex items-baseline gap-2 leading-tight"
              title={r.createdAt.toLocaleString("en-GB")}
            >
              <span
                className="text-[11px] text-ink-tertiary tabular-nums flex-shrink-0 min-w-[64px]"
              >
                {timeAgo(r.createdAt)}
              </span>
              <span className="text-ink-secondary truncate flex-1">
                <span className="text-ink-primary">{summary}</span>
                <span className="text-ink-tertiary"> · {who}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        href="/settings"
        className="block mt-3 pt-3 border-t border-border-soft text-xs text-moss-500 hover:text-moss-700 hover:underline"
      >
        Full audit log →
      </Link>
    </section>
  );
}
