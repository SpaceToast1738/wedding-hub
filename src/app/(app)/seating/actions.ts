"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TableShape, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
// v2.8.0: assignGuestToSeat's body extracted to a session-free core so
// the MCP self-apply path runs identical write logic without a browser
// session. The wrapper keeps the requireEdit("seating") gate; the AI
// apply path (src/lib/ai/apply/misc.ts) owns the occupancy/attending
// refusals then gates canEdit(user, "seating") before calling the core.
// v2.8.1: the table create/capacity/position/notes bodies and the swap
// transaction moved to cores too (Tier 2, Slice 3) so the AI apply path
// for seating.table.create / seating.table.update / seat.swap /
// seat.unassign runs byte-identical write logic. The wrappers below keep
// their FormData/param parse + the requireEdit("seating") gate and
// delegate. CapacityResult/SwapResult now originate in the core; re-
// exported here so existing importers keep resolving them.
import {
  assignGuestToSeatCore,
  createTableCore,
  swapSeatsCore,
  tableCreateInputSchema,
  updateTableCapacityCore,
  updateTableNotesCore,
  updateTablePositionCore,
  type CapacityResult,
  type SwapResult,
} from "@/lib/core/misc";

export type { CapacityResult, SwapResult };

export async function createTable(formData: FormData) {
  const user = await requireEdit("seating");
  const parsed = tableCreateInputSchema.parse({
    name: formData.get("name"),
    shape: formData.get("shape") || TableShape.ROUND,
    capacity: formData.get("capacity") || 8,
  });
  await createTableCore(user, parsed);
}

export async function deleteTable(id: string) {
  const user = await requireEdit("seating");
  // Snapshot name + occupancy before delete so the audit row reads
  // usefully even after the table is gone.
  const before = await db.table.findUnique({
    where: { id },
    include: {
      seats: { include: { guest: { select: { id: true } } } },
    },
  });
  const occupiedCount = before?.seats.filter((s) => s.guest).length ?? 0;
  await db.table.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "Table",
    entityId: id,
    metadata: {
      name: before?.name ?? null,
      shape: before?.shape ?? null,
      capacity: before?.capacity ?? null,
      occupiedCount,
    },
  });
  revalidatePath("/seating");
}

export async function updateTablePosition(
  id: string,
  posX: number,
  posY: number,
  rotation?: number,
) {
  const user = await requireEdit("seating");
  // v2.8.1: body lives in updateTablePositionCore.
  await updateTablePositionCore(user, id, posX, posY, rotation);
}

// v1.22.6: modify capacity of an existing table (grow appends seats;
// shrink repacks then drops trailing seats, refusing over-occupancy).
// v2.8.1: body lives in updateTableCapacityCore; CapacityResult is
// re-exported at the top of this file.
export async function updateTableCapacity(
  id: string,
  newCapacity: number,
): Promise<CapacityResult> {
  const user = await requireEdit("seating");
  return updateTableCapacityCore(user, id, newCapacity);
}

export async function assignGuestToSeat(seatId: string, guestId: string | null) {
  const user = await requireEdit("seating");
  // v2.8.0: body lives in assignGuestToSeatCore — the unique-constraint-
  // safe clear-and-assign transaction, the post-write name/table
  // snapshot for the audit row and the revalidation all happen there so
  // the AI apply path shares one implementation.
  await assignGuestToSeatCore(user, seatId, guestId);
}

// v1.23.0: per-table notes — free-form text. Empty string clears.
// v2.8.1: body lives in updateTableNotesCore.
export async function updateTableNotes(id: string, notes: string) {
  const user = await requireEdit("seating");
  await updateTableNotesCore(user, id, notes);
}

// v1.23.0: per-table day-of checklist. Stored as Json array of items.
// The action accepts the whole array each time (overwrites) — simpler
// than diffing client-side with add/remove/toggle endpoints.
export type ChecklistItem = { id: string; label: string; done: boolean };
const checklistSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(50),
      label: z.string().min(1).max(200),
      done: z.boolean(),
    }),
  )
  .max(50); // soft cap; keeps the JSON column small + UI scrollable
export async function updateTableChecklist(id: string, items: ChecklistItem[]) {
  const user = await requireEdit("seating");
  const parsed = checklistSchema.parse(items);
  // Prisma's Nullable Json input wants the explicit `JsonNull` token
  // when clearing — passing JS `null` is a TS error since v5.
  const updated = await db.table.update({
    where: { id },
    data: {
      checklist:
        parsed.length === 0 ? Prisma.JsonNull : (parsed as Prisma.InputJsonValue),
    },
  });
  const doneCount = parsed.filter((i) => i.done).length;
  await audit(user, {
    action: "checklist",
    entity: "Table",
    entityId: id,
    metadata: {
      tableName: updated.name,
      itemCount: parsed.length,
      doneCount,
      cleared: parsed.length === 0,
    },
  });
  revalidatePath("/seating");
}

// v1.23.1: plan-level day-of checklist (replaces v1.23.0 per-table
// checklist after user feedback "should be global, always visible").
// Stored on the WeddingSettings singleton alongside seatingNotes.
const seatingChecklistSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(50),
      label: z.string().min(1).max(200),
      done: z.boolean(),
    }),
  )
  .max(100); // generous cap — global checklist may be longer than per-table.
export async function updateSeatingChecklist(items: ChecklistItem[]) {
  const user = await requireEdit("seating");
  const parsed = seatingChecklistSchema.parse(items);
  await db.weddingSettings.upsert({
    where: { id: 1 },
    update: {
      seatingChecklist:
        parsed.length === 0 ? Prisma.JsonNull : (parsed as Prisma.InputJsonValue),
    },
    create: {
      id: 1,
      weddingDate: new Date(process.env.WEDDING_DATE ?? "2026-09-26T14:00:00Z"),
      venue: process.env.WEDDING_VENUE ?? "Alveston Manor",
      seatingChecklist:
        parsed.length === 0 ? Prisma.JsonNull : (parsed as Prisma.InputJsonValue),
    },
  });
  const doneCount = parsed.filter((i) => i.done).length;
  await audit(user, {
    action: "seating-checklist",
    entity: "WeddingSettings",
    entityId: "1",
    metadata: {
      itemCount: parsed.length,
      doneCount,
      cleared: parsed.length === 0,
    },
  });
  revalidatePath("/seating");
}

// v1.23.0: plan-level seating notes — stored on the WeddingSettings
// singleton so the bootstrap row always exists (loader has defaults
// fallback). Couple-edit + planner-edit both allowed via seating gate.
const seatingNotesSchema = z.string().max(5000);
export async function updateSeatingNotes(notes: string) {
  const user = await requireEdit("seating");
  const parsed = seatingNotesSchema.parse(notes);
  await db.weddingSettings.upsert({
    where: { id: 1 },
    update: { seatingNotes: parsed === "" ? null : parsed },
    // Defensive: in the unlikely case the singleton row doesn't yet
    // exist, create a minimal one. Other fields fall back to defaults
    // already declared in the schema. weddingDate is required and has
    // no default — pull it from env if absent (matches the seed).
    create: {
      id: 1,
      weddingDate: new Date(process.env.WEDDING_DATE ?? "2026-09-26T14:00:00Z"),
      venue: process.env.WEDDING_VENUE ?? "Alveston Manor",
      seatingNotes: parsed === "" ? null : parsed,
    },
  });
  await audit(user, {
    action: "seating-notes",
    entity: "WeddingSettings",
    entityId: "1",
    metadata: {
      notesLength: parsed.length,
      cleared: parsed === "",
    },
  });
  revalidatePath("/seating");
}

// v1.23.0: ceremony seating layout — singleton row, configures rows
// and seats-per-row for left + right sides of the aisle. No per-seat
// guest assignments yet (deferred). The page lives at /seating/ceremony.
const ceremonySchema = z.object({
  leftRows: z.coerce.number().int().min(1).max(40),
  leftSeatsRow: z.coerce.number().int().min(1).max(20),
  rightRows: z.coerce.number().int().min(1).max(40),
  rightSeatsRow: z.coerce.number().int().min(1).max(20),
  notes: z.string().max(5000).optional(),
});
// v1.23.2: returns a result instead of throwing — same reasoning as
// updateTableCapacity (v1.22.9). Pre-fix any throw from the upsert
// (validation error, missing migration, FK issue) was redacted by
// Next.js production mode and surfaced as the generic
// "Server Components render" overlay rather than a clean toast. The
// user reported "Seating settings didn't persist for ceremony" —
// that's exactly the symptom this pattern fixes.
export type SaveResult = { ok: true } | { ok: false; error: string };

export async function updateCeremonySeating(formData: FormData): Promise<SaveResult> {
  const user = await requireEdit("seating");
  try {
    const parsed = ceremonySchema.parse({
      leftRows: formData.get("leftRows"),
      leftSeatsRow: formData.get("leftSeatsRow"),
      rightRows: formData.get("rightRows"),
      rightSeatsRow: formData.get("rightSeatsRow"),
      notes: formData.get("notes") ?? "",
    });
    const notes = parsed.notes && parsed.notes !== "" ? parsed.notes : null;
    // Read before so the audit log can diff old → new on the fields
    // the user actually changed.
    const before = await db.ceremonySeating.findUnique({ where: { id: 1 } });
    await db.ceremonySeating.upsert({
      where: { id: 1 },
      update: {
        leftRows: parsed.leftRows,
        leftSeatsRow: parsed.leftSeatsRow,
        rightRows: parsed.rightRows,
        rightSeatsRow: parsed.rightSeatsRow,
        notes,
      },
      create: {
        id: 1,
        leftRows: parsed.leftRows,
        leftSeatsRow: parsed.leftSeatsRow,
        rightRows: parsed.rightRows,
        rightSeatsRow: parsed.rightSeatsRow,
        notes,
      },
    });
    const changedFields: string[] = [];
    if (before) {
      if (before.leftRows !== parsed.leftRows) changedFields.push("leftRows");
      if (before.leftSeatsRow !== parsed.leftSeatsRow) changedFields.push("leftSeatsRow");
      if (before.rightRows !== parsed.rightRows) changedFields.push("rightRows");
      if (before.rightSeatsRow !== parsed.rightSeatsRow) changedFields.push("rightSeatsRow");
      if (before.notes !== notes) changedFields.push("notes");
    } else {
      changedFields.push("created");
    }
    const totalSeats =
      parsed.leftRows * parsed.leftSeatsRow + parsed.rightRows * parsed.rightSeatsRow;
    await audit(user, {
      action: "update",
      entity: "CeremonySeating",
      entityId: "1",
      metadata: {
        leftRows: parsed.leftRows,
        leftSeatsRow: parsed.leftSeatsRow,
        rightRows: parsed.rightRows,
        rightSeatsRow: parsed.rightSeatsRow,
        totalSeats,
        changedFields,
      },
    });
    revalidatePath("/seating/ceremony");
    return { ok: true };
  } catch (err) {
    // Surface a real message instead of letting Next's production
    // redactor swallow it — most likely culprit is the
    // CeremonySeating migration not having been applied yet (table
    // doesn't exist on prod). Logging server-side too so the operator
    // can see the underlying Prisma message in container logs.
    console.error("updateCeremonySeating failed", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

// v1.54.0 (A10): `setCeremonyRowGroup` and the per-row CeremonyRow
// model were superseded by v1.48.0's auto-fill allocator
// (src/lib/ceremony-allocate.ts). The action was kept one release
// as a recoverability buffer; v1.54.0 removes the export so a stale
// browser tab can't silently write rows into the deprecated table.
// The CeremonyRow Prisma model itself is still in place as a buffer
// (per the schema commentary) — drop in a future migration once
// confidence in the auto-fill model is high.

// v1.70.0: swap the guest assignments of two seats in the same table.
// Used by the TableCard drag-to-reorder UI. v2.8.1: the transaction body
// moved to swapSeatsCore; the wrapper keeps the identical-seat short
// circuit BEFORE the gate (byte-identical) then delegates. SwapResult is
// re-exported at the top of this file.
export async function swapSeats(seatId1: string, seatId2: string): Promise<SwapResult> {
  if (seatId1 === seatId2) return { ok: true };
  const user = await requireEdit("seating");
  return swapSeatsCore(user, seatId1, seatId2);
}
