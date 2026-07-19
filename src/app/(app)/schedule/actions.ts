"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
// v2.8.0: eventSchema, parseEventInput (was parseEvent) and
// eventAuditSnapshot moved to @/lib/core/schedule with the extracted
// createScheduleEvent / updateScheduleEvent bodies, so the MCP
// self-apply path can run the identical write logic (including
// validation) without a browser session. This file keeps the
// FormData-shaped plumbing (combining date+time inputs, checkbox
// coercion, legacy attendeeIds fallback) plus the requireEdit auth
// gates — human behaviour is unchanged.
import {
  createScheduleEventCore,
  parseEventInput,
  updateScheduleEventCore,
} from "@/lib/core/schedule";

function readArray(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String).filter(Boolean);
}

// v1.41.0: read both new (attendeeRefs) and legacy (attendeeIds)
// form fields, normalising to a single attendeeRefs array. Old
// clients still posting attendeeIds keep working; new clients post
// the polymorphic refs directly.
function readAttendeeRefs(formData: FormData): string[] {
  const refs = readArray(formData, "attendeeRefs");
  if (refs.length > 0) return refs;
  // Legacy fallback — promote each id to a user:<id> ref.
  return readArray(formData, "attendeeIds").map((id) => `user:${id}`);
}

// v1.27.1: combine date + time inputs into the ISO string the schema
// expects. When `allDay` is true the time component is forced to
// midnight (local) so renderers can branch on the flag without
// having to remember the time was meant to be ignored. Date-only
// input arrives as YYYY-MM-DD; time as HH:MM.
function combineDateTime(date: string, time: string, allDay: boolean): string {
  if (allDay) return `${date}T00:00:00`;
  // If time missing, default to midnight (matches the user's likely
  // intent better than rejecting).
  return `${date}T${time && time.length >= 4 ? time : "00:00"}`;
}

export async function createScheduleEvent(formData: FormData) {
  const user = await requireEdit("schedule");
  const allDay = formData.get("allDay") === "on" || formData.get("allDay") === "true";
  const startDate = String(formData.get("startDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const startISO = startDate ? combineDateTime(startDate, startTime, allDay) : "";
  const endISO = endDate ? combineDateTime(endDate, endTime, allDay) : "";
  const parsed = parseEventInput({
    title: formData.get("title"),
    startTime: startISO,
    endTime: endISO || null,
    location: formData.get("location") || null,
    attendeeRefs: readAttendeeRefs(formData),
    allDay,
    notes: formData.get("notes") || null,
  });
  // v2.8.0: body lives in createScheduleEventCore — db write, audit
  // snapshot, revalidations, returned id all happen there.
  return createScheduleEventCore(user, parsed);
}

export async function updateScheduleEvent(id: string, formData: FormData) {
  const user = await requireEdit("schedule");
  const allDay = formData.get("allDay") === "on" || formData.get("allDay") === "true";
  const startDate = String(formData.get("startDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const startISO = startDate ? combineDateTime(startDate, startTime, allDay) : "";
  const endISO = endDate ? combineDateTime(endDate, endTime, allDay) : "";
  const parsed = parseEventInput({
    title: formData.get("title"),
    startTime: startISO,
    endTime: endISO || null,
    location: formData.get("location") || null,
    attendeeRefs: readAttendeeRefs(formData),
    allDay,
    notes: formData.get("notes") || null,
  });
  // v2.8.0: body lives in updateScheduleEventCore — pre-update
  // snapshot read, db write, changedFields diff, audit row and
  // revalidations all happen there.
  await updateScheduleEventCore(user, id, parsed);
}

export async function deleteScheduleEvent(id: string) {
  const user = await requireEdit("schedule");
  // v1.30.5: snapshot pre-delete so the audit row is meaningful after
  // the source row is gone.
  const before = await db.scheduleEvent.findUnique({ where: { id } });
  await db.scheduleEvent.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "ScheduleEvent",
    entityId: id,
    metadata: before
      ? { title: before.title, startTime: before.startTime.toISOString() }
      : undefined,
  });
  revalidatePath("/schedule");
  revalidatePath("/");
}
