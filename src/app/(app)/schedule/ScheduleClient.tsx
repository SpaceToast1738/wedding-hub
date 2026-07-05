"use client";

import { useEffect, useMemo, useState } from "react";
import { ScheduleTimeline } from "./ScheduleTimeline";
import { ScheduleTable } from "./ScheduleTable";
import type { UserOpt, GroupOpt } from "./EventForm";
import { Tag } from "@/components/ui/Tag";
import { EmptyState, EmptySchedule } from "@/components/ui/Illustrations";

type Event = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date | null;
  location: string | null;
  // v1.41.0: polymorphic attendee refs replace the v1.27.1 user-id
  // array. Legacy attendeeIds carries through one release as a
  // recoverability buffer; renderers expand to refs at read time.
  attendeeRefs: string[];
  attendeeIds: string[];
  allDay: boolean;
  notes: string | null;
};

type View = "timeline" | "table";
const VIEW_KEY = "wh_schedule_view";
// v2.5.0 (design pass #2): persisted alongside VIEW_KEY — same
// localStorage mechanism, sibling key so either preference can change
// independently.
const FILTER_KEY = "wh_schedule_filter";
const ALL_FILTER = "all";

// v2.5.0 (design pass #2): does this event belong to the selected
// persona/attendee filter? Direct ref match, with one exception — an
// event tagged "builtin:everyone" always shows regardless of which
// persona is selected, mirroring the prototype's "Everyone" passthrough
// (a filter shouldn't hide the ceremony just because that persona
// wasn't named explicitly).
function eventMatchesFilter(event: Event, filterRef: string): boolean {
  if (filterRef === ALL_FILTER) return true;
  const refs =
    event.attendeeRefs.length > 0
      ? event.attendeeRefs
      : event.attendeeIds.map((id) => `user:${id}`);
  if (refs.length === 0) return false;
  if (refs.includes("builtin:everyone")) return true;
  return refs.includes(filterRef);
}

// Client wrapper that holds the timeline-vs-table view choice and
// persists it to localStorage. Mirrors the seating Canvas | List
// pattern at src/app/(app)/seating/SeatingClient.tsx.
//
// SSR renders the timeline (server-default) so initial markup is
// stable; we swap to the persisted choice on mount, keeping the
// switch flicker-free for return visits.
export function ScheduleClient({
  events,
  users = [],
  groups = [],
  canEdit,
  currentUserId,
}: {
  events: Event[];
  users?: UserOpt[];
  groups?: GroupOpt[];
  canEdit: boolean;
  /** v2.5.0 (design pass #2): powers the "Me" persona pill. */
  currentUserId?: string;
}) {
  const [view, setView] = useState<View>("timeline");
  const [filterRef, setFilterRef] = useState<string>(ALL_FILTER);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "timeline" || saved === "table") setView(saved);
      const savedFilter = localStorage.getItem(FILTER_KEY);
      if (savedFilter) setFilterRef(savedFilter);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, filterRef);
    } catch {
      // ignore
    }
  }, [filterRef]);

  // v2.5.0 (design pass #2): persona/view filter pills — All, each
  // group option, plus "Me". Ported from the prototype's filter row
  // (never built in production), adapted from fake persona strings to
  // the real attendeeRefs model.
  const filterPills = useMemo(() => {
    const pills = [{ ref: ALL_FILTER, label: "All" }, ...groups.map((g) => ({ ref: g.ref, label: g.name }))];
    if (currentUserId) pills.push({ ref: `user:${currentUserId}`, label: "Me" });
    return pills;
  }, [groups, currentUserId]);

  const filteredEvents = useMemo(
    () => events.filter((e) => eventMatchesFilter(e, filterRef)),
    [events, filterRef],
  );

  return (
    <>
      {/* v2.5.0 (design pass #2): persona/view filter pills — never
          built in production despite existing in the prototype and
          the attendee data (attendeeRefs, groupOpts) being available
          all along. Own row, horizontally scrollable, so a long
          persona list degrades to a swipeable strip on narrow screens
          instead of wrapping into a tall block. */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 mb-3 no-print">
        {filterPills.map((p) => (
          <Tag
            key={p.ref}
            label={p.label}
            active={filterRef === p.ref}
            onClick={() => setFilterRef(p.ref)}
          />
        ))}
      </div>

      <div className="flex justify-end mb-4 no-print">
        <div className="flex gap-px bg-canvas border border-border-soft rounded-full p-0.5">
          {(["timeline", "table"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={[
                // v2.5.0 (design pass #6): text-[10px] → text-xs and a
                // min-h floor so the toggle reaches a real touch
                // target (was ~20px tall); ink-tertiary → ink-secondary
                // for the inactive label, matching the AA pass on
                // ink-tertiary elsewhere in this release.
                "text-xs px-3 py-1.5 min-h-[38px] rounded-full font-semibold transition-colors uppercase",
                view === v
                  ? "bg-moss-500 text-on-moss"
                  : "text-ink-secondary hover:text-ink-primary",
              ].join(" ")}
              aria-pressed={view === v}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <EmptyState
          illustration={EmptySchedule}
          title="No events in this view"
          body="Try a different filter to see schedule events."
        />
      ) : view === "table" ? (
        <ScheduleTable
          events={filteredEvents}
          users={users}
          groups={groups}
          canEdit={canEdit}
        />
      ) : (
        <ScheduleTimeline
          events={filteredEvents}
          users={users}
          groups={groups}
          canEdit={canEdit}
        />
      )}
    </>
  );
}
