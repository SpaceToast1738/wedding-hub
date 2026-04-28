// v1.21.0: couple-only audit log viewer in Settings. Surfaces the
// AuditLog rows that every server action writes via `audit()`, so the
// couple can answer "who changed Bryony's RSVP" or "when did Aimee
// import the latest guest CSV" without digging into Postgres.
//
// Pagination is cursor-based via `before` search param — simple "Older
// →" link rather than infinite scroll. Defaults to 50 rows; the panel
// is collapsed by default so the Settings page doesn't dump 50 lines
// at first load.

import Link from "next/link";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type AuditLogRow = Prisma.AuditLogGetPayload<{
  include: { user: { select: { name: true; email: true } } };
}>;

const LIMIT = 50;

function formatTimestamp(d: Date): string {
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

function formatAction(row: AuditLogRow): string {
  // The `action` strings written by `audit()` are short verbs:
  // "create" / "update" / "delete" / "assign" / etc. Pretty them up
  // a touch for the read view.
  const noun = row.entity.replace(/([A-Z])/g, " $1").trim().toLowerCase();
  return `${row.action} ${noun}`;
}

function formatMetadata(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  // Compact one-line summary of the metadata Json. Truncate long keys.
  const entries = Object.entries(meta as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .slice(0, 3)
    .map(([k, v]) => {
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      const trimmed = s.length > 30 ? `${s.slice(0, 28)}…` : s;
      return `${k}: ${trimmed}`;
    });
  return entries.join(" · ");
}

export async function AuditLogPanel({
  isCouple,
  before,
}: {
  isCouple: boolean;
  before?: string;
}) {
  if (!isCouple) {
    // Non-couple users can see the section header so they understand
    // the feature exists, but no rows. Mirrors CustomFieldsPanel's
    // treatment.
    return (
      <section className="bg-surface border border-border-soft rounded-md p-5 shadow-sm">
        <header>
          <h2 className="text-sm font-semibold text-ink-primary">Audit log</h2>
          <p className="text-[11px] text-ink-tertiary">
            Couple-only. Records every server-side write across the app.
          </p>
        </header>
      </section>
    );
  }

  const beforeDate = before ? new Date(before) : null;
  const where = beforeDate && !Number.isNaN(beforeDate.getTime())
    ? { createdAt: { lt: beforeDate } }
    : undefined;

  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    include: { user: { select: { name: true, email: true } } },
  });

  // Older-link cursor is the createdAt of the last row in this page.
  const olderCursor = rows.length === LIMIT ? rows[rows.length - 1]?.createdAt.toISOString() : null;

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-5 py-4 border-b border-border-soft">
        <h2 className="text-sm font-semibold text-ink-primary">Audit log</h2>
        <p className="text-[11px] text-ink-tertiary">
          {rows.length === 0
            ? "No entries match this view."
            : before
              ? `${rows.length} entries before ${formatTimestamp(new Date(before))}`
              : `Most recent ${rows.length} entries.`}
        </p>
      </header>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider bg-canvas">
                <th className="px-4 py-2 text-left whitespace-nowrap">When</th>
                <th className="px-4 py-2 text-left">Who</th>
                <th className="px-4 py-2 text-left">What</th>
                <th className="px-4 py-2 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border-soft last:border-b-0 hover:bg-muted/30">
                  <td className="px-4 py-2 text-ink-tertiary tabular-nums whitespace-nowrap">
                    {formatTimestamp(row.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-ink-secondary">
                    {row.user
                      ? row.user.name ?? row.user.email
                      : <span className="italic text-ink-tertiary">system</span>}
                  </td>
                  <td className="px-4 py-2 text-ink-primary capitalize">
                    {formatAction(row)}
                  </td>
                  <td className="px-4 py-2 text-ink-tertiary truncate max-w-[420px]">
                    {formatMetadata(row.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <footer className="px-5 py-3 border-t border-border-soft flex items-center justify-between gap-2 text-[11px]">
        {before && (
          <Link href="/settings" className="text-info hover:underline">
            ← Latest
          </Link>
        )}
        <span className="flex-1" />
        {olderCursor && (
          <Link href={`/settings?audit_before=${encodeURIComponent(olderCursor)}`} className="text-info hover:underline">
            Older →
          </Link>
        )}
      </footer>
    </section>
  );
}
