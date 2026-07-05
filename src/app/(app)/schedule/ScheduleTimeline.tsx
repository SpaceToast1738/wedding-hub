"use client";

import { Fragment } from "react";
import { EventNode } from "./EventNode";
import type { GroupOpt, UserOpt } from "./EventForm";

type Event = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date | null;
  location: string | null;
  attendeeRefs: string[];
  attendeeIds: string[];
  allDay: boolean;
  notes: string | null;
};

// Group events by calendar day (local time). Returns ordered list of
// [dateKey, label, events] tuples. Events without consistent dates still
// produce a sensible header per day.
function groupByDay(events: Event[]): Array<{ key: string; label: string; date: Date; events: Event[] }> {
  const groups = new Map<string, Event[]>();
  for (const e of events) {
    const d = new Date(e.startTime);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }
  return [...groups.entries()].map(([key, evs]) => {
    const first = evs[0]!.startTime;
    const label = first.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return { key, label, date: first, events: evs };
  });
}

// v2.5.0 (design pass #11): relative time anchor for each sticky day
// header — grounds "Friday, 26 September 2026" with how far off it is
// (mirrors the countdown card's framing on the Today page). Kept local
// to this file since src/lib/format.ts sits outside this pass's
// ownership list.
function relativeDayLabel(d: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays < 14) return `${diffDays} days away`;
  if (diffDays < -1 && diffDays > -14) return `${Math.abs(diffDays)} days ago`;
  const weeks = Math.round(diffDays / 7);
  if (weeks >= 0) return `${weeks} week${weeks === 1 ? "" : "s"} away`;
  return `${Math.abs(weeks)} week${Math.abs(weeks) === 1 ? "" : "s"} ago`;
}

export function ScheduleTimeline({
  events,
  users = [],
  groups = [],
  canEdit,
}: {
  events: Event[];
  users?: UserOpt[];
  groups?: GroupOpt[];
  canEdit: boolean;
}) {
  // v1.41.0: renamed local `groups` (day buckets) → `dayBuckets` so
  // the new `groups` prop (attendee group options) doesn't shadow it.
  const dayBuckets = groupByDay(events);

  return (
    <div className="space-y-8">
      {dayBuckets.map((d) => (
        <div key={d.key} className="print-break-avoid">
          <div className="flex items-baseline gap-3 mb-3 sticky top-0 bg-canvas/80 backdrop-blur-sm py-1 z-10">
            <h2 className="font-display text-base text-ink-primary font-semibold">
              {d.label}
            </h2>
            {/* v2.5.0 (design pass #11): relative anchor ("12 weeks
                away") so a sticky header grounds the day, not just
                names it. */}
            <span className="text-[11px] text-ink-tertiary">
              {relativeDayLabel(d.date)} · {d.events.length} {d.events.length === 1 ? "event" : "events"}
            </span>
            <div className="flex-1 border-b border-border-soft" />
          </div>
          {/* Timeline column: vertical hairline connecting nodes.
              v2.5.0 (design pass #3): below sm the spine is the ol's
              own border-l (unchanged mobile-compact layout); at sm+
              EventNode switches to a flex row with a dedicated time
              gutter + icon-on-spine node, so the spine line moves to
              an absolutely-positioned strip aligned under the node
              column's center (time gutter w-20 [80px] + gap-3 [12px] +
              half the node column's w-9 [36px] = 110px from the left
              edge — see EventNode's sm+ layout). The strip is a sibling
              of the `ol`, not a child — `<ol>`'s content model only
              allows `<li>`s. */}
          <div className="relative">
            <div aria-hidden className="hidden sm:block absolute inset-y-1 left-[110px] w-px bg-border-soft" />
            <ol className="relative pl-3 ml-6 border-l border-border-soft sm:pl-0 sm:ml-0 sm:border-l-0">
              {d.events.map((e, i) => (
                <Fragment key={e.id}>
                  <EventNode
                    event={e}
                    users={users}
                    groups={groups}
                    canEdit={canEdit}
                    isLast={i === d.events.length - 1}
                  />
                </Fragment>
              ))}
            </ol>
          </div>
        </div>
      ))}
    </div>
  );
}
