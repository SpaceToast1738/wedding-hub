import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getWeddingSettings } from "@/lib/wedding-settings";
import { oldestOpenDecisions } from "@/lib/today-widgets";
import { isAttendee, resolveAttendeeRefs } from "@/lib/group-members";
import { CountdownCard } from "./CountdownCard";
import { TodayEventsCard } from "./TodayEventsCard";
import { TodayTaskList } from "./TodayTaskList";
import { TodayCrossModuleStrip } from "./TodayCrossModuleStrip";
import { RecentActivityFeed } from "./RecentActivityFeed";

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const userId = session.user.id;
  const isCouple = session.user.isCouple === true;
  const wedding = await getWeddingSettings();

  // v1.37.5 (P7b/C): cross-module widgets — open DECISIONs.
  // v1.93.0: OUTFIT milestones widget retired (dates moved to Tasks).
  // v2.0.0: LEGAL deadlines widget retired (LEGAL kind dropped).
  // Fetch alongside the existing queries so the page does its work
  // in one round-trip.
  const [
    allOpenTasks,
    totalTaskCount,
    guestStats,
    dietaryRows,
    upcomingEvents,
    allUsers,
    customUserGroups,
    decisionTaskRows,
  ] = await Promise.all([
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
      // v1.57.0 (XL10): include topic relations so the Today list
      // surfaces "Wedding Book — Ceremony" / "#guests" chips next to
      // each task title. The bare title doesn't tell the daily-glance
      // user which area of the wedding the task belongs to.
      include: {
        bookSections: { select: { title: true } },
        bookSubsections: { select: { title: true } },
        navTags: { select: { name: true } },
        // v1.96.0: multi-assignee — include the assignees relation so
        // the "My next tasks" filter can match against any of them.
        assignees: { select: { id: true } },
      },
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
    // v1.41.0: users + custom groups for resolving the polymorphic
    // attendee refs. Cheap reads (small tables); skipping
    // conditionally would just add branching for marginal savings.
    db.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        role: true,
        isCouple: true,
      },
    }),
    db.permissionGroup.findMany({
      include: { members: { select: { id: true } } },
    }),
    // v1.93.0: dropped OUTFIT-cards query — the Today "Fittings &
    // pickups" widget is retired. Fitting / alterations / pickup are
    // tracked as Tasks now.
    // v2.0.0: dropped bookLegalCard query — the Today "LEGAL
    // deadlines" widget is retired with the LEGAL kind.
    // DECISION-type tasks — non-closed.
    db.task.findMany({
      where: {
        type: "DECISION",
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 20, // helper caps + sorts; this is just a generous cap on the fetch
    }),
  ]);

  // v1.39.1 (backlog #2): recent-activity feed — couple-only,
  // last 10 audit rows. The full searchable log lives at /settings.
  // Cheap query (indexed on createdAt; AuditLog has 30-day retention).
  // Skipped entirely for non-couple users so the table isn't even
  // touched for them.
  const recentAudits = isCouple
    ? await db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { name: true, email: true } } },
      })
    : [];
  const auditTotalCount = isCouple ? await db.auditLog.count() : 0;

  // v1.93.0: OUTFIT milestone widget retired (dates moved to Tasks).
  // v2.0.0: LEGAL deadlines widget retired (LEGAL kind dropped).
  const decisions = oldestOpenDecisions(
    decisionTaskRows.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
    })),
    5,
  );

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
    <div className="flex-1 overflow-auto p-4 sm:p-6">
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
            // v1.96.0: multi-assignee. "Assigned to me" = userId is
            // in the task's assignees list. "Unassigned" = empty list.
            const isMine = (t: { assignees: { id: string }[] }) =>
              t.assignees.some((a) => a.id === userId);
            const isOrphan = (t: { assignees: { id: string }[] }) =>
              t.assignees.length === 0;
            const mineDated = allOpenTasks.filter((t) => isMine(t) && t.dueDate);
            const mineUndated = allOpenTasks.filter((t) => isMine(t) && !t.dueDate);
            const orphanDated = allOpenTasks.filter((t) => isOrphan(t) && t.dueDate);
            const orphanUndated = allOpenTasks.filter((t) => isOrphan(t) && !t.dueDate);
            const otherDated = allOpenTasks.filter(
              (t) => !isMine(t) && !isOrphan(t) && t.dueDate,
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
                    // v1.57.0 (XL10): flatten topic-relation labels
                    // for the inline chip strip. Cards (subsections)
                    // are more specific than sections, so we render
                    // those first; sections + nav tags fill the rest.
                    topics: [
                      ...t.bookSubsections.map((s) => s.title),
                      ...t.bookSections.map((s) => s.title),
                      ...t.navTags.map((n) => `#${n.name}`),
                    ],
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
            events={upcomingEvents.map((e) => {
              // v1.41.0: precompute isMine + attendeeCount server-
              // side. Group refs need access to the full user list
              // and custom groups; we have both here. Empty refs +
              // empty legacy ids both treated as "everyone" (so the
              // user is implicitly an attendee of an unfiltered
              // event).
              const refs =
                e.attendeeRefs.length > 0
                  ? e.attendeeRefs
                  : e.attendeeIds.map((id) => `user:${id}`);
              const noFilter = refs.length === 0;
              const resolved = resolveAttendeeRefs(e, allUsers, customUserGroups);
              return {
                id: e.id,
                title: e.title,
                startTime: e.startTime,
                location: e.location,
                isMine: noFilter || isAttendee(e, userId, allUsers, customUserGroups),
                attendeeCount: resolved.length,
                allDay: e.allDay,
              };
            })}
          />
        </div>

        {/* v1.37.5 (P7b/C): cross-module strip — Wedding Book
            roll-ups. v1.93.0 retired the outfit-milestones widget;
            v2.0.0 retired the legal-deadlines widget. Only the open-
            decisions roll-up remains. Strip auto-hides when empty. */}
        <TodayCrossModuleStrip decisions={decisions} />

        {/* v1.39.1: recent-activity feed (couple-only). Reads the
            last 10 audit-log rows and renders them as human sentences
            via formatAuditAction. Auto-hides for non-couple users
            and on a freshly-seeded prod with empty audit log. */}
        {isCouple && (
          <div className="mb-4">
            <RecentActivityFeed
              isCouple={isCouple}
              totalCount={auditTotalCount}
              rows={recentAudits.map((r) => ({
                id: r.id,
                action: r.action,
                entity: r.entity,
                metadata:
                  r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
                    ? (r.metadata as Record<string, unknown>)
                    : null,
                createdAt: r.createdAt,
                userName: r.user?.name ?? null,
                userEmail: r.user?.email ?? null,
              }))}
            />
          </div>
        )}

        {/* RSVP / catering snapshot strip.
            v1.60.0 (P4): label and bits are sibling rows now (label
            shrink-0, bits in their own flex-wrap container). Pre-fix
            the label was inline with the bits — at ~1280px viewport
            the label could land on its own line with one orphaned
            bit, then the rest wrap to row two. Now the label always
            stays put and the bits wrap as a coherent group below it
            on narrow screens, beside it on wide. */}
        <div className="bg-surface border border-border-soft rounded-md px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1.5">
          <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider flex-shrink-0">
            Snapshot
          </div>
          <div className="flex items-center gap-x-5 gap-y-1 flex-wrap min-w-0">
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
