// v2.8.0: shared session-free core for schedule-event writes.
//
// Same contract as src/lib/core/tasks.ts (see its header for the full
// rationale): human server actions and the MCP self-apply path run
// IDENTICAL logic — db write, audit row, revalidations — through one
// core. Plain lib file, never "use server": a "use server" export
// taking `user` as a parameter would be a client-invokable
// forged-user endpoint. Callers own authentication; the wrapper in
// src/app/(app)/schedule/actions.ts gates requireEdit("schedule")
// before calling in.
//
// The event Zod schema + friendly-error parser moved here with the
// core so BOTH callers share one validation path (including the
// v2.5.0 end-after-start refinement, which the AI-side
// eventCreateSchema doesn't carry).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
// Type-only import — erased at compile time, so the core never pulls
// the @/auth module graph into the MCP route bundle.
import type { SessionUser } from "@/lib/actions";

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
  // combine to midnight (see combineDateTime in schedule/actions.ts);
  // EventForm now marks start time required, and this refinement
  // closes the other half of the gap — an end time earlier than the
  // start time used to save without complaint.
  .refine(
    (data) => {
      if (!data.endTime) return true;
      return new Date(data.endTime).getTime() >= new Date(data.startTime).getTime();
    },
    { message: "End time must be at or after the start time.", path: ["endTime"] },
  );

/** Parsed, validated event shape — what createScheduleEventCore
 *  writes. `startTime`/`endTime` are zone-less wall-clock ISO strings
 *  (interpreted server-local by `new Date()`), as combineDateTime has
 *  always produced.
 *
 *  AI mapping: eventCreateSchema's parse result (EventCreatePayload
 *  in src/lib/ai/proposals/schemas.ts) is field-compatible — run it
 *  through parseEventInput() to pick up the end-after-start
 *  refinement the AI schema lacks. NB the historical FormData bridge
 *  (eventPayloadToFormData) sliced times to HH:MM, dropping seconds
 *  and any zone suffix — glue that wants byte-identical apply
 *  behaviour must replicate that slice. */
export type EventCreateInput = z.infer<typeof eventSchema>;

// v2.5.0 (design pass #4): thin wrapper around eventSchema.parse that
// turns a ZodError into a plain Error carrying just the first issue's
// message — the raw ZodError.message is a JSON blob, and EventForm's
// catch block (`err instanceof Error ? err.message : "Failed"`)
// renders whatever we throw here verbatim.
// (v2.8.0: was parseEvent in schedule/actions.ts.)
export function parseEventInput(input: unknown): EventCreateInput {
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

// v1.30.5: per the audit-aware-feature-design standing rule, schedule
// audit metadata is now enriched with the event title + key snapshot
// fields so audit log readers get useful info without rejoining the
// originating row. Helper builds the snapshot once. (Exported so
// updateScheduleEvent — still in the action file — keeps sharing it.)
export function eventAuditSnapshot(parsed: {
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

/** v2.8.0: re-assert combineDateTime's allDay invariant at the core
 *  boundary. The FormData wrapper already normalises allDay times to
 *  `${date}T00:00:00` before parsing, so for the human path this is a
 *  byte-identical no-op; direct callers (the MCP self-apply path) get
 *  the same normalisation instead of storing wall-clock times on
 *  allDay rows. String surgery, not Date maths — matches
 *  combineDateTime's output exactly. */
function normaliseAllDay(input: EventCreateInput): EventCreateInput {
  if (!input.allDay) return input;
  const midnight = (iso: string) => `${iso.split("T")[0] ?? ""}T00:00:00`;
  return {
    ...input,
    startTime: midnight(input.startTime),
    endTime: input.endTime ? midnight(input.endTime) : input.endTime,
  };
}

/** v2.8.0: extracted body of createScheduleEvent — the wrapper in
 *  schedule/actions.ts combines the FormData date+time fields, parses
 *  via parseEventInput, gates requireEdit("schedule"), then delegates
 *  here. Everything a human create did (db write, audit snapshot,
 *  revalidations, returned id) happens here so the two paths cannot
 *  drift. */
export async function createScheduleEventCore(
  user: SessionUser,
  input: EventCreateInput,
): Promise<{ id: string }> {
  const parsed = normaliseAllDay(input);
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
  // v2.8.0: logAudit with an explicit userId ≡ the audit(user, …)
  // helper — used directly so the core doesn't value-import
  // @/lib/actions (see core/tasks.ts).
  await logAudit({
    userId: user.id,
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

/** v2.8.0: extracted body of updateScheduleEvent — the wrapper in
 *  schedule/actions.ts combines the FormData date+time fields, parses
 *  via parseEventInput, gates requireEdit("schedule"), then delegates
 *  here. Everything the human update did (pre-update snapshot read, db
 *  write, changedFields diff, enriched audit row, revalidations)
 *  happens here so the two paths cannot drift. Void-returning, matching
 *  the original action (callers already know the eventId).
 *
 *  normaliseAllDay is a byte-identical no-op for the human path (the
 *  FormData combineDateTime already forced midnight); the MCP
 *  self-apply path gets the same normalisation. */
export async function updateScheduleEventCore(
  user: SessionUser,
  id: string,
  input: EventCreateInput,
): Promise<void> {
  const parsed = normaliseAllDay(input);
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
        : before.attendeeIds.map((refId) => `user:${refId}`);
    if (JSON.stringify(parsed.attendeeRefs) !== JSON.stringify(beforeRefs)) {
      changedFields.push("attendeeRefs");
    }
  }
  // v2.8.0: logAudit with an explicit userId ≡ the audit(user, …)
  // helper — used directly so the core doesn't value-import
  // @/lib/actions (see core/tasks.ts).
  await logAudit({
    userId: user.id,
    action: "update",
    entity: "ScheduleEvent",
    entityId: id,
    metadata: { ...eventAuditSnapshot(parsed), changedFields },
  });
  revalidatePath("/schedule");
  revalidatePath("/");
}
