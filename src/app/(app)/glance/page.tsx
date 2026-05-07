import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { Avatar } from "@/components/ui/Avatar";
import { requireUser } from "@/lib/actions";
import { getWeddingSettings } from "@/lib/wedding-settings";

function daysUntil(d: Date): number {
  const ms = d.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function formatGBP(n: number): string {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatRelativeTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Map an audit-log action+entity pair to a human-readable phrase. We keep
// this dumb-by-design — anything we don't know becomes a generic phrase
// rather than leaking action codes into the UI.
function describeActivity(entry: {
  action: string;
  entity: string;
  metadata: unknown;
}): string {
  const meta = (entry.metadata && typeof entry.metadata === "object")
    ? (entry.metadata as Record<string, unknown>)
    : {};
  const noun = entry.entity
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase();
  switch (entry.action) {
    case "create":
      return `added a ${noun}`;
    case "update":
      return `updated a ${noun}`;
    case "delete":
      return `deleted a ${noun}`;
    case "rsvp":
      return `set an RSVP to ${String(meta.rsvp ?? "—").toLowerCase()}`;
    case "import":
      return `imported ${meta.created ?? "?"} guests`;
    case "spotify_link":
      return `linked a Spotify playlist`;
    case "spotify_sync":
      return `synced ${meta.tracks ?? "?"} tracks from Spotify`;
    case "capture":
      return `captured a shot in the photography list`;
    case "uncapture":
      return `un-marked a shot in the photography list`;
    case "quickcapture":
      return `quick-captured a ${noun}`;
    case "signin":
      return `signed in`;
    case "status":
      return `changed a ${noun} status`;
    case "reorder":
      return `reordered a ${noun}`;
    default:
      return `${entry.action} a ${noun}`;
  }
}

const COUPLE_ONLY_ENTITIES = new Set([
  "Payment",
  "BudgetLine",
  "BudgetCategory",
]);

export default async function AtAGlancePage() {
  const user = await requireUser();
  const isCouple = user.isCouple;
  const wedding = await getWeddingSettings();

  // Parallelise everything that's safe to fan out.
  const [
    guestsByRsvp,
    recentRsvps,
    upcomingPayments,
    budgetTotals,
    myOpenTasks,
    recentActivity,
    spendPulsePayments,
  ] = await Promise.all([
    db.guest.groupBy({
      by: ["rsvp"],
      where: { archived: false },
      _count: { _all: true },
    }),
    db.guest.findMany({
      where: {
        archived: false,
        rsvp: { in: ["ATTENDING", "DECLINED"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { id: true, firstName: true, lastName: true, rsvp: true },
    }),
    isCouple
      ? db.payment.findMany({
          where: {
            status: { in: ["DUE", "SCHEDULED", "OVERDUE"] },
            dueDate: { lte: new Date(Date.now() + 30 * 86_400_000) },
          },
          orderBy: [{ dueDate: "asc" }],
          take: 4,
          include: { supplier: { select: { name: true } } },
        })
      : Promise.resolve([]),
    isCouple
      ? db.budgetLine.findMany({
          // B2 (v1.11.0): glance can't use `_sum: { actual }` anymore
          // because lines with `actual = null` are recomputed from
          // payments. Pull the rows + payment amounts and reduce in
          // app code so the totals match what the budget page shows.
          select: {
            estimated: true,
            actual: true,
            paid: true,
            payments: { select: { amount: true } },
          },
        })
      : Promise.resolve(null),
    db.task.findMany({
      where: {
        type: "TASK",
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        OR: [{ assigneeId: user.id }, { assigneeId: null }],
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 4,
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, email: true } } },
    }),
    // v1.77.0: spend pulse — last 30 days of paid payments + their
    // categories, used for "this week / this month / top categories"
    // rollup. Couple-only.
    isCouple
      ? db.payment.findMany({
          where: {
            status: "PAID",
            paidDate: { gte: new Date(Date.now() - 30 * 86_400_000) },
          },
          select: {
            amount: true,
            paidDate: true,
            budgetLine: { select: { category: { select: { id: true, name: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  const totalInvited = guestsByRsvp.reduce((n, g) => n + g._count._all, 0);
  const attending = guestsByRsvp.find((g) => g.rsvp === "ATTENDING")?._count._all ?? 0;
  const pending = guestsByRsvp.find((g) => g.rsvp === "PENDING")?._count._all ?? 0;
  const declined = guestsByRsvp.find((g) => g.rsvp === "DECLINED")?._count._all ?? 0;

  const days = daysUntil(wedding.weddingDate);

  // Budget aggregates (couple only). `actual` follows B2 manual-override
  // semantics: stored value wins; otherwise sum of payments.
  const budgetLines = budgetTotals ?? [];
  const budgetPlanned = budgetLines.reduce((s, l) => s + (l.estimated ? Number(l.estimated) : 0), 0);
  const budgetPaid = budgetLines.reduce((s, l) => s + (l.paid ? Number(l.paid) : 0), 0);
  const budgetActual = budgetLines.reduce((s, l) => {
    if (l.actual !== null) return s + Number(l.actual);
    return s + l.payments.reduce((ps, p) => ps + Number(p.amount), 0);
  }, 0);
  const budgetCommitted = Math.max(0, budgetActual - budgetPaid);
  const budgetRemaining = Math.max(0, budgetPlanned - budgetActual);

  // v1.77.0: spend pulse aggregates. Bucketise the last 30 days of
  // paid payments into "this week" (last 7 days) and "this month"
  // (last 30 days, inclusive of the week), plus the top 3 categories
  // by amount. Same source query — pure reduction here.
  const weekAgo = Date.now() - 7 * 86_400_000;
  let pulseThisWeek = 0;
  let pulseThisMonth = 0;
  const pulseByCategory = new Map<string, { id: string | null; name: string; total: number }>();
  for (const p of spendPulsePayments) {
    const amt = Number(p.amount.toString());
    pulseThisMonth += amt;
    if (p.paidDate && p.paidDate.getTime() >= weekAgo) pulseThisWeek += amt;
    const cat = p.budgetLine?.category;
    const key = cat?.id ?? "__uncat__";
    const display = cat?.name ?? "Uncategorised";
    const existing = pulseByCategory.get(key);
    if (existing) existing.total += amt;
    else pulseByCategory.set(key, { id: cat?.id ?? null, name: display, total: amt });
  }
  const pulseTopCategories = Array.from(pulseByCategory.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  return (
    <>
      <PageHeader
        title="At a Glance"
        subtitle="Big-picture stats and KPIs"
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1100px] mx-auto p-4 sm:p-6">
          {/* Four long columns on lg+; stack on smaller viewports so the
              cards don't squish below ~280px. The four cards (RSVPs,
              Budget/Wedding-day, Payments/Tasks, Recent activity) line
              up in a single row at desktop width. */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* RSVPs — donut + recent */}
            <GlanceCard title="RSVPs" viewAllHref="/guests">
              <RsvpDonut
                attending={attending}
                pending={pending}
                declined={declined}
                total={totalInvited}
              />
              <div className="mt-3">
                <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1.5">
                  Recent
                </div>
                {recentRsvps.length === 0 ? (
                  <p className="text-xs text-ink-tertiary italic">No replies yet.</p>
                ) : (
                  <ul className="divide-y divide-border-soft">
                    {recentRsvps.map((g) => (
                      <li key={g.id} className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-ink-primary truncate">
                          {g.firstName} {g.lastName}
                        </span>
                        <StatusPill
                          status={g.rsvp === "ATTENDING" ? "YES" : "NO"}
                          label={g.rsvp === "ATTENDING" ? "Confirmed" : "Declined"}
                          size="sm"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </GlanceCard>

            {/* Budget — couple only; non-couple gets a wedding-day card */}
            {isCouple ? (
              <GlanceCard title="Budget" viewAllHref="/budget">
                <div className="font-display text-3xl font-semibold text-ink-primary leading-none">
                  {formatGBP(budgetPlanned)}
                </div>
                <div className="text-xs text-ink-tertiary mb-3 mt-1">planned total</div>
                <BudgetBar
                  paid={budgetPaid}
                  committed={budgetCommitted}
                  total={Math.max(budgetPlanned, budgetActual, 1)}
                />
                <div className="flex gap-4 mt-3 flex-wrap">
                  <BudgetStat label="Paid" value={formatGBP(budgetPaid)} tone="moss" />
                  <BudgetStat label="Committed" value={formatGBP(budgetCommitted)} tone="marigold" />
                  <BudgetStat label="Remaining" value={formatGBP(budgetRemaining)} />
                </div>
                {/* v1.77.0: spend pulse — recent paid totals + top
                    categories. Hidden when there's been no spend in
                    the last 30 days so the card isn't padded with a
                    zeroed strip on a fresh DB. */}
                {pulseThisMonth > 0 && (
                  <div className="mt-3 pt-3 border-t border-border-soft">
                    <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1.5">
                      Recent spend
                    </div>
                    <div className="flex gap-3 flex-wrap text-xs mb-1.5">
                      <span>
                        <strong className="text-ink-primary tabular-nums">{formatGBP(pulseThisWeek)}</strong>
                        <span className="text-ink-tertiary ml-1">this week</span>
                      </span>
                      <span>
                        <strong className="text-ink-primary tabular-nums">{formatGBP(pulseThisMonth)}</strong>
                        <span className="text-ink-tertiary ml-1">this month</span>
                      </span>
                    </div>
                    {pulseTopCategories.length > 0 && (
                      <ul className="space-y-0.5">
                        {pulseTopCategories.map((c) => (
                          <li key={c.id ?? "__uncat__"} className="flex justify-between text-[11px]">
                            <span className="text-ink-tertiary truncate">
                              {c.id ? (
                                <a
                                  href={`/payments?category=${c.id}`}
                                  className="hover:text-moss-700 hover:underline"
                                >
                                  {c.name}
                                </a>
                              ) : (
                                c.name
                              )}
                            </span>
                            <span className="text-ink-secondary tabular-nums">{formatGBP(c.total)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </GlanceCard>
            ) : (
              <GlanceCard title="Wedding day">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-full bg-marigold-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-display text-xl font-bold text-moss-700 tabular-nums">
                      {days}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-ink-primary">days to go</div>
                    <div className="text-[11px] text-ink-tertiary">26 September 2026</div>
                  </div>
                </div>
                <div className="mt-3.5 text-xs text-ink-tertiary flex items-center gap-1.5">
                  <span className="text-ink-tertiary">🔒</span>
                  Budget is restricted to Jamie &amp; Bryony
                </div>
              </GlanceCard>
            )}

            {/* Payments due — couple only; non-couple sees their tasks */}
            {isCouple ? (
              <GlanceCard title="Payments due" viewAllHref="/payments">
                <div className="text-xs text-ink-tertiary mb-2">Next 30 days</div>
                {upcomingPayments.length === 0 ? (
                  <p className="text-xs text-ink-tertiary italic py-2">
                    Nothing due in the next month.
                  </p>
                ) : (
                  <ul className="divide-y divide-border-soft">
                    {upcomingPayments.map((p) => (
                      <li key={p.id} className="flex items-center gap-2.5 py-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-ink-primary truncate">
                            {p.supplier?.name ?? p.description}
                          </div>
                          <div className="text-[10px] text-ink-tertiary">
                            Due {formatDate(p.dueDate)}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-ink-primary tabular-nums">
                          {formatGBP(Number(p.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </GlanceCard>
            ) : (
              <GlanceCard title="My open tasks" viewAllHref="/tasks">
                {myOpenTasks.length === 0 ? (
                  <p className="text-xs text-ink-tertiary italic py-2">
                    Nothing on your plate.
                  </p>
                ) : (
                  <ul className="divide-y divide-border-soft">
                    {myOpenTasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-2 py-1.5">
                        <span
                          className={`w-1 h-3.5 rounded ${
                            t.priority === "HIGH" || t.priority === "URGENT"
                              ? "bg-danger"
                              : t.priority === "LOW"
                                ? "bg-moss-300"
                                : "bg-marigold-500"
                          } flex-shrink-0`}
                        />
                        <span className="flex-1 text-xs text-ink-primary truncate">
                          {t.title}
                        </span>
                        <span className="text-[10px] text-ink-tertiary">
                          {formatDate(t.dueDate)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </GlanceCard>
            )}

            {/* Recent activity — pulled from the audit log; redacts couple-only
                entities for non-couple viewers. */}
            <GlanceCard title="Recent activity">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-ink-tertiary italic py-2">No recent activity.</p>
              ) : (
                <ul className="divide-y divide-border-soft">
                  {recentActivity.map((a) => {
                    const restricted = !isCouple && COUPLE_ONLY_ENTITIES.has(a.entity);
                    const who = a.user?.name ?? a.user?.email ?? "Someone";
                    const phrase = restricted
                      ? "updated a private page"
                      : describeActivity({
                          action: a.action,
                          entity: a.entity,
                          metadata: a.metadata,
                        });
                    return (
                      <li
                        key={a.id}
                        className={`flex items-start gap-2.5 py-1.5 ${restricted ? "opacity-65" : ""}`}
                      >
                        <Avatar name={who} size={22} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs">
                            <span className="font-medium text-ink-primary">{who}</span>{" "}
                            <span className={`text-ink-secondary ${restricted ? "italic" : ""}`}>
                              {phrase}
                            </span>
                          </div>
                          <div className="text-[10px] text-ink-tertiary">
                            {formatRelativeTime(a.createdAt)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </GlanceCard>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Building blocks ────────────────────────────────────────────────────

function GlanceCard({
  title,
  viewAllHref,
  children,
}: {
  title: string;
  viewAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm overflow-hidden">
      <header className="px-4 py-3 border-b border-border-soft flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-primary">{title}</h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-[11px] text-moss-500 hover:text-moss-700 hover:underline"
          >
            View all →
          </Link>
        )}
      </header>
      <div className="px-4 py-3.5">{children}</div>
    </section>
  );
}

function BudgetStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "moss" | "marigold";
}) {
  const cls =
    tone === "moss"
      ? "text-moss-700"
      : tone === "marigold"
        ? "text-marigold-700"
        : "text-ink-secondary";
  return (
    <div>
      <div className="text-[10px] text-ink-tertiary">{label}</div>
      <div className={`text-sm font-semibold ${cls} tabular-nums`}>{value}</div>
    </div>
  );
}

function BudgetBar({
  paid,
  committed,
  total,
}: {
  paid: number;
  committed: number;
  total: number;
}) {
  const paidPct = (paid / total) * 100;
  const committedPct = (committed / total) * 100;
  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden flex">
      <div
        className="bg-moss-500 transition-[width] duration-500"
        style={{ width: `${Math.min(paidPct, 100)}%` }}
        aria-label="Paid"
      />
      <div
        className="bg-marigold-500 opacity-70 transition-[width] duration-500"
        style={{ width: `${Math.min(committedPct, 100 - paidPct)}%` }}
        aria-label="Committed"
      />
    </div>
  );
}

function RsvpDonut({
  attending,
  pending,
  declined,
  total,
}: {
  attending: number;
  pending: number;
  declined: number;
  total: number;
}) {
  // SVG donut. Three arcs: confirmed (moss) + pending (marigold) + declined
  // (danger), drawn as overlapping stroke-dasharrays. Total of 0 just shows
  // an empty ring with a "—" centre.
  const r = 44;
  const cx = 60;
  const cy = 60;
  const circ = 2 * Math.PI * r;
  const safeTotal = total === 0 ? 1 : total;
  const confirmedArc = (attending / safeTotal) * circ;
  const pendingArc = (pending / safeTotal) * circ;
  const declinedArc = (declined / safeTotal) * circ;
  // Offsets stack the arcs end-to-end starting from the 12 o'clock position.
  const startOffset = circ * 0.25; // rotate -90° equivalent
  return (
    <div className="flex items-center gap-4">
      <svg width={120} height={120} viewBox="0 0 120 120" className="flex-shrink-0">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--color-border-soft)"
          strokeWidth={10}
        />
        {attending > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-moss-500)"
            strokeWidth={10}
            strokeDasharray={`${confirmedArc} ${circ}`}
            strokeDashoffset={startOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
        {pending > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-marigold-500)"
            strokeWidth={10}
            strokeDasharray={`${pendingArc} ${circ}`}
            strokeDashoffset={-(confirmedArc - startOffset)}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
        {declined > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-danger)"
            strokeWidth={10}
            strokeDasharray={`${declinedArc} ${circ}`}
            strokeDashoffset={-(confirmedArc + pendingArc - startOffset)}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fontFamily="var(--font-display)"
          fill="var(--color-ink-primary)"
        >
          {total === 0 ? "—" : attending}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-ink-tertiary)"
          fontFamily="var(--font-ui)"
        >
          of {total}
        </text>
      </svg>
      <ul className="flex flex-col gap-1.5 text-xs">
        <LegendDot color="var(--color-moss-500)" label={`${attending} confirmed`} />
        <LegendDot color="var(--color-marigold-500)" label={`${pending} pending`} />
        <LegendDot color="var(--color-danger)" label={`${declined} declined`} />
      </ul>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-ink-secondary">
      <span
        className="w-2 h-2 rounded-full inline-block flex-shrink-0"
        style={{ background: color }}
      />
      {label}
    </li>
  );
}
