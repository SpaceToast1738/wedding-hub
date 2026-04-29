"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  startTime: z.string().min(1),
  endTime: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  // v1.27.1: replaces the persona-based legacy `audience` (dropped in
  // v1.30.5). User IDs of who needs to know about / attend this event.
  attendeeIds: z.array(z.string()).default([]),
  allDay: z.boolean().default(false),
  notes: z.string().max(2000).optional().nullable(),
});

function readArray(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String).filter(Boolean);
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

// v1.30.5: per the audit-aware-feature-design standing rule, schedule
// audit metadata is now enriched with the event title + key snapshot
// fields so audit log readers get useful info without rejoining the
// originating row. Helper builds the snapshot once.
function eventAuditSnapshot(parsed: {
  title: string;
  startTime: string;
  allDay: boolean;
  attendeeIds: string[];
}) {
  return {
    title: parsed.title,
    startTime: parsed.startTime,
    allDay: parsed.allDay,
    attendeeCount: parsed.attendeeIds.length,
  };
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
  const parsed = eventSchema.parse({
    title: formData.get("title"),
    startTime: startISO,
    endTime: endISO || null,
    location: formData.get("location") || null,
    attendeeIds: readArray(formData, "attendeeIds"),
    allDay,
    notes: formData.get("notes") || null,
  });
  const created = await db.scheduleEvent.create({
    data: {
      title: parsed.title,
      startTime: new Date(parsed.startTime),
      endTime: parsed.endTime ? new Date(parsed.endTime) : null,
      location: parsed.location ?? null,
      attendeeIds: parsed.attendeeIds,
      allDay: parsed.allDay,
      notes: parsed.notes ?? null,
    },
  });
  await audit(user, {
    action: "create",
    entity: "ScheduleEvent",
    entityId: created.id,
    metadata: eventAuditSnapshot(parsed),
  });
  revalidatePath("/schedule");
  revalidatePath("/");
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
  const parsed = eventSchema.parse({
    title: formData.get("title"),
    startTime: startISO,
    endTime: endISO || null,
    location: formData.get("location") || null,
    attendeeIds: readArray(formData, "attendeeIds"),
    allDay,
    notes: formData.get("notes") || null,
  });
  // v1.30.5: read pre-update so the audit can record changedFields.
  const before = await db.scheduleEvent.findUnique({ where: { id } });
  await db.scheduleEvent.update({
    where: { id },
    data: {
      title: parsed.title,
      startTime: new Date(parsed.startTime),
      endTime: parsed.endTime ? new Date(parsed.endTime) : null,
      location: parsed.location ?? null,
      attendeeIds: parsed.attendeeIds,
      allDay: parsed.allDay,
      notes: parsed.notes ?? null,
    },
  });
  // v1.30.5: changedFields diff. Compare each parsed field to the pre-
  // update row. Arrays compare on JSON to avoid order false-positives —
  // attendees rarely reorder so this is a fine proxy for "different".
  const changedFields: string[] = [];
  if (before) {
    if (parsed.title !== before.title) changedFields.push("title");
    if (new Date(parsed.startTime).getTime() !== before.startTime.getTime()) changedFields.push("startTime");
    const newEnd = parsed.endTime ? new Date(parsed.endTime).getTime() : null;
    const oldEnd = before.endTime ? before.endTime.getTime() : null;
    if (newEnd !== oldEnd) changedFields.push("endTime");
    if ((parsed.location ?? null) !== (before.location ?? null)) changedFields.push("location");
    if (parsed.allDay !== before.allDay) changedFields.push("allDay");
    if ((parsed.notes ?? null) !== (before.notes ?? null)) changedFields.push("notes");
    if (JSON.stringify(parsed.attendeeIds) !== JSON.stringify(before.attendeeIds)) changedFields.push("attendeeIds");
  }
  await audit(user, {
    action: "update",
    entity: "ScheduleEvent",
    entityId: id,
    metadata: { ...eventAuditSnapshot(parsed), changedFields },
  });
  revalidatePath("/schedule");
  revalidatePath("/");
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
