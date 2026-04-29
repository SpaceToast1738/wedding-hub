"use client";

import { useEffect, useState } from "react";
import { ScheduleTimeline } from "./ScheduleTimeline";
import { ScheduleTable } from "./ScheduleTable";
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

type View = "timeline" | "table";
const VIEW_KEY = "wh_schedule_view";

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
  canEdit,
}: {
  events: Event[];
  users?: UserOpt[];
  canEdit: boolean;
}) {
  const [view, setView] = useState<View>("timeline");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "timeline" || saved === "table") setView(saved);
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

  return (
    <>
      <div className="flex justify-end mb-4 no-print">
        <div className="flex gap-px bg-canvas border border-border-soft rounded-full p-0.5">
          {(["timeline", "table"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={[
                "text-[10px] px-2.5 py-0.5 rounded-full font-semibold transition-colors uppercase",
                view === v
                  ? "bg-moss-500 text-white"
                  : "text-ink-tertiary hover:text-ink-primary",
              ].join(" ")}
              aria-pressed={view === v}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "table" ? (
        <ScheduleTable events={events} users={users} canEdit={canEdit} />
      ) : (
        <ScheduleTimeline events={events} users={users} canEdit={canEdit} />
      )}
    </>
  );
}
