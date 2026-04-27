import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { StatusPill } from "@/components/ui/StatusPill";
import { redirect } from "next/navigation";
import { CountdownCard } from "./CountdownCard";
import { TodayEventsCard } from "./TodayEventsCard";

const WEDDING_ISO = process.env.WEDDING_DATE ?? "2026-09-26T14:00:00Z";
const WEDDING_VENUE = process.env.WEDDING_VENUE ?? "Alveston Manor";

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

function priorityLabel(p: string): "HIGH" | "MED" | "LOW" {
  if (p === "HIGH" || p === "URGENT") return "HIGH";
  if (p === "MEDIUM") return "MED";
  return "LOW";
}

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const userId = session.user.id;

  const [myTasks, guestStats, dietaryRows, upcomingEvents] = await Promise.all([
    db.task.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        type: "TASK",
        OR: [{ assigneeId: userId }, { assigneeId: null }],
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 8,
    }),
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

        <CountdownCard
          targetIso={WEDDING_ISO}
          venueLabel={WEDDING_VENUE}
          ceremonyLabel="2:00pm ceremony"
        />

        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <section className="md:col-span-2 bg-surface border border-border-soft rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink-primary">My tasks</h2>
              <Link href="/tasks" className="text-xs text-moss-500 hover:text-moss-700 hover:underline">
                See all →
              </Link>
            </div>
            {myTasks.length === 0 ? (
              <p className="text-sm text-ink-tertiary py-6 text-center">
                Nothing on your plate. Nice.
              </p>
            ) : (
              <ul className="divide-y divide-border-soft">
                {myTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <StatusPill status={priorityLabel(t.priority)} size="sm" />
                    <span className="text-sm text-ink-primary flex-1 truncate">{t.title}</span>
                    <span className="text-xs text-ink-tertiary flex-shrink-0">{formatDue(t.dueDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-col gap-4">
            <section className="bg-surface border border-border-soft rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-ink-primary mb-2">RSVPs</h2>
              <div className="font-display text-3xl text-marigold-700 font-semibold">
                {pending}
              </div>
              <div className="text-xs text-ink-tertiary mt-0.5">awaiting reply</div>
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
