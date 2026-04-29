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
  // v1.27.1: legacy persona-based audience read still kept on the
  // schema (column remains for back-compat) but new events leave
  // it empty. UI no longer surfaces it.
  audience: z.array(z.string()).default([]),
  // v1.27.1: replaces audience.
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
    audience: readArray(formData, "audience"),
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
      audience: parsed.audience,
      attendeeIds: parsed.attendeeIds,
      allDay: parsed.allDay,
      notes: parsed.notes ?? null,
    },
  });
  await audit(user, { action: "create", entity: "ScheduleEvent", entityId: created.id });
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
    audience: readArray(formData, "audience"),
    attendeeIds: readArray(formData, "attendeeIds"),
    allDay,
    notes: formData.get("notes") || null,
  });
  await db.scheduleEvent.update({
    where: { id },
    data: {
      title: parsed.title,
      startTime: new Date(parsed.startTime),
      endTime: parsed.endTime ? new Date(parsed.endTime) : null,
      location: parsed.location ?? null,
      audience: parsed.audience,
      attendeeIds: parsed.attendeeIds,
      allDay: parsed.allDay,
      notes: parsed.notes ?? null,
    },
  });
  await audit(user, { action: "update", entity: "ScheduleEvent", entityId: id });
  revalidatePath("/schedule");
  revalidatePath("/");
}

export async function deleteScheduleEvent(id: string) {
  const user = await requireEdit("schedule");
  await db.scheduleEvent.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "ScheduleEvent", entityId: id });
  revalidatePath("/schedule");
  revalidatePath("/");
}
