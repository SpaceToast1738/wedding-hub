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

export async function createTable(formData: FormData) {
  const user = await requireEdit("seating");
  const parsed = tableSchema.parse({
    name: formData.get("name"),
    shape: formData.get("shape") || TableShape.ROUND,
    capacity: formData.get("capacity") || 8,
  });
  const table = await db.table.create({
    data: { name: parsed.name, shape: parsed.shape, capacity: parsed.capacity },
  });
  // Auto-create seats
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
