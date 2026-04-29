import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getWeddingSettings } from "@/lib/wedding-settings";
import { CountdownCard } from "./CountdownCard";
import { TodayEventsCard } from "./TodayEventsCard";
import { TodayTaskList } from "./TodayTaskList";

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const userId = session.user.id;
  const wedding = await getWeddingSettings();

  const [allOpenTasks, totalTaskCount, guestStats, dietaryRows, upcomingEvents] = await Promise.all([
    // v1.27.2: fetch all open TASK rows (no take, no assignee filter)
    // and select the user's tasks client-side. Pre-fix the query was
    // narrow (assigned-to-me OR unassigned) AND had `take: 5` AND
    // sorted by dueDate asc (which puts nulls last in Postgres). If
    // the user had no assigned tasks but plenty of dated ones for
    // others, the section was empty. Now we broaden the fetch and
    // apply a smarter sort below.
    db.task.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        type: "TASK",
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
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
            targetIso={wedding.weddingDate.toISOString()}
            venueLabel={wedding.venue}
            coupleLabel={wedding.coupleShort}
          />

          {(() => {
            // v1.27.2: pick the user's view of "my next tasks" client-
            // side from the fully-fetched open list. Priority order:
            //   1. Tasks assigned to me with a due date (soonest first).
            //   2. Tasks assigned to me without a due date.
            //   3. Tasks unassigned with a due date.
            //   4. Tasks unassigned without a due date.
            // If after all that the list is still empty (user genuinely
            // has nothing assigned + nothing unassigned), fall through
            // to the next 5 dated tasks so the section is still useful.
            const mineDated = allOpenTasks.filter((t) => t.assigneeId === userId && t.dueDate);
            const mineUndated = allOpenTasks.filter((t) => t.assigneeId === userId && !t.dueDate);
            const orphanDated = allOpenTasks.filter((t) => !t.assigneeId && t.dueDate);
            const orphanUndated = allOpenTasks.filter((t) => !t.assigneeId && !t.dueDate);
            const otherDated = allOpenTasks.filter(
              (t) => t.assigneeId && t.assigneeId !== userId && t.dueDate,
            );
            let myTasks = [
              ...mineDated,
              ...mineUndated,
              ...orphanDated,
              ...orphanUndated,
            ].slice(0, 5);
            if (myTasks.length === 0) myTasks = otherDated.slice(0, 5);
            return (
              <section className="bg-surface border border-border-soft rounded-lg p-5 shadow-sm h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-ink-primary">My next tasks</h2>
                  <span className="text-xs text-ink-tertiary">
                    {myTasks.length} of {allOpenTasks.length}
                  </span>
                </div>
                {/* v1.27.2: client island so the checkbox can fire
                    setTaskStatus directly. Pre-fix the box was disabled
                    with a "open Tasks page to toggle" hint. */}
                <TodayTaskList
                  tasks={myTasks.map((t) => ({
                    id: t.id,
                    title: t.title,
                    priority: t.priority,
                    dueDate: t.dueDate,
                  }))}
                />
                <Link
                  href="/tasks"
                  className="block mt-4 pt-3 border-t border-border-soft text-xs text-moss-500 hover:text-moss-700 hover:underline"
                >
                  See all {totalTaskCount} tasks →
                </Link>
              </section>
            );
          })()}

          <TodayEventsCard
            events={upcomingEvents.map((e) => ({
              id: e.id,
              title: e.title,
              startTime: e.startTime,
              location: e.location,
              attendeeIds: e.attendeeIds,
              // v1.27.9: pass through the all-day flag so the card
              // renders "All day" instead of toLocaleTimeString'ing
              // a midnight-UTC timestamp into "01:00".
              allDay: e.allDay,
            }))}
            // v1.30.5: filter "Mine" by attendee user IDs instead of
            // the legacy persona-based role comparison.
            currentUserId={userId}
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
