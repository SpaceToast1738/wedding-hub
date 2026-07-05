"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { EventForm, type GroupOpt, type UserOpt } from "./EventForm";
import { updateScheduleEvent, deleteScheduleEvent } from "./actions";
import { splitDateTime } from "@/lib/format";
import { EventMotifIcon, classifyEventMotif } from "@/components/ui/EventMotifIcon";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/notify";

// v2.5.0 (design pass #9): "everyone" is the only ref that represents
// the whole audience — every other ref (a role/custom group, or a
// named individual) is by definition a partial slice of it. Moss
// tints the former, marigold the latter, matching the prototype's
// `p === 'Everyone' ? moss : marigold` convention. Previously every
// group ref (including "everyone") was marigold and individuals were
// an undifferentiated neutral — backwards from the prototype.
function attendeeChipClasses(ref: string): string {
  return ref === "builtin:everyone"
    ? "bg-moss-50 text-moss-700 border-moss-100"
    : "bg-marigold-100 text-marigold-700 border-marigold-200";
}

type Event = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date | null;
  location: string | null;
  // v1.41.0: polymorphic refs replace the v1.27.1 user-id array.
  // Legacy attendeeIds passed through one release as a buffer.
  attendeeRefs: string[];
  attendeeIds: string[];
  // v1.27.1: when true the time component is ignored on render.
  allDay: boolean;
  notes: string | null;
};

export function EventNode({
  event,
  users = [],
  groups = [],
  canEdit,
  isLast,
}: {
  event: Event;
  users?: UserOpt[];
  groups?: GroupOpt[];
  canEdit: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function onDelete() {
    if (!(await confirm({ title: `Delete "${event.title}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      // v2.5.0 (design pass #5): app-wide notify() convention — this
      // flow previously left success/failure silent.
      try {
        await deleteScheduleEvent(event.id);
        notify("success", "Event deleted");
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Failed to delete event");
      }
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
    // v1.41.0: prefer attendeeRefs; fall back to legacy attendeeIds
    // expanded as user:<id> for events that haven't been re-saved
    // since the migration.
    const initialRefs =
      event.attendeeRefs.length > 0
        ? event.attendeeRefs
        : event.attendeeIds.map((id) => `user:${id}`);
    return (
      <li className={`relative bg-surface border border-moss-100 rounded-md p-4 mb-3 ${isLast ? "" : ""}`}>
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
            // v2.5.0 (design pass #5): app-wide notify() convention —
            // this flow previously left success/failure silent.
            try {
              await updateScheduleEvent(event.id, fd);
              notify("success", "Event updated");
              setEditing(false);
            } catch (err) {
              notify("error", err instanceof Error ? err.message : "Failed to update event");
              throw err;
            }
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  const motif = classifyEventMotif(event.title);
  // v2.5.0 (design pass #10): a rough length heuristic for whether the
  // note actually overflows a 2-line clamp — avoids showing a pointless
  // "Show more" toggle under a note that's already short enough to fit.
  const notesClampable = !!event.notes && event.notes.length > 120;

  return (
    <li className={`relative ${isLast ? "pb-1" : "pb-5"} group`}>
      {/* Mobile (<640px): compact stacked layout — a small dot on the
          ol's border-l spine, time inline above the title. */}
      {/* sm+ (design pass #3): right-aligned time gutter + a larger
          motif icon riding the spine, content to the right — see the
          flex row below. The mobile dot/indent stay exactly as before. */}
      <span
        aria-hidden
        className="absolute left-[-21px] top-1.5 w-3 h-3 rounded-full bg-moss-500 border-[3px] border-canvas shadow-sm sm:hidden"
      />
      <div className="flex gap-0 sm:gap-3 pl-5 sm:pl-0">
        {/* Time gutter — sm+ only; mobile keeps the time inline in the
            content column below (rendered further down). */}
        <div className="hidden sm:block w-20 flex-shrink-0 pt-1 text-right">
          <div className="text-sm font-semibold text-moss-700 tabular-nums whitespace-nowrap">
            {event.allDay ? "All day" : start}
          </div>
          {!event.allDay && end && (
            <div className="text-[11px] text-ink-tertiary tabular-nums whitespace-nowrap">– {end}</div>
          )}
        </div>

        {/* Node: icon-on-spine circle, sm+ only (mobile uses the plain
            dot above, positioned on the ol's border-l). */}
        <div className="hidden sm:flex w-9 flex-shrink-0 justify-center pt-0.5">
          <div className="w-8 h-8 rounded-full bg-surface border-[1.5px] border-border-soft shadow-sm flex items-center justify-center z-10">
            <EventMotifIcon motif={motif} size={16} />
          </div>
        </div>

        {/* Content column. */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between sm:justify-end gap-3 flex-wrap">
            <div className="text-sm font-semibold text-moss-700 tabular-nums sm:hidden">
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
              // v2.5.0 (design pass #1): mobile-safe hover pattern —
              // was `opacity-0 group-hover:opacity-100` with no `sm:`
              // scoping, so the controls were simply invisible on
              // touch (no hover state to reveal them). Mirrors the
              // pattern already used in ScheduleTable.
              <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity no-print">
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
                title — pure no-icon when nothing fits. Repeated inline
                on mobile since the spine node (which carries it at
                sm+) is hidden there. */}
            <span className="sm:hidden"><EventMotifIcon motif={motif} /></span>
            <span>{event.title}</span>
          </div>
          {event.location && (
            <div className="text-xs text-ink-tertiary mt-0.5">📍 {event.location}</div>
          )}
          {/* v1.41.0: render polymorphic attendee refs. Group refs render
              as marigold-tinted chips with the group name; user refs
              resolve through the users prop. Legacy attendeeIds expanded
              for events that pre-date the migration. */}
          {(() => {
            const refs =
              event.attendeeRefs.length > 0
                ? event.attendeeRefs
                : event.attendeeIds.map((id) => `user:${id}`);
            if (refs.length === 0) return null;
            const groupByRef = new Map(groups.map((g) => [g.ref, g]));
            return (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {refs.map((ref) => {
                  if (ref.startsWith("user:")) {
                    const id = ref.slice("user:".length);
                    const u = users.find((x) => x.id === id);
                    const label = u?.name ?? u?.email.split("@")[0] ?? id.slice(0, 6);
                    return (
                      <span
                        key={ref}
                        className={`text-[11px] px-1.5 py-px rounded-md border ${attendeeChipClasses(ref)}`}
                      >
                        {label}
                      </span>
                    );
                  }
                  // builtin: or group:
                  const g = groupByRef.get(ref);
                  const label = g?.name ?? ref.split(":").pop() ?? ref;
                  // v2.5.0 (design pass #9): the tooltip used to be the
                  // raw ref string ("builtin:everyone") — developer-
                  // facing text leaking to users, and hover-only so
                  // invisible on touch anyway. Swapped for the resolved
                  // name + member count, which at least adds info
                  // beyond the visible label for sighted mouse users.
                  const tooltip = g
                    ? `${g.name} · ${g.memberCount} member${g.memberCount === 1 ? "" : "s"}`
                    : label;
                  return (
                    <span
                      key={ref}
                      className={`text-[11px] px-1.5 py-px rounded-md border ${attendeeChipClasses(ref)}`}
                      title={tooltip}
                    >
                      👥 {label}
                    </span>
                  );
                })}
              </div>
            );
          })()}
          {event.notes && (
            <div className="mt-2">
              <p
                className={`text-xs text-ink-secondary whitespace-pre-wrap ${notesExpanded ? "" : "line-clamp-2"}`}
              >
                {event.notes}
              </p>
              {/* v2.5.0 (design pass #10): notes used to render in full
                  via pre-wrap, breaking the timeline's rhythm for
                  verbose ones. Clamp to 2 lines with a visible toggle
                  instead of showing everything or hiding everything. */}
              {notesClampable && (
                <button
                  type="button"
                  onClick={() => setNotesExpanded((v) => !v)}
                  className="text-[11px] font-medium text-moss-700 hover:underline mt-0.5 cursor-pointer no-print"
                >
                  {notesExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
