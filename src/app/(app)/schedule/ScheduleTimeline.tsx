"use client";

import { Fragment } from "react";
import { EventNode } from "./EventNode";
import type { UserOpt } from "./EventForm";

type Event = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date | null;
  location: string | null;
  attendeeIds: string[];
  allDay: boolean;
  notes: string | null;
};

// Group events by calendar day (local time). Returns ordered list of
// [dateKey, label, events] tuples. Events without consistent dates still
// produce a sensible header per day.
function groupByDay(events: Event[]): Array<{ key: string; label: string; events: Event[] }> {
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
    return { key, label, events: evs };
  });
}

export function ScheduleTimeline({
  events,
  users = [],
  canEdit,
}: {
  events: Event[];
  users?: UserOpt[];
  canEdit: boolean;
}) {
  const groups = groupByDay(events);

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <div key={g.key} className="print-break-avoid">
          <div className="flex items-baseline gap-3 mb-3 sticky top-0 bg-canvas/80 backdrop-blur-sm py-1 z-10">
            <h2 className="font-display text-base text-ink-primary font-semibold">
              {g.label}
            </h2>
            <span className="text-[11px] text-ink-tertiary">
              {g.events.length} {g.events.length === 1 ? "event" : "events"}
            </span>
            <div className="flex-1 border-b border-border-soft" />
          </div>
          {/* Timeline column: vertical hairline connecting nodes. */}
          <ol className="relative pl-3 ml-6 border-l border-border-soft">
            {g.events.map((e, i) => (
              <Fragment key={e.id}>
                <EventNode event={e} users={users} canEdit={canEdit} isLast={i === g.events.length - 1} />
              </Fragment>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
