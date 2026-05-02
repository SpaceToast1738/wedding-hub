"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TableShape, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

const tableSchema = z.object({
  name: z.string().min(1).max(100),
  shape: z.nativeEnum(TableShape).default(TableShape.ROUND),
  capacity: z.coerce.number().int().min(1).max(40),
});

// New tables drop into the canvas in a 3-column grid based on how many
// already exist. Keeps them from stacking at (0,0) which is the schema
// default.
function nextGridPosition(existingCount: number): { posX: number; posY: number } {
  const cols = 3;
  const colWidth = 280;
  const rowHeight = 240;
  const startX = 180;
  const startY = 160;
  const col = existingCount % cols;
  const row = Math.floor(existingCount / cols);
  return { posX: startX + col * colWidth, posY: startY + row * rowHeight };
}

export async function createTable(formData: FormData) {
  const user = await requireEdit("seating");
  const parsed = tableSchema.parse({
    name: formData.get("name"),
    shape: formData.get("shape") || TableShape.ROUND,
    capacity: formData.get("capacity") || 8,
  });

  const existing = await db.table.count();
  const { posX, posY } = nextGridPosition(existing);

  const table = await db.table.create({
    data: {
      name: parsed.name,
      shape: parsed.shape,
      capacity: parsed.capacity,
      posX,
      posY,
    },
  });
  await db.seat.createMany({
    data: Array.from({ length: parsed.capacity }, (_, i) => ({
      tableId: table.id,
      index: i,
    })),
  });
  await audit(user, {
    action: "create",
    entity: "Table",
    entityId: table.id,
    metadata: {
      name: table.name,
      shape: table.shape,
      capacity: table.capacity,
    },
  });
  revalidatePath("/seating");
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

const positionSchema = z.object({
  posX: z.number().min(0).max(5000),
  posY: z.number().min(0).max(5000),
  rotation: z.number().min(-360).max(720).optional(),
});

export async function updateTablePosition(
  id: string,
  posX: number,
  posY: number,
  rotation?: number,
) {
  const user = await requireEdit("seating");
  const parsed = positionSchema.parse({ posX, posY, rotation });
  await db.table.update({
    where: { id },
    data: {
      posX: parsed.posX,
      posY: parsed.posY,
      ...(parsed.rotation !== undefined && { rotation: parsed.rotation }),
    },
  });
  await audit(user, {
    action: "position",
    entity: "Table",
    entityId: id,
    metadata: { posX: parsed.posX, posY: parsed.posY, rotation: parsed.rotation },
  });
  // Revalidate so positions survive view-switches and navigation. The
  // canvas component preserves its local position over a refreshed prop
  // (see the useEffect in SeatingCanvas), so this does NOT cause a
  // mid-drag snap-back; only the server snapshot gets refreshed.
  revalidatePath("/seating");
}

// v1.22.6: modify capacity of an existing table.
// - Grow: append new Seat rows for the missing indices. The round-table
//   layout in SeatingCanvas spreads seats by `i/capacity * 2π`, so all
//   existing seats reposition visually — that's expected, every seat
//   shifts a bit when you add one.
// - Shrink: only allowed if the trailing seats (index >= newCapacity)
//   are all empty. If any trailing seat has a guest, throw — the
//   planner needs to unseat them first. Avoids silent re-shuffles.
const capacitySchema = z.object({
  newCapacity: z.coerce.number().int().min(1).max(40),
});

// v1.22.9: returns a result object instead of throwing. Pre-fix the
// "Can't shrink to N: M seats still assigned" Error was being thrown,
// which Next.js production mode redacts and surfaces as the scary
// "An error occurred in the Server Components render" overlay rather
// than the intended notify-error toast. Returning a typed result gives
// the client a clean error path that survives the redaction layer.
export type CapacityResult = { ok: true } | { ok: false; error: string };

export async function updateTableCapacity(
  id: string,
  newCapacity: number,
): Promise<CapacityResult> {
  const user = await requireEdit("seating");
  const parsed = capacitySchema.parse({ newCapacity });
  const table = await db.table.findUnique({
    where: { id },
    include: { seats: { include: { guest: { select: { id: true } } } } },
  });
  if (!table) return { ok: false, error: "Table not found" };
  const current = table.capacity;
  const target = parsed.newCapacity;
  if (target === current) return { ok: true };

  if (target > current) {
    // Append seats with indices [current..target-1].
    await db.seat.createMany({
      data: Array.from({ length: target - current }, (_, i) => ({
        tableId: id,
        index: current + i,
      })),
    });
    await db.table.update({ where: { id }, data: { capacity: target } });
  } else {
    // v1.22.10 shrink — REPACK behavior.
    // Pre-fix the action complained "seats above #N are still assigned"
    // when the trailing indices happened to be occupied. The user's
    // mental model is total occupancy: "I have 4 guests, I want a
    // 4-seat table — fine, regardless of which slots they currently
    // sit in." So before deleting trailing seats, move any guests
    // sitting there into leading empty slots. Only error when the
    // TOTAL guest count exceeds the new capacity.
    const occupiedCount = table.seats.filter((s) => s.guest).length;
    if (occupiedCount > target) {
      return {
        ok: false,
        error: `Can't shrink to ${target}: ${occupiedCount} guests assigned to this table. Unseat ${occupiedCount - target} first.`,
      };
    }
    const trailingOccupied = table.seats
      .filter((s) => s.index >= target && s.guest)
      .sort((a, b) => a.index - b.index);
    const leadingEmpty = table.seats
      .filter((s) => s.index < target && !s.guest)
      .sort((a, b) => a.index - b.index);
    // Pair each trailing-occupied seat with a leading empty slot.
    // Length invariant: leadingEmpty.length >= trailingOccupied.length
    // because total occupied <= target < seats-below-target + seats-
    // above-target, and we've already counted enough empties.
    const moves = trailingOccupied.map((src, i) => ({
      guestId: src.guest!.id,
      toSeatId: leadingEmpty[i]!.id,
    }));
    // Atomic: move guests, drop trailing seats, set capacity. If any
    // step fails the whole shrink rolls back.
    await db.$transaction([
      ...moves.map((m) =>
        db.guest.update({
          where: { id: m.guestId },
          data: { tableSeatId: m.toSeatId },
        }),
      ),
      db.seat.deleteMany({ where: { tableId: id, index: { gte: target } } }),
      db.table.update({ where: { id }, data: { capacity: target } }),
    ]);
  }
  await audit(user, {
    action: "capacity",
    entity: "Table",
    entityId: id,
    metadata: { from: current, to: target },
  });
  revalidatePath("/seating");
  return { ok: true };
}

export async function assignGuestToSeat(seatId: string, guestId: string | null) {
  const user = await requireEdit("seating");
  // B12 (v1.12.0): wrap clear-and-assign in a single transaction so two
  // simultaneous drags can't both think they own the seat for a moment.
  // The `Guest.tableSeatId` column has a unique constraint, so the
  // *second* offender will fail noisily inside the transaction rather
  // than producing a half-applied state. Either both updates land or
  // neither.
  if (guestId) {
    await db.$transaction([
      db.guest.updateMany({
        where: { tableSeatId: seatId, NOT: { id: guestId } },
        data: { tableSeatId: null },
      }),
      db.guest.update({ where: { id: guestId }, data: { tableSeatId: seatId } }),
    ]);
  } else {
    await db.guest.updateMany({ where: { tableSeatId: seatId }, data: { tableSeatId: null } });
  }
  // v1.39.0: enrich the audit with guest + seat snapshot fields so
  // the log reads as "Seated <Guest> at <Table> seat 3" rather than
  // bare ids. We look up the guest's name + table info post-write
  // because the relevant join wasn't loaded above.
  let guestName: string | null = null;
  let tableName: string | null = null;
  let seatIndex: number | null = null;
  const seat = await db.seat.findUnique({
    where: { id: seatId },
    include: { table: { select: { name: true } } },
  });
  tableName = seat?.table.name ?? null;
  seatIndex = seat?.index ?? null;
  if (guestId) {
    const g = await db.guest.findUnique({
      where: { id: guestId },
      select: { firstName: true, lastName: true },
    });
    guestName = g ? [g.firstName, g.lastName].filter(Boolean).join(" ") : null;
  }
  await audit(user, {
    action: guestId ? "assign" : "unassign",
    entity: "Seat",
    entityId: seatId,
    metadata: {
      guestId,
      guestName,
      tableName,
      seatIndex,
    },
  });
  revalidatePath("/seating");
}

// v1.23.0: per-table notes — free-form text. Empty string clears.
const notesSchema = z.string().max(2000);
export async function updateTableNotes(id: string, notes: string) {
  const user = await requireEdit("seating");
  const parsed = notesSchema.parse(notes);
  const updated = await db.table.update({
    where: { id },
    data: { notes: parsed === "" ? null : parsed },
  });
  await audit(user, {
    action: "notes",
    entity: "Table",
    entityId: id,
    metadata: {
      tableName: updated.name,
      notesLength: parsed.length,
      cleared: parsed === "",
    },
  });
  revalidatePath("/seating");
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
// Used by the TableCard drag-to-reorder UI. Sequential ops in a single
// $transaction (null-out both, then re-assign) avoid tripping the
// Guest.tableSeatId unique constraint.
export type SwapResult = { ok: true } | { ok: false; error: string };

export async function swapSeats(seatId1: string, seatId2: string): Promise<SwapResult> {
  if (seatId1 === seatId2) return { ok: true };
  const user = await requireEdit("seating");

  const [seat1, seat2] = await Promise.all([
    db.seat.findUnique({
      where: { id: seatId1 },
      select: {
        index: true,
        tableId: true,
        table: { select: { name: true } },
        guest: { select: { id: true } },
      },
    }),
    db.seat.findUnique({
      where: { id: seatId2 },
      select: {
        index: true,
        tableId: true,
        guest: { select: { id: true } },
      },
    }),
  ]);

  if (!seat1 || !seat2) return { ok: false, error: "Seat not found" };
  if (seat1.tableId !== seat2.tableId) return { ok: false, error: "Seats must be on the same table" };

  const guest1 = seat1.guest;
  const guest2 = seat2.guest;
  if (!guest1 && !guest2) return { ok: true };

  // Null out both occupants first, then assign to swapped seats.
  // Sequential within one $transaction satisfies the unique constraint
  // at each step without needing deferred constraints.
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (guest1) ops.push(db.guest.update({ where: { id: guest1.id }, data: { tableSeatId: null } }));
  if (guest2) ops.push(db.guest.update({ where: { id: guest2.id }, data: { tableSeatId: null } }));
  if (guest1) ops.push(db.guest.update({ where: { id: guest1.id }, data: { tableSeatId: seatId2 } }));
  if (guest2) ops.push(db.guest.update({ where: { id: guest2.id }, data: { tableSeatId: seatId1 } }));
  await db.$transaction(ops);

  await audit(user, {
    action: "swap",
    entity: "Seat",
    entityId: seatId1,
    metadata: {
      tableName: seat1.table.name,
      seatIndex1: seat1.index,
      seatIndex2: seat2.index,
      guest1Id: guest1?.id ?? null,
      guest2Id: guest2?.id ?? null,
    },
  });

  revalidatePath("/seating");
  return { ok: true };
}
