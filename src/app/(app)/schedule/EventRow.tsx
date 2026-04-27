"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { EventForm } from "./EventForm";
import { updateScheduleEvent, deleteScheduleEvent } from "./actions";
import { isoDateTimeForInput } from "@/lib/format";

type Event = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date | null;
  location: string | null;
  audience: string[];
  notes: string | null;
};

export function EventRow({ event, canEditSection }: { event: Event; canEditSection: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const time = event.startTime.toLocaleTimeString("en-GB", {
    hour: "numeric", minute: "2-digit", hour12: true,
  }).toLowerCase();
  const day = event.startTime.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  function onDelete() {
    if (!confirm(`Delete "${event.title}"?`)) return;
    startTransition(async () => {
      await deleteScheduleEvent(event.id);
    });
  }

  if (editing) {
    return (
      <li className="bg-surface border border-moss-100 rounded-md p-4">
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
    <li className="flex gap-4 items-start py-3 px-1 border-b border-border-soft last:border-b-0 group">
      <div className="flex flex-col items-center w-20 flex-shrink-0">
        <div className="text-sm font-semibold text-moss-700">{time}</div>
        <div className="text-[10px] text-ink-tertiary mt-0.5">{day}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-primary">{event.title}</div>
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
      </div>
      {canEditSection && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
            Delete
          </Button>
        </div>
      )}
    </li>
  );
}
