"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { EventForm } from "./EventForm";
import { updateScheduleEvent, deleteScheduleEvent } from "./actions";
import { isoDateTimeForInput } from "@/lib/format";
import { EventMotifIcon, classifyEventMotif } from "@/components/ui/EventMotifIcon";

type Event = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date | null;
  location: string | null;
  audience: string[];
  notes: string | null;
};

export function EventNode({
  event,
  canEdit,
  isLast,
}: {
  event: Event;
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
    return (
      <li className={`relative bg-surface border border-moss-100 rounded-md p-4 mb-3 ${isLast ? "" : ""}`}>
        <EventForm
          submitLabel="Save"
          initial={{
            title: event.title,
            startTime: isoDateTimeForInput(event.startTime),
            endTime: isoDateTimeForInput(event.endTime),
            location: event.location ?? "",
            audience: event.audience,
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
          {start}
          {end && <span className="text-ink-tertiary font-normal"> – {end}</span>}
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
      {event.audience.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {event.audience.map((a) => (
            <span
              key={a}
              className="text-[10px] px-1.5 py-px rounded-md bg-muted text-ink-secondary border border-border-soft capitalize"
            >
              {a}
            </span>
          ))}
        </div>
      )}
      {event.notes && (
        <p className="text-xs text-ink-secondary mt-2 whitespace-pre-wrap">{event.notes}</p>
      )}
    </li>
  );
}
