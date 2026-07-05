// v2.4.0: apply bridge for event.update proposals.
//
// updateScheduleEvent is a full-record action: it re-parses every
// field on every save, so an omitted field WIPES the stored value
// (location/notes → null, endTime → null, allDay → false, and the
// whole attendeeRefs array replaced by whatever was posted — plus
// the legacy attendeeIds column unconditionally zeroed). This bridge
// therefore loads the live row and posts EVERY field: the patch
// value where the payload touches it, the current value otherwise.
// Attendees are add/remove deltas merged against the live refs (with
// the mandatory legacy attendeeIds expansion) in the pure module
// src/lib/ai/proposals/merge-event-update.ts.
//
// Throws on any failure so applyLoadedProposal's claim-rollback
// fires. Permissions compose: the caller gates ai_write, then
// updateScheduleEvent itself gates requireEdit("schedule").

import { updateScheduleEvent } from "@/app/(app)/schedule/actions";
import { db } from "@/lib/db";
import { eventUpdateSchema } from "@/lib/ai/proposals/schemas";
import { mergeAttendeeRefs } from "@/lib/ai/proposals/merge-event-update";
import { patchOrCurrent } from "@/lib/ai/apply/common";

/** Split an ISO datetime into the startDate/startTime (or endDate/
 *  endTime) field pair combineDateTime expects — date part + HH:MM.
 *  Same lossy slice as eventPayloadToFormData in ai/actions.ts:
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
  _user: { id: string; isCouple: boolean },
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

  const fd = new FormData();
  fd.append("title", parsed.title ?? current.title);

  // allDay merged BEFORE times: combineDateTime forces T00:00:00 when
  // allDay is true, so the time slice below is ignored in that case —
  // same midnight-normalisation a human save gets.
  const allDay = parsed.allDay ?? current.allDay;
  if (allDay) fd.append("allDay", "true");

  const start =
    parsed.startTime !== undefined
      ? splitIso(parsed.startTime)
      : splitLocal(current.startTime);
  fd.append("startDate", start.date);
  fd.append("startTime", start.time);

  // endTime: undefined carries the current value; null clears (post
  // neither field — the action's `endISO || null` then nulls it).
  if (parsed.endTime === undefined) {
    if (current.endTime) {
      const end = splitLocal(current.endTime);
      fd.append("endDate", end.date);
      fd.append("endTime", end.time);
    }
  } else if (parsed.endTime) {
    const end = splitIso(parsed.endTime);
    fd.append("endDate", end.date);
    fd.append("endTime", end.time);
  }

  const location = patchOrCurrent(parsed.location, current.location);
  if (location) fd.append("location", location);
  const notes = patchOrCurrent(parsed.notes, current.notes);
  if (notes) fd.append("notes", notes);

  // Post the FULL merged list — updateScheduleEvent replaces the
  // array as a unit. Never post attendeeIds: the legacy fallback in
  // readAttendeeRefs must stay unreachable so the action's zeroing of
  // that column can't resurrect stale entries.
  const refs = mergeAttendeeRefs(
    { attendeeRefs: current.attendeeRefs, attendeeIds: current.attendeeIds },
    parsed.addAttendeeRefs,
    parsed.removeAttendeeRefs,
  );
  for (const ref of refs) fd.append("attendeeRefs", ref);

  await updateScheduleEvent(parsed.eventId, fd);
  // Void-returning action — the entity id IS the eventId.
  return { id: parsed.eventId };
}
