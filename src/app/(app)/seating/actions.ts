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
  // Position changes happen often during drag — audit but don't revalidate
  // every time. The page already revalidates on assign / create / delete,
  // and the canvas updates locally in the meantime.
  await audit(user, {
    action: "position",
    entity: "Table",
    entityId: id,
    metadata: { posX: parsed.posX, posY: parsed.posY, rotation: parsed.rotation },
  });
}

export async function assignGuestToSeat(seatId: string, guestId: string | null) {
  const user = await requireEdit("seating");
  if (guestId) {
    // Unassign any other seat this guest had
    await db.guest.updateMany({
      where: { tableSeatId: seatId, NOT: { id: guestId } },
      data: { tableSeatId: null },
    });
    await db.guest.update({ where: { id: guestId }, data: { tableSeatId: seatId } });
  } else {
    await db.guest.updateMany({ where: { tableSeatId: seatId }, data: { tableSeatId: null } });
  }
  await audit(user, { action: "assign", entity: "Seat", entityId: seatId, metadata: { guestId } });
  revalidatePath("/seating");
}
