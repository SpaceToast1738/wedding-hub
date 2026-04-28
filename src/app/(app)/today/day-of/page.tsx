import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/actions";
import { getWeddingSettings } from "@/lib/wedding-settings";
import { ScrollToCurrent } from "./ScrollToCurrent";

type EventStatus = "past" | "now" | "next" | "upcoming";

function classifyEvents<T extends { startTime: Date; endTime: Date | null }>(
  events: T[],
  now: Date,
): Array<T & { status: EventStatus }> {
  // First pass: each event is past / now / upcoming.
  // - "now" = now is between startTime and endTime (or for events without
  //   endTime, "now" if startTime is within the last 30 minutes).
  // - "past" = endTime < now (or startTime + 30 min < now if no endTime).
  // - "upcoming" = startTime > now.
  // Second pass: the first upcoming after the last "now"/"past" becomes "next".
  const classified = events.map((e) => {
    const start = e.startTime;
    const end = e.endTime ?? new Date(start.getTime() + 30 * 60 * 1000);
    if (end <= now) return { ...e, status: "past" as EventStatus };
    if (start <= now && now < end) return { ...e, status: "now" as EventStatus };
    return { ...e, status: "upcoming" as EventStatus };
  });
  const firstUpcomingIdx = classified.findIndex((e) => e.status === "upcoming");
  if (firstUpcomingIdx >= 0) {
    classified[firstUpcomingIdx] = {
      ...classified[firstUpcomingIdx]!,
      status: "next",
    };
  }
  return classified;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function DayOfPage() {
  const user = await requireUser();
  const now = new Date();
  const settings = await getWeddingSettings();
  const wedding = settings.weddingDate;

  // Window: same calendar day as the wedding date, in local time. We display
  // events that start between 00:00 and 23:59 of that day. Outside the window
  // we still render the page (preview / drill-day) but show a banner.
  const dayStart = new Date(wedding.getFullYear(), wedding.getMonth(), wedding.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(wedding.getFullYear(), wedding.getMonth(), wedding.getDate(), 23, 59, 59, 999);

  const [eventsRaw, suppliers, dietaryRows] = await Promise.all([
    db.scheduleEvent.findMany({
      where: { startTime: { gte: dayStart, lte: dayEnd } },
      orderBy: { startTime: "asc" },
    }),
    // On-call day-of contacts: suppliers we've actually engaged with. Pull
    // their primary contact (or first contact) with a phone number.
    db.supplier.findMany({
      where: { status: { in: ["BOOKED", "PAID"] } },
      include: {
        contacts: {
          where: { phone: { not: null } },
          orderBy: [{ primary: "desc" }],
          take: 1,
        },
      },
      orderBy: { category: "asc" },
    }),
    db.guest.findMany({
      where: { rsvp: "ATTENDING", archived: false },
      select: {
        isChild: true,
        needsHighchair: true,
        childrenMeal: true,
        dietary: true,
      },
    }),
  ]);

  const events = classifyEvents(eventsRaw, now);
  // B7 (v1.13.0): pick the most-relevant event to scroll into view —
  // prefer `now`, fall back to `next`. Null when neither exists (e.g.
  // we're on the day-of preview before the wedding day, or the day
  // has fully elapsed).
  const scrollTargetEvent =
    events.find((e) => e.status === "now") ?? events.find((e) => e.status === "next");
  const scrollTargetId = scrollTargetEvent ? `event-${scrollTargetEvent.id}` : null;
  const isWeddingDay =
    now.getFullYear() === wedding.getFullYear() &&
    now.getMonth() === wedding.getMonth() &&
    now.getDate() === wedding.getDate();

  // Catering aggregates — same numbers shown on /guests/catering, simplified.
  const totalAttending = dietaryRows.length;
  const adults = dietaryRows.filter((g) => !g.isChild).length;
  const children = dietaryRows.filter((g) => g.isChild).length;
  const childrenMeals = dietaryRows.filter((g) => g.childrenMeal).length;
  const highchairs = dietaryRows.filter((g) => g.needsHighchair).length;
  const dietaryCount = new Map<string, number>();
  for (const g of dietaryRows) {
    for (const d of g.dietary) {
      const k = d.trim();
      if (!k) continue;
      dietaryCount.set(k, (dietaryCount.get(k) ?? 0) + 1);
    }
  }
  const dietaryEntries = [...dietaryCount.entries()].sort((a, b) => b[1] - a[1]);

  const weddingDateLabel = wedding.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Day-of contact entries: only suppliers that have an actual phone number.
  const contacts = suppliers
    .map((s) => ({
      supplier: s,
      contact: s.contacts[0] ?? null,
    }))
    .filter((row) => row.contact?.phone);

  return (
    <div className="flex-1 overflow-auto bg-moss-50 p-4 sm:p-6">
      <div className="max-w-[1100px] mx-auto">
        {/* Hero band — v1.17.0: sticky at the top on mobile so the
            venue + date stay visible while scrolling the timeline.
            Desktop has plenty of vertical space; sticky everywhere
            would just eat real estate, so it's mobile-only. */}
        <div className="bg-moss-700 text-white rounded-lg px-6 py-5 mb-4 flex items-center justify-between gap-3 flex-wrap sticky top-0 z-10 sm:static">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">
              Day of · {weddingDateLabel}
            </div>
            <div className="font-display text-3xl font-semibold mt-1">
              {isWeddingDay ? "Today is the day." : "Day-of preview"}
            </div>
            <div className="text-xs opacity-85 mt-1">
              {settings.venue}
              {user.name ? ` · Logged in as ${user.name}` : ""}
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-sm border border-white/30 bg-transparent text-white hover:bg-white/10"
          >
            ← Exit day-of mode
          </Link>
        </div>

        {!isWeddingDay && (
          <div className="bg-marigold-100 border border-marigold-700/20 text-marigold-700 rounded-md px-4 py-2.5 text-xs mb-4">
            <strong>Preview mode.</strong> Today isn&apos;t the wedding day yet ({weddingDateLabel}). The
            timeline still classifies items by current time so you can see what the day will look like.
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-3">
          {/* Live timeline (spans 2 cols on lg) */}
          <section className="lg:col-span-2 bg-surface border border-border-soft rounded-md p-5">
            <h2 className="text-sm font-semibold text-ink-primary mb-3">Live timeline</h2>
            {events.length === 0 ? (
              <p className="text-sm text-ink-tertiary italic py-4 text-center">
                No events scheduled for the wedding day. Add them on the Schedule page.
              </p>
            ) : (
              <ul className="space-y-1">
                {events.map((ev) => (
                  <li
                    key={ev.id}
                    // B7: scroll target. The first event with a `now` or
                    // `next` status carries the id; ScrollToCurrent picks
                    // it up and scrolls on mount.
                    id={ev.status === "now" || ev.status === "next" ? `event-${ev.id}` : undefined}
                    className={[
                      "flex gap-3 px-3 py-2.5 rounded-sm border-l-[3px]",
                      ev.status === "now"
                        ? "bg-marigold-100 border-marigold-500"
                        : ev.status === "next"
                          ? "bg-moss-50 border-moss-500"
                          : "border-transparent",
                      ev.status === "past" ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "font-display text-base font-semibold w-14 flex-shrink-0 tabular-nums",
                        ev.status === "now" ? "text-marigold-700" : "text-ink-primary",
                      ].join(" ")}
                    >
                      {formatTime(ev.startTime)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={[
                          "text-sm font-medium",
                          ev.status === "past" ? "text-ink-secondary line-through" : "text-ink-primary",
                        ].join(" ")}
                      >
                        {ev.title}
                      </div>
                      {(ev.location || ev.audience.length > 0) && (
                        <div className="text-[11px] text-ink-tertiary mt-0.5">
                          {ev.location && <>{ev.location}</>}
                          {ev.location && ev.audience.length > 0 && " · "}
                          {ev.audience.length > 0 && <>{ev.audience.join(", ")}</>}
                        </div>
                      )}
                    </div>
                    {ev.status === "now" && (
                      <span className="text-[10px] font-bold text-marigold-700 bg-surface px-2 py-0.5 rounded self-start">
                        NOW
                      </span>
                    )}
                    {ev.status === "next" && (
                      <span className="text-[10px] font-bold text-moss-700 bg-surface px-2 py-0.5 rounded self-start">
                        NEXT
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <ScrollToCurrent targetId={scrollTargetId} />
          </section>

          {/* Day-of contacts */}
          <section className="bg-surface border border-border-soft rounded-md p-5">
            <h2 className="text-sm font-semibold text-ink-primary mb-3">Day-of contacts</h2>
            {contacts.length === 0 ? (
              <p className="text-sm text-ink-tertiary italic py-2">
                No booked suppliers with phone numbers yet. Add them on the Suppliers page.
              </p>
            ) : (
              <ul className="divide-y divide-border-soft">
                {contacts.map((row) => (
                  <li key={row.supplier.id}>
                    <a
                      href={`tel:${row.contact!.phone}`}
                      className="flex items-center gap-2.5 py-2.5 hover:bg-canvas/50 -mx-2 px-2 rounded-sm"
                    >
                      <span className="w-9 h-9 rounded-full bg-moss-100 text-moss-700 flex items-center justify-center text-sm flex-shrink-0">
                        ☎
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-ink-primary truncate">
                          {row.contact!.name}
                        </div>
                        <div className="text-[11px] text-ink-tertiary truncate">
                          {row.supplier.name} · {row.supplier.category}
                        </div>
                      </div>
                      <span className="text-xs text-moss-700 font-medium tabular-nums">
                        {row.contact!.phone}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Catering at a glance */}
          <section className="bg-surface border border-border-soft rounded-md p-5">
            <h2 className="text-sm font-semibold text-ink-primary mb-3">Catering today</h2>
            <ul className="text-sm space-y-1.5">
              <Stat label="Attending" value={`${totalAttending}`} />
              <Stat label="Adults" value={`${adults}`} />
              <Stat label="Children" value={`${children}`} />
              <Stat label="Children's meals" value={`${childrenMeals}`} />
              <Stat label="Highchairs" value={`${highchairs}`} />
              {dietaryEntries.slice(0, 4).map(([k, v]) => (
                <Stat key={k} label={k} value={`${v}`} />
              ))}
            </ul>
            <Link
              href="/guests/catering"
              className="inline-block mt-3 text-xs text-info hover:underline"
            >
              Full catering brief →
            </Link>
          </section>

          {/* Quick links */}
          <section className="bg-surface border border-border-soft rounded-md p-5">
            <h2 className="text-sm font-semibold text-ink-primary mb-3">Open quickly</h2>
            <div className="flex flex-col gap-1.5">
              <QuickLink href="/book/photography" label="◧ Shot list" />
              <QuickLink href="/seating" label="⊛ Seating chart" />
              <QuickLink href="/schedule" label="◷ Full schedule" />
              <QuickLink href="/guests" label="◎ Guest list" />
              <QuickLink href="/songs" label="♪ Songs & playlists" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between items-baseline gap-3 py-1 border-b border-border-soft last:border-b-0">
      <span className="text-xs text-ink-secondary">{label}</span>
      <span className="text-sm font-semibold text-ink-primary tabular-nums">{value}</span>
    </li>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-left px-3 py-2 border border-border-soft rounded-sm bg-surface text-ink-primary text-sm hover:border-moss-300 hover:text-moss-700"
    >
      {label}
    </Link>
  );
}
