"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TableShape } from "@prisma/client";
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
  } else {
    // Shrink. Bail if any trailing seat is occupied — the planner needs
    // to unseat first so the action is never destructive of assignments.
    const toRemove = table.seats.filter((s) => s.index >= target);
    const occupied = toRemove.filter((s) => s.guest).length;
    if (occupied > 0) {
      return {
        ok: false,
        error: `Can't shrink to ${target}: ${occupied} seat${occupied === 1 ? "" : "s"} above #${target} ${occupied === 1 ? "is" : "are"} still assigned. Unseat first.`,
      };
    }
    await db.seat.deleteMany({
      where: { tableId: id, index: { gte: target } },
    });
  }
  await db.table.update({ where: { id }, data: { capacity: target } });
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
