"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

const eventSchema = z
  .object({
    title: z.string().min(1).max(200),
    startTime: z.string().min(1),
    endTime: z.string().optional().nullable(),
    location: z.string().max(200).optional().nullable(),
    // v1.41.0 (backlog #4): polymorphic attendee references replacing
    // the v1.27.1 attendeeIds. Each entry is one of:
    //   "user:<id>" | "builtin:<slug>" | "group:<slug>"
    // Legacy `attendeeIds` still accepted on input for clients that
    // haven't been redeployed yet — we promote them to user:<id> refs
    // here so the DB writes consistently. The legacy column itself
    // stays one release as a recoverability buffer; this action stops
    // writing to it from this release on.
    attendeeRefs: z.array(z.string().min(1).max(80)).default([]),
    allDay: z.boolean().default(false),
    notes: z.string().max(2000).optional().nullable(),
  })
  // v2.5.0 (design pass #4): a blank start-time input used to silently
  // combine to midnight (see combineDateTime below); EventForm now
  // marks start time required, and this refinement closes the other
  // half of the gap — an end time earlier than the start time used to
  // save without complaint.
  .refine(
    (data) => {
      if (!data.endTime) return true;
      return new Date(data.endTime).getTime() >= new Date(data.startTime).getTime();
    },
    { message: "End time must be at or after the start time.", path: ["endTime"] },
  );

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

// v1.30.5: per the audit-aware-feature-design standing rule, schedule
// audit metadata is now enriched with the event title + key snapshot
// fields so audit log readers get useful info without rejoining the
// originating row. Helper builds the snapshot once.
function eventAuditSnapshot(parsed: {
  title: string;
  startTime: string;
  allDay: boolean;
  attendeeRefs: string[];
}) {
  return {
    title: parsed.title,
    startTime: parsed.startTime,
    allDay: parsed.allDay,
    attendeeCount: parsed.attendeeRefs.length,
    // v1.41.0: surface ref-kind breakdown so the audit log shows
    // "Saved schedule event 'Ceremony' — 1 group, 2 individuals"
    // rather than just "3 attendees".
    attendeeKinds: countRefKinds(parsed.attendeeRefs),
  };
}

// v2.5.0 (design pass #4): thin wrapper around eventSchema.parse that
// turns a ZodError into a plain Error carrying just the first issue's
// message — the raw ZodError.message is a JSON blob, and EventForm's
// catch block (`err instanceof Error ? err.message : "Failed"`)
// renders whatever we throw here verbatim.
function parseEvent(input: unknown): z.infer<typeof eventSchema> {
  try {
    return eventSchema.parse(input);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(err.errors[0]?.message ?? "Invalid event data");
    }
    throw err;
  }
}

function countRefKinds(refs: string[]): { user: number; builtin: number; group: number } {
  const out = { user: 0, builtin: 0, group: 0 };
  for (const r of refs) {
    if (r.startsWith("user:")) out.user += 1;
    else if (r.startsWith("builtin:")) out.builtin += 1;
    else if (r.startsWith("group:")) out.group += 1;
  }
  return out;
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
  const parsed = parseEvent({
    title: formData.get("title"),
    startTime: startISO,
    endTime: endISO || null,
    location: formData.get("location") || null,
    attendeeRefs: readAttendeeRefs(formData),
    allDay,
    notes: formData.get("notes") || null,
  });
  const created = await db.scheduleEvent.create({
    data: {
      title: parsed.title,
      startTime: new Date(parsed.startTime),
      endTime: parsed.endTime ? new Date(parsed.endTime) : null,
      location: parsed.location ?? null,
      // v1.41.0: write attendeeRefs only. Legacy attendeeIds is left
      // empty on new rows; the read path handles the fallback for
      // pre-migration rows that haven't been re-saved yet.
      attendeeRefs: parsed.attendeeRefs,
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
  // v2.1.0 phase 2: return the id so applyProposal can link the
  // AiProposal to the row it just produced.
  return { id: created.id };
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
  const parsed = parseEvent({
    title: formData.get("title"),
    startTime: startISO,
    endTime: endISO || null,
    location: formData.get("location") || null,
    attendeeRefs: readAttendeeRefs(formData),
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
      attendeeRefs: parsed.attendeeRefs,
      // v1.41.0: stop writing to legacy attendeeIds — when refs are
      // saved, we clear the legacy column so the two don't diverge.
      // The migration's backfill ensures all pre-existing rows have
      // attendeeRefs populated already.
      attendeeIds: [],
      allDay: parsed.allDay,
      notes: parsed.notes ?? null,
    },
  });
  // v1.30.5: changedFields diff. Compare each parsed field to the pre-
  // update row. Arrays compare on JSON to avoid order false-positives.
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
    // Compare attendeeRefs — fall back to the legacy attendeeIds
    // (expanded as user:<id>) for pre-migration rows.
    const beforeRefs =
      before.attendeeRefs.length > 0
        ? before.attendeeRefs
        : before.attendeeIds.map((id) => `user:${id}`);
    if (JSON.stringify(parsed.attendeeRefs) !== JSON.stringify(beforeRefs)) {
      changedFields.push("attendeeRefs");
    }
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
