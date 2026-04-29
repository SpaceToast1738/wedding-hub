"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { EventForm, type UserOpt } from "./EventForm";
import { updateScheduleEvent, deleteScheduleEvent } from "./actions";
import { splitDateTime } from "@/lib/format";
import { EventMotifIcon, classifyEventMotif } from "@/components/ui/EventMotifIcon";

type Event = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date | null;
  location: string | null;
  // v1.27.1: User-IDs of who should attend / be aware of this event.
  attendeeIds: string[];
  // v1.27.1: when true the time component is ignored on render.
  allDay: boolean;
  notes: string | null;
};

export function EventNode({
  event,
  users = [],
  canEdit,
  isLast,
}: {
  event: Event;
  users?: UserOpt[];
  canEdit: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Delete "${event.title}"?`)) return;
    startTransition(async () => {
      await deleteScheduleEvent(event.id);
    });
  }

  const start = event.startTime.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase();
  const end = event.endTime
    ? event.endTime.toLocaleTimeString("en-GB", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).toLowerCase()
    : null;

  if (editing) {
    const { date: startDate, time: startTimeStr } = splitDateTime(event.startTime);
    const { date: endDate, time: endTimeStr } = splitDateTime(event.endTime);
    return (
      <li className={`relative bg-surface border border-moss-100 rounded-md p-4 mb-3 ${isLast ? "" : ""}`}>
        <EventForm
          users={users}
          submitLabel="Save"
          initial={{
            title: event.title,
            startDate,
            startTime: startTimeStr,
            endDate,
            endTime: endTimeStr,
            allDay: event.allDay,
            location: event.location ?? "",
            attendeeIds: event.attendeeIds,
            notes: event.notes ?? "",
          }}
          onSubmit={async (fd) => {
            await updateScheduleEvent(event.id, fd);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className={`relative pl-5 ${isLast ? "pb-1" : "pb-5"} group`}>
      {/* Node circle on the spine — sits on the left border of the parent ol. */}
      <span
        aria-hidden
        className="absolute left-[-21px] top-1.5 w-3 h-3 rounded-full bg-moss-500 border-[3px] border-canvas shadow-sm"
      />
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="text-sm font-semibold text-moss-700 tabular-nums">
          {event.allDay ? (
            <span>All day</span>
          ) : (
            <>
              {start}
              {end && <span className="text-ink-tertiary font-normal"> – {end}</span>}
            </>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity no-print">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
              Delete
            </Button>
          </div>
        )}
      </div>
      <div className="text-sm font-medium text-ink-primary mt-0.5 flex items-center gap-1.5">
        {/* C11 (v1.14.0): per-event motif icon. Heuristic match on
            title — pure no-icon when nothing fits. */}
        <EventMotifIcon motif={classifyEventMotif(event.title)} />
        <span>{event.title}</span>
      </div>
      {event.location && (
        <div className="text-xs text-ink-tertiary mt-0.5">📍 {event.location}</div>
      )}
      {/* v1.30.5: legacy persona-`audience` fallback removed (column
          dropped this release). Render attendees only. */}
      {event.attendeeIds.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {event.attendeeIds.map((id) => {
            const u = users.find((x) => x.id === id);
            const label = u?.name ?? u?.email.split("@")[0] ?? id.slice(0, 6);
            return (
              <span
                key={id}
                className="text-[10px] px-1.5 py-px rounded-md bg-canvas text-ink-secondary border border-border-soft"
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
      {event.notes && (
        <p className="text-xs text-ink-secondary mt-2 whitespace-pre-wrap">{event.notes}</p>
      )}
    </li>
  );
}
