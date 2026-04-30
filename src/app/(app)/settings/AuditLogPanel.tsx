// v1.21.0: couple-only audit log viewer in Settings. Surfaces the
// AuditLog rows that every server action writes via `audit()`, so the
// couple can answer "who changed Bryony's RSVP" or "when did Aimee
// import the latest guest CSV" without digging into Postgres.
//
// Pagination is cursor-based via `before` search param — simple "Older
// →" link rather than infinite scroll. Defaults to 50 rows; the panel
// is collapsed by default so the Settings page doesn't dump 50 lines
// at first load.
//
// v1.32.0: "what" column rendered via `formatAuditAction` (human
// sentences) — see [src/lib/audit-format.ts].
//
// v1.32.1: search box (matches against action / entity / user / and
// the formatted "what" sentence). Retention is 30 days — older rows
// auto-pruned by `logAudit()`.

import Link from "next/link";
import { db } from "@/lib/db";
import { formatAuditAction } from "@/lib/audit-format";

const LIMIT = 50;
// When searching we widen the fetch so the post-filter has enough
// candidates to find matches in the formatted-summary text. Capped
// to keep render cost bounded — the user can refine the term to
// trim the result set further.
const SEARCH_FETCH_LIMIT = 200;

function formatTimestamp(d: Date): string {
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

// v1.32.0: detail line. The "what" column carries the human sentence;
// this column shows secondary metadata (changed-fields list, IDs,
// etc.) that's useful but doesn't belong in the headline.
function formatMetadata(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  const entries = Object.entries(meta as Record<string, unknown>)
    .filter(([k, v]) => k !== "summary" && v !== null && v !== undefined && v !== "")
    .filter(([k]) => !["cardTitle", "title", "name", "label", "kind", "type"].includes(k))
    .slice(0, 4)
    .map(([k, v]) => {
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      const trimmed = s.length > 40 ? `${s.slice(0, 38)}…` : s;
      return `${k}: ${trimmed}`;
    });
  return entries.join(" · ");
}

export async function AuditLogPanel({
  isCouple,
  before,
  query,
}: {
  isCouple: boolean;
  before?: string;
  query?: string;
}) {
  if (!isCouple) {
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

  const term = (query ?? "").trim();
  const isSearching = term.length > 0;

  const beforeDate = before ? new Date(before) : null;
  const beforeFilter =
    beforeDate && !Number.isNaN(beforeDate.getTime())
      ? { createdAt: { lt: beforeDate } }
      : {};

  // DB-level filter for action / entity / user. Metadata's Json shape
  // is post-filtered in JS via the formatAuditAction sentence below.
  const searchFilter = isSearching
    ? {
        OR: [
          { action: { contains: term, mode: "insensitive" as const } },
          { entity: { contains: term, mode: "insensitive" as const } },
          {
            user: {
              is: {
                OR: [
                  { name: { contains: term, mode: "insensitive" as const } },
                  { email: { contains: term, mode: "insensitive" as const } },
                ],
              },
            },
          },
        ],
      }
    : {};

  const where = {
    ...beforeFilter,
    ...(isSearching ? searchFilter : {}),
  };

  const rawRows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: isSearching ? SEARCH_FETCH_LIMIT : LIMIT,
    include: { user: { select: { name: true, email: true } } },
  });

  // For search, post-filter in JS to also match against the formatted
  // "what" sentence — this catches metadata-only matches like a card
  // title or material name embedded in the human summary.
  const rows = isSearching
    ? rawRows.filter((row) => {
        const summary = formatAuditAction({
          action: row.action,
          entity: row.entity,
          metadata:
            row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
              ? (row.metadata as Record<string, unknown>)
              : null,
        });
        const t = term.toLowerCase();
        return (
          summary.toLowerCase().includes(t) ||
          row.action.toLowerCase().includes(t) ||
          row.entity.toLowerCase().includes(t) ||
          (row.user?.name ?? "").toLowerCase().includes(t) ||
          (row.user?.email ?? "").toLowerCase().includes(t)
        );
      })
    : rawRows;

  // Cursor only relevant when not searching.
  const olderCursor =
    !isSearching && rows.length === LIMIT
      ? rows[rows.length - 1]?.createdAt.toISOString()
      : null;

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-5 py-4 border-b border-border-soft flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-ink-primary">Audit log</h2>
          <p className="text-[11px] text-ink-tertiary">
            {rows.length === 0
              ? isSearching
                ? `No entries match "${term}".`
                : "No entries match this view."
              : isSearching
                ? `${rows.length} match${rows.length === 1 ? "" : "es"} for "${term}".`
                : before
                  ? `${rows.length} entries before ${formatTimestamp(new Date(before))}`
                  : `Most recent ${rows.length} entries (kept 30 days).`}
          </p>
        </div>
        {/* Search box — plain GET form, no client JS. Submitting
            navigates to /settings?audit_q=… which the page reads. */}
        <form action="/settings" method="get" className="flex items-center gap-1.5">
          <label htmlFor="audit-q" className="sr-only">
            Search audit log
          </label>
          <input
            id="audit-q"
            type="text"
            name="audit_q"
            defaultValue={term}
            placeholder="Search…"
            className="text-xs bg-canvas border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500 w-[160px]"
          />
          <button
            type="submit"
            className="text-[10px] uppercase tracking-wider text-info hover:underline px-1"
          >
            Search
          </button>
          {isSearching && (
            <Link
              href="/settings"
              className="text-[10px] uppercase tracking-wider text-ink-tertiary hover:text-ink-primary px-1"
            >
              Clear
            </Link>
          )}
        </form>
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
                  <td className="px-4 py-2 text-ink-primary">
                    {formatAuditAction({
                      action: row.action,
                      entity: row.entity,
                      metadata:
                        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
                          ? (row.metadata as Record<string, unknown>)
                          : null,
                    })}
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
        {/* Pagination only renders without an active search — searching
            spans the full visible range up to SEARCH_FETCH_LIMIT. */}
        {!isSearching && before && (
          <Link href="/settings" className="text-info hover:underline">
            ← Latest
          </Link>
        )}
        <span className="flex-1" />
        {!isSearching && olderCursor && (
          <Link
            href={`/settings?audit_before=${encodeURIComponent(olderCursor)}`}
            className="text-info hover:underline"
          >
            Older →
          </Link>
        )}
        {isSearching && rawRows.length === SEARCH_FETCH_LIMIT && (
          <span className="text-ink-tertiary italic">
            Showing the most recent {SEARCH_FETCH_LIMIT} candidates — refine the term to narrow further.
          </span>
        )}
      </footer>
    </section>
  );
}
