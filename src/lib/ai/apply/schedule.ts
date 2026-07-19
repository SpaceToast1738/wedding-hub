// v2.4.0: apply bridge for event.update proposals.
//
// updateScheduleEvent is a full-record action: it re-parses every
// field on every save, so an omitted field WIPES the stored value
// (location/notes → null, endTime → null, allDay → false, and the
// whole attendeeRefs array replaced by whatever was posted — plus
// the legacy attendeeIds column unconditionally zeroed). This bridge
// therefore loads the live row and merges EVERY field: the patch
// value where the payload touches it, the current value otherwise.
// Attendees are add/remove deltas merged against the live refs (with
// the mandatory legacy attendeeIds expansion) in the pure module
// src/lib/ai/proposals/merge-event-update.ts.
//
// v2.8.0: was a FormData round-trip through updateScheduleEvent; now
// merges straight into the parsed EventCreateInput and calls the
// session-free updateScheduleEventCore, dropping the browser session
// the MCP self-apply path doesn't have. The combineDateTime replica
// below reproduces the action's own date+time recombination
// byte-for-byte (allDay → T00:00:00; missing/short time → 00:00), and
// parseEventInput applies the identical validation the human wrapper
// runs. The requireEdit("schedule") gate the action used to run is
// re-asserted here via requireSectionEdit (canEdit + the same error
// string), so a non-couple ai_write holder without EDIT(schedule)
// still can't apply an event.update.
//
// Throws on any failure so applyLoadedProposal's claim-rollback fires.

import { db } from "@/lib/db";
import { canEdit, type Section } from "@/lib/permissions";
// Type-only import — erased at compile time, so this module never
// pulls the @/auth graph into the MCP route bundle (same convention
// as src/lib/core/*).
import type { SessionUser } from "@/lib/actions";
import { eventUpdateSchema } from "@/lib/ai/proposals/schemas";
import { mergeAttendeeRefs } from "@/lib/ai/proposals/merge-event-update";
import { patchOrCurrent } from "@/lib/ai/apply/common";
import {
  parseEventInput,
  updateScheduleEventCore,
  type EventCreateInput,
} from "@/lib/core/schedule";

/** Session-free twin of requireEdit(section) — same error text, but
 *  the user comes from the caller instead of the session (same helper
 *  convention as src/lib/ai/apply/deletes.ts). Replaces the gate the
 *  human updateScheduleEvent used to run. */
async function requireSectionEdit(user: SessionUser, section: Section): Promise<void> {
  if (!(await canEdit(user, section))) {
    throw new Error(`Forbidden: no edit access to ${section}`);
  }
}

/** Replica of combineDateTime in schedule/actions.ts: recombine a
 *  date + time pair into the zone-less ISO string parseEventInput
 *  expects. allDay forces midnight; a missing/short time defaults to
 *  00:00 — byte-identical to the action the FormData round-trip used
 *  to hit. */
function combineDateTime(date: string, time: string, allDay: boolean): string {
  if (allDay) return `${date}T00:00:00`;
  return `${date}T${time && time.length >= 4 ? time : "00:00"}`;
}

/** Split an ISO datetime into the date + HH:MM pair combineDateTime
 *  expects. Same lossy slice as the historical FormData bridge:
 *  seconds and zone suffix are dropped. Used for PATCHED times, which
 *  arrive as wall-clock strings from the model. */
function splitIso(iso: string): { date: string; time: string } {
  const [date, timeRaw] = iso.split("T");
  return { date: date ?? "", time: (timeRaw ?? "").slice(0, 5) };
}

/** Format a CARRIED (unchanged) Date for the round-trip. combineDateTime
 *  builds a zone-less string that `new Date()` parses as SERVER-LOCAL
 *  time, so carried values must be rendered with local components —
 *  slicing toISOString() (UTC) would silently shift every carried time
 *  by the UTC offset on any non-UTC deployment (e.g. dev on this
 *  Windows box during BST). Byte-stable in every timezone. */
function splitLocal(d: Date): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export async function applyEventUpdate(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = eventUpdateSchema.parse(payload);

  const current = await db.scheduleEvent.findUnique({
    where: { id: parsed.eventId },
  });
  if (!current) {
    throw new Error(
      "Event not found — it may have been deleted since the proposal was made.",
    );
  }

  // allDay merged BEFORE times: combineDateTime forces T00:00:00 when
  // allDay is true, so the time slice below is ignored in that case —
  // same midnight-normalisation a human save gets.
  const allDay = parsed.allDay ?? current.allDay;

  const start =
    parsed.startTime !== undefined
      ? splitIso(parsed.startTime)
      : splitLocal(current.startTime);
  const startISO = start.date ? combineDateTime(start.date, start.time, allDay) : "";

  // endTime: undefined carries the current value; null clears (empty
  // endISO → the core's `endTime ? … : null` then nulls it).
  let endISO = "";
  if (parsed.endTime === undefined) {
    if (current.endTime) {
      const end = splitLocal(current.endTime);
      endISO = end.date ? combineDateTime(end.date, end.time, allDay) : "";
    }
  } else if (parsed.endTime) {
    const end = splitIso(parsed.endTime);
    endISO = end.date ? combineDateTime(end.date, end.time, allDay) : "";
  }

  // `|| null` mirrors the old FormData reads (`get(x) || null`): a
  // falsy patch/current value normalises to null.
  const location = patchOrCurrent(parsed.location, current.location);
  const notes = patchOrCurrent(parsed.notes, current.notes);

  // The FULL merged list — updateScheduleEventCore replaces the array
  // as a unit. mergeAttendeeRefs expands the legacy attendeeIds column
  // for pre-v1.41 rows so their attendees can't be silently wiped.
  const refs = mergeAttendeeRefs(
    { attendeeRefs: current.attendeeRefs, attendeeIds: current.attendeeIds },
    parsed.addAttendeeRefs,
    parsed.removeAttendeeRefs,
  );

  // Gate order matches the human action: the merge (live-row lookup)
  // ran before updateScheduleEvent's requireEdit, and parseEventInput's
  // validation ran after it. So a deleted event reports "Event not
  // found" (thrown above) rather than a permission error, and an
  // unauthorised caller is refused before the end-after-start check.
  await requireSectionEdit(user, "schedule");

  const input: EventCreateInput = parseEventInput({
    title: parsed.title ?? current.title,
    startTime: startISO,
    endTime: endISO || null,
    location: location || null,
    attendeeRefs: refs,
    allDay,
    notes: notes || null,
  });

  await updateScheduleEventCore(user, parsed.eventId, input);
  return { id: parsed.eventId };
}
