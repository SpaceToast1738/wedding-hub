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

// v1.90.0: entity → small badge config. Lets each row in the feed
// carry a colour-coded icon prefix so the eye picks out the kind of
// change before reading the sentence (Payment vs Guest vs File etc.).
// Falls through to a neutral "·" for unknown entities so the column
// width stays consistent. Tone names map to existing palette tokens.
type Tone = "moss" | "marigold" | "info" | "danger" | "muted";
const ENTITY_BADGE: Record<string, { glyph: string; tone: Tone; label: string }> = {
  Task:                { glyph: "✓", tone: "moss",     label: "Task" },
  Payment:             { glyph: "£", tone: "marigold", label: "Payment" },
  BudgetLine:          { glyph: "£", tone: "marigold", label: "Budget line" },
  BudgetCategory:      { glyph: "£", tone: "marigold", label: "Budget" },
  BudgetLineComponent: { glyph: "£", tone: "marigold", label: "Budget component" },
  Supplier:            { glyph: "◆", tone: "info",     label: "Supplier" },
  SupplierContact:     { glyph: "◆", tone: "info",     label: "Supplier contact" },
  SupplierContract:    { glyph: "◆", tone: "info",     label: "Supplier contract" },
  Guest:               { glyph: "♥", tone: "moss",     label: "Guest" },
  Household:           { glyph: "♥", tone: "moss",     label: "Household" },
  Table:               { glyph: "▦", tone: "info",     label: "Table" },
  Seat:                { glyph: "▦", tone: "info",     label: "Seat" },
  CeremonySeating:     { glyph: "▦", tone: "info",     label: "Ceremony seating" },
  ScheduleEvent:       { glyph: "◷", tone: "marigold", label: "Schedule" },
  BookSection:         { glyph: "❧", tone: "moss",     label: "Book section" },
  BookSubsection:      { glyph: "❧", tone: "moss",     label: "Book page" },
  Playlist:            { glyph: "♪", tone: "info",     label: "Playlist" },
  Song:                { glyph: "♪", tone: "info",     label: "Song" },
  WeddingSettings:     { glyph: "✦", tone: "muted",    label: "Settings" },
  NavTag:              { glyph: "#", tone: "muted",    label: "Tag" },
  File:                { glyph: "📎", tone: "muted",   label: "File" },
  Invite:              { glyph: "✉", tone: "info",     label: "Invite" },
  User:                { glyph: "@", tone: "muted",    label: "User" },
  PermissionGroup:     { glyph: "@", tone: "muted",    label: "Permission group" },
};
const FALLBACK_BADGE = { glyph: "·", tone: "muted" as Tone, label: "Activity" };

function badgeClasses(tone: Tone): string {
  switch (tone) {
    case "moss":     return "bg-moss-50 text-moss-700 border-moss-300";
    case "marigold": return "bg-marigold-100 text-marigold-700 border-marigold-700/30";
    case "info":     return "bg-info/10 text-info border-info/30";
    case "danger":   return "bg-danger/10 text-danger border-danger/30";
    case "muted":
    default:         return "bg-canvas text-ink-tertiary border-border-soft";
  }
}

// v1.90.0: human-readable initials for the user attribution chip.
// "Jamie Spencer" → "JS"; falls back to the first 2 letters of the
// email or a generic ◯. Used in the trailing avatar bubble so the
// "who" sits beside the row instead of inline-running with the
// sentence.
function initialsFor(name: string | null, email: string | null): string {
  const candidate = (name ?? "").trim();
  if (candidate) {
    const parts = candidate.split(/\s+/);
    const a = parts[0]?.[0] ?? "";
    const b = parts.length > 1 ? parts[parts.length - 1]![0] ?? "" : "";
    const joined = `${a}${b}`.toUpperCase();
    if (joined) return joined;
  }
  const fromEmail = (email ?? "").trim();
  if (fromEmail) return fromEmail.slice(0, 2).toUpperCase();
  return "◯";
}

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
      {/* v1.90.0: rows rendered as a `divide-y` list (subtle border
          between consecutive items) with a colour-coded entity badge,
          monospace timestamp column, the formatted sentence, and a
          trailing initials chip for the actor. Replaces a wall of
          uniform-coloured plaintext where every row blurred together. */}
      <ul className="divide-y divide-border-soft/60 -mx-2">
        {rows.map((r) => {
          const summary = formatAuditAction({
            action: r.action,
            entity: r.entity,
            metadata: r.metadata,
          });
          const who = r.userName ?? r.userEmail ?? "system";
          const badge = ENTITY_BADGE[r.entity] ?? FALLBACK_BADGE;
          const initials = initialsFor(r.userName, r.userEmail);
          return (
            <li
              key={r.id}
              className="flex items-center gap-2.5 px-2 py-1.5 text-sm hover:bg-canvas/40 rounded-sm transition-colors"
              title={`${r.entity} · ${r.createdAt.toLocaleString("en-GB")}`}
            >
              {/* Entity glyph badge — colour-coded by category. */}
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-sm border text-[11px] font-bold flex-shrink-0 ${badgeClasses(badge.tone)}`}
                aria-label={badge.label}
              >
                {badge.glyph}
              </span>
              {/* Timestamp — right-justified for column alignment. */}
              <span className="text-[11px] text-ink-tertiary tabular-nums flex-shrink-0 min-w-[64px] text-right">
                {timeAgo(r.createdAt)}
              </span>
              {/* The sentence — primary content, truncates on overflow. */}
              <span className="text-ink-primary flex-1 truncate">
                {summary}
              </span>
              {/* Actor — initials chip, full name in the title. */}
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-canvas border border-border-soft text-[10px] font-bold text-ink-secondary flex-shrink-0"
                title={who}
              >
                {initials}
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
