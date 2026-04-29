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
  await audit(user, { action: "create", entity: "Table", entityId: table.id });
  revalidatePath("/seating");
}

export async function deleteTable(id: string) {
  const user = await requireEdit("seating");
  await db.table.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "Table", entityId: id });
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
  await audit(user, { action: "assign", entity: "Seat", entityId: seatId, metadata: { guestId } });
  revalidatePath("/seating");
}

// v1.23.0: per-table notes — free-form text. Empty string clears.
const notesSchema = z.string().max(2000);
export async function updateTableNotes(id: string, notes: string) {
  const user = await requireEdit("seating");
  const parsed = notesSchema.parse(notes);
  await db.table.update({ where: { id }, data: { notes: parsed === "" ? null : parsed } });
  await audit(user, { action: "notes", entity: "Table", entityId: id });
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
  await db.table.update({
    where: { id },
    data: {
      checklist:
        parsed.length === 0 ? Prisma.JsonNull : (parsed as Prisma.InputJsonValue),
    },
  });
  await audit(user, { action: "checklist", entity: "Table", entityId: id });
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
  await audit(user, { action: "seating-checklist", entity: "WeddingSettings", entityId: "1" });
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
  await audit(user, { action: "seating-notes", entity: "WeddingSettings", entityId: "1" });
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
    await audit(user, { action: "update", entity: "CeremonySeating", entityId: "1" });
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
