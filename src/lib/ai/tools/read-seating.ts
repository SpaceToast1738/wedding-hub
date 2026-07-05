// v2.4.0: reception seating read — tables, seats (with ids), who sits
// where, and which attending guests still have no seat. Seat ids are
// the currency for seat.assign proposals; the assign action silently
// evicts a seat's current occupant, so the propose tool restricts
// itself to seats this tool reports as empty.

import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import type { AiTool } from "./types";

const inputSchema = z.object({});

function guestName(g: { firstName: string; lastName: string }): string {
  return `${g.firstName} ${g.lastName}`.trim();
}

export const readSeating: AiTool<typeof inputSchema> = {
  name: "read_seating",
  description:
    "Read the reception seating plan — every table (name, shape, capacity, notes) with its seats in index order, each seat's occupant (name, dietary, child flag) or null when empty, plus totals: capacity, seated count, attending-guest count, and the attending guests who don't have a seat yet. seatIds are the currency for propose_seat_assign — only propose EMPTY seats; assigning an occupied seat would evict whoever is in it.",
  inputSchema,
  progressLabel: "Reading the seating plan…",
  definition: {
    name: "read_seating",
    description:
      "Read the reception seating plan: tables, seats with occupants, and unseated attending guests. seatIds are the currency for propose_seat_assign — only propose EMPTY seats.",
    input_schema: { type: "object", properties: {} },
  },
  async handler(_input, ctx) {
    if (!(await canView(ctx.user, "seating"))) {
      return { ok: false, error: "The seating plan isn't visible to this user." };
    }

    const [tables, attendingGuests, unseated] = await Promise.all([
      db.table.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          shape: true,
          capacity: true,
          notes: true,
          seats: {
            orderBy: { index: "asc" },
            select: {
              id: true,
              index: true,
              guest: {
                select: { id: true, firstName: true, lastName: true, dietary: true, isChild: true },
              },
            },
          },
        },
      }),
      db.guest.count({ where: { archived: false, rsvp: "ATTENDING" } }),
      db.guest.findMany({
        where: { archived: false, rsvp: "ATTENDING", tableSeatId: null },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: 200,
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);

    let totalCapacity = 0;
    let totalSeated = 0;
    const tableRows = tables.map((t) => {
      const seatedCount = t.seats.filter((s) => s.guest !== null).length;
      totalCapacity += t.capacity;
      totalSeated += seatedCount;
      return {
        tableId: t.id,
        name: t.name,
        shape: t.shape,
        capacity: t.capacity,
        seatedCount,
        notes: t.notes
          ? t.notes.length > 500
            ? t.notes.slice(0, 500) + "…"
            : t.notes
          : null,
        seats: t.seats.map((s) => ({
          seatId: s.id,
          index: s.index,
          guest: s.guest
            ? {
                guestId: s.guest.id,
                name: guestName(s.guest),
                dietary: s.guest.dietary,
                isChild: s.guest.isChild,
              }
            : null,
        })),
      };
    });

    return {
      ok: true,
      data: {
        tables: tableRows,
        totals: {
          totalCapacity,
          totalSeated,
          attendingGuests,
          unseatedAttending: unseated.map((g) => ({
            guestId: g.id,
            name: guestName(g),
          })),
        },
      },
    };
  },
};
