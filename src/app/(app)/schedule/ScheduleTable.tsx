"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { EventForm } from "./EventForm";
import { deleteScheduleEvent, updateScheduleEvent } from "./actions";
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

// Flat sortable table view of the same data the ScheduleTimeline
// shows. Useful when there are 20+ events and the vertical timeline
// becomes long to scroll. Inline edit reuses EventForm so the
// data model is unchanged.

function fmtTime(d: Date): string {
  return d
    .toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function ScheduleTable({
  events,
  canEdit,
}: {
  events: Event[];
  canEdit: boolean;
}) {
  return (
    <div className="bg-surface border border-border-soft rounded-md shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider bg-canvas">
            <th className="px-3 py-2 text-left whitespace-nowrap">When</th>
            <th className="px-3 py-2 text-left">Event</th>
            <th className="px-3 py-2 text-left">Where</th>
            <th className="px-3 py-2 text-left">Audience</th>
            {canEdit && <th className="px-3 py-2 w-24" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <Row key={e.id} event={e} canEdit={canEdit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ event, canEdit }: { event: Event; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Delete "${event.title}"?`)) return;
    startTransition(async () => {
      await deleteScheduleEvent(event.id);
    });
  }

  if (editing) {
    return (
      <tr className="border-b border-border-soft last:border-b-0">
        <td colSpan={canEdit ? 5 : 4} className="p-4 bg-moss-50/30">
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
        </td>
      </tr>
    );
  }

  const end = event.endTime ? fmtTime(event.endTime) : null;

  return (
    <tr className="border-b border-border-soft last:border-b-0 hover:bg-muted/30 group align-top">
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="text-sm font-semibold text-moss-700 tabular-nums">
          {fmtTime(event.startTime)}
          {end && <span className="text-ink-tertiary font-normal"> – {end}</span>}
        </div>
        <div className="text-[10px] text-ink-tertiary mt-0.5">
          {fmtDay(event.startTime)}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-sm text-ink-primary font-medium flex items-center gap-1.5">
          <EventMotifIcon motif={classifyEventMotif(event.title)} />
          <span>{event.title}</span>
        </div>
        {event.notes && (
          <p className="text-[11px] text-ink-secondary mt-1 whitespace-pre-wrap">
            {event.notes}
          </p>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-ink-tertiary">
        {event.location ?? "—"}
      </td>
      <td className="px-3 py-2.5">
        {event.audience.length === 0 ? (
          <span className="text-xs text-ink-tertiary">—</span>
        ) : (
          <div className="flex gap-1 flex-wrap">
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
      </td>
      {canEdit && (
        <td className="px-3 py-2.5">
          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
              ×
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}
