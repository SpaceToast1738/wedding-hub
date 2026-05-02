"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { EventForm, type GroupOpt, type UserOpt } from "./EventForm";
import { deleteScheduleEvent, updateScheduleEvent } from "./actions";
import { splitDateTime } from "@/lib/format";
import { EventMotifIcon, classifyEventMotif } from "@/components/ui/EventMotifIcon";
import { useConfirm } from "@/components/ui/ConfirmDialog";

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
  users = [],
  groups = [],
  canEdit,
}: {
  events: Event[];
  users?: UserOpt[];
  groups?: GroupOpt[];
  canEdit: boolean;
}) {
  return (
    <div className="bg-surface border border-border-soft rounded-md shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider bg-canvas">
            <th className="px-3 py-2 text-left whitespace-nowrap">When</th>
            <th className="px-3 py-2 text-left">Event</th>
            {/* v1.17.0: Where + Audience hide on small screens; the
                event cell already includes a notes line, so the screen
                isn't useless without these — they reappear at md+. */}
            <th className="px-3 py-2 text-left hidden md:table-cell">Where</th>
            <th className="px-3 py-2 text-left hidden md:table-cell">Attendees</th>
            {canEdit && <th className="px-3 py-2 w-24" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <Row
              key={e.id}
              event={e}
              users={users}
              groups={groups}
              canEdit={canEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  event,
  users = [],
  groups = [],
  canEdit,
}: {
  event: Event;
  users?: UserOpt[];
  groups?: GroupOpt[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function onDelete() {
    if (!(await confirm({ title: `Delete "${event.title}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      await deleteScheduleEvent(event.id);
    });
  }

  if (editing) {
    const { date: startDate, time: startTimeStr } = splitDateTime(event.startTime);
    const { date: endDate, time: endTimeStr } = splitDateTime(event.endTime);
    const initialRefs =
      event.attendeeRefs.length > 0
        ? event.attendeeRefs
        : event.attendeeIds.map((id) => `user:${id}`);
    return (
      <tr className="border-b border-border-soft last:border-b-0">
        <td colSpan={canEdit ? 5 : 4} className="p-4 bg-moss-50/30">
          <EventForm
            users={users}
            groups={groups}
            submitLabel="Save"
            initial={{
              title: event.title,
              startDate,
              startTime: startTimeStr,
              endDate,
              endTime: endTimeStr,
              allDay: event.allDay,
              location: event.location ?? "",
              attendeeRefs: initialRefs,
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
          {event.allDay ? (
            <span>All day</span>
          ) : (
            <>
              {fmtTime(event.startTime)}
              {end && <span className="text-ink-tertiary font-normal"> – {end}</span>}
            </>
          )}
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
        {/* v1.17.0: location echoes here on mobile only (the dedicated
            Where column hides at <md). Hidden at md+ to avoid duplication. */}
        {event.location && (
          <div className="text-[11px] text-ink-tertiary mt-0.5 md:hidden">
            📍 {event.location}
          </div>
        )}
        {event.notes && (
          <p className="text-[11px] text-ink-secondary mt-1 whitespace-pre-wrap">
            {event.notes}
          </p>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-ink-tertiary hidden md:table-cell">
        {event.location ?? "—"}
      </td>
      <td className="px-3 py-2.5 hidden md:table-cell">
        {/* v1.41.0: render polymorphic attendee refs. */}
        {(() => {
          const refs =
            event.attendeeRefs.length > 0
              ? event.attendeeRefs
              : event.attendeeIds.map((id) => `user:${id}`);
          if (refs.length === 0) {
            return <span className="text-xs text-ink-tertiary">—</span>;
          }
          const groupByRef = new Map(groups.map((g) => [g.ref, g]));
          return (
            <div className="flex gap-1 flex-wrap">
              {refs.map((ref) => {
                if (ref.startsWith("user:")) {
                  const id = ref.slice("user:".length);
                  const u = users.find((x) => x.id === id);
                  const label = u?.name ?? u?.email.split("@")[0] ?? id.slice(0, 6);
                  return (
                    <span
                      key={ref}
                      className="text-[10px] px-1.5 py-px rounded-md bg-canvas text-ink-secondary border border-border-soft"
                    >
                      {label}
                    </span>
                  );
                }
                const g = groupByRef.get(ref);
                const label = g?.name ?? ref.split(":").pop() ?? ref;
                return (
                  <span
                    key={ref}
                    className="text-[10px] px-1.5 py-px rounded-md bg-marigold-100 text-marigold-700 border border-marigold-700/30"
                    title={ref}
                  >
                    👥 {label}
                  </span>
                );
              })}
            </div>
          );
        })()}
      </td>
      {canEdit && (
        <td className="px-3 py-2.5">
          {/* v1.17.0: always visible on touch; hover-fade reserved for desktop. */}
          <div className="flex gap-1 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
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
