import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { CountdownCard } from "./CountdownCard";
import { TodayEventsCard } from "./TodayEventsCard";

const WEDDING_ISO = process.env.WEDDING_DATE ?? "2026-09-26T14:00:00Z";
const WEDDING_VENUE = process.env.WEDDING_VENUE ?? "Alveston Manor";
// v1.19.0: hardcoded couple label for now; v1.20.0 wires this to
// WeddingSettings so the user can edit it in Settings without a
// redeploy.
const COUPLE_LABEL =
  process.env.WEDDING_COUPLE_SHORT ?? "Jamie & Bryony's Wedding";

function formatDue(due: Date | null): string {
  if (!due) return "no due date";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return `Overdue · ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return due.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return due.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Per-priority dot colour — moss for HIGH/URGENT, marigold for MEDIUM,
// muted for LOW. Matches the StatusPill palette without the box.
function priorityDotColour(p: string): string {
  if (p === "URGENT" || p === "HIGH") return "bg-marigold-700";
  if (p === "MEDIUM") return "bg-marigold-500";
  return "bg-border-strong";
}

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const userId = session.user.id;

  const [myTasks, totalTaskCount, guestStats, dietaryRows, upcomingEvents] = await Promise.all([
    db.task.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        type: "TASK",
        OR: [{ assigneeId: userId }, { assigneeId: null }],
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 5,
    }),
    // v1.19.0: total non-archived task count for the "See all N tasks →"
    // footer link in the column-2 card.
    db.task.count({ where: { type: "TASK", status: { not: "ARCHIVED" } } }),
    db.guest.groupBy({
      by: ["rsvp"],
      where: { archived: false },
      _count: { _all: true },
    }),
    db.guest.findMany({
      where: { rsvp: "ATTENDING", archived: false },
      select: { isChild: true, needsHighchair: true, dietary: true },
    }),
    db.scheduleEvent.findMany({
      where: { startTime: { gte: new Date() } },
      orderBy: { startTime: "asc" },
      take: 8,
    }),
  ]);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const totalInvited = guestStats.reduce((n, g) => n + g._count._all, 0);
  const attending = guestStats.find((g) => g.rsvp === "ATTENDING")?._count._all ?? 0;
  const pending = guestStats.find((g) => g.rsvp === "PENDING")?._count._all ?? 0;
  const declined = guestStats.find((g) => g.rsvp === "DECLINED")?._count._all ?? 0;

  // Dietary aggregate (attending only)
  const dietaryCounts = new Map<string, number>();
  let highchairs = 0;
  let children = 0;
  for (const g of dietaryRows) {
    if (g.isChild) children++;
    if (g.needsHighchair) highchairs++;
    for (const d of g.dietary) {
      const k = d.trim();
      if (!k) continue;
      dietaryCounts.set(k, (dietaryCounts.get(k) ?? 0) + 1);
    }
  }
  const topDietary = [...dietaryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k, v]) => `${v} ${k.toLowerCase()}`)
    .join(" · ");

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-[1100px] mx-auto">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-ink-primary">Today</h1>
            <div className="text-xs text-ink-tertiary mt-0.5">{today}</div>
          </div>
          <Link
            href="/today/day-of"
            className="inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700"
            title="Live timeline, day-of contacts, catering, quick links"
          >
            ◉ Day-of mode
          </Link>
        </div>

        {/* v1.19.0: 3-column equal grid matching the mockup. Cards
            stack on mobile (<sm). Each card is `h-full` so they all
            line up to the tallest. */}
        <div className="grid gap-4 lg:grid-cols-3 mb-4 items-stretch">
          <CountdownCard
            targetIso={WEDDING_ISO}
            venueLabel={WEDDING_VENUE}
            coupleLabel={COUPLE_LABEL}
          />

          <section className="bg-surface border border-border-soft rounded-lg p-5 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink-primary">My open tasks</h2>
              <span className="text-xs text-ink-tertiary">
                {myTasks.length} open
              </span>
            </div>
            {myTasks.length === 0 ? (
              <p className="text-sm text-ink-tertiary py-6 text-center flex-1">
                Nothing on your plate. Nice.
              </p>
            ) : (
              <ul className="flex-1 space-y-2.5">
                {myTasks.map((t) => {
                  const overdue = t.dueDate && t.dueDate < new Date();
                  return (
                    <li key={t.id} className="flex items-center gap-3">
                      <span
                        className={[
                          "w-1 h-7 rounded flex-shrink-0",
                          priorityDotColour(t.priority),
                        ].join(" ")}
                        aria-hidden
                      />
                      <input
                        type="checkbox"
                        disabled
                        className="cursor-not-allowed opacity-60 flex-shrink-0"
                        aria-label={`Mark "${t.title}" done — open Tasks page to toggle`}
                      />
                      <span className="text-sm text-ink-primary flex-1 truncate">
                        {t.title}
                      </span>
                      <span
                        className={[
                          "text-xs flex-shrink-0 tabular-nums",
                          overdue ? "text-danger font-medium" : "text-ink-tertiary",
                        ].join(" ")}
                      >
                        {formatDue(t.dueDate)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              href="/tasks"
              className="block mt-4 pt-3 border-t border-border-soft text-xs text-moss-500 hover:text-moss-700 hover:underline"
            >
              See all {totalTaskCount} tasks →
            </Link>
          </section>

          <TodayEventsCard
            events={upcomingEvents.map((e) => ({
              id: e.id,
              title: e.title,
              startTime: e.startTime,
              location: e.location,
              audience: e.audience,
            }))}
            currentUserRole={session.user.role}
          />
        </div>

        {/* RSVP / catering snapshot strip */}
        <div className="bg-surface border border-border-soft rounded-md px-5 py-3 flex items-center gap-x-6 gap-y-1.5 flex-wrap">
          <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">
            Snapshot
          </div>
          <SnapBit label={`${totalInvited} invited`} />
          <SnapBit label={`${attending} attending`} tone="moss" />
          <SnapBit label={`${pending} pending`} tone="marigold" />
          {declined > 0 && <SnapBit label={`${declined} declined`} tone="muted" />}
          {topDietary && <SnapBit label={topDietary} tone="muted" />}
          {(children > 0 || highchairs > 0) && (
            <SnapBit
              label={[
                children > 0 ? `${children} child${children === 1 ? "" : "ren"}` : null,
                highchairs > 0 ? `${highchairs} highchair${highchairs === 1 ? "" : "s"}` : null,
              ].filter(Boolean).join(" · ")}
              tone="muted"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SnapBit({ label, tone }: { label: string; tone?: "moss" | "marigold" | "muted" }) {
  const cls =
    tone === "moss"
      ? "text-moss-700 font-semibold"
      : tone === "marigold"
        ? "text-marigold-700 font-semibold"
        : tone === "muted"
          ? "text-ink-secondary"
          : "text-ink-primary font-semibold";
  return <span className={`text-sm ${cls}`}>{label}</span>;
}
