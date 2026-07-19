// v2.4.0: reception seating read — tables, seats (with ids), who sits
// where, and which attending guests still have no seat. Seat ids are
// the currency for seat.assign proposals; the assign action silently
// evicts a seat's current occupant, so the propose tool restricts
// itself to seats this tool reports as empty.
//
// v2.8.1 (Tier 2, Slice B): enrichment + pagination.
//   - plan: the wedding-wide seating notes + day-of checklist.
//   - ceremony: the CeremonySeating singleton (aisle layout) + the
//     per-row group assignments (CeremonyRow).
//   - tables are now PAGED (offset/limit) so a big plan doesn't blow the
//     24k tool-result cap. Totals (capacity, seated, attending, unseated)
//     stay computed across ALL tables; pageCapacity/pageSeated describe
//     just the returned page.

import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import type { AiTool } from "./types";

const DEFAULT_LIMIT = 10;

const inputSchema = z.object({
  offset: z.number().int().min(0).optional().describe("Skip this many tables (default 0)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe(`Max tables to return per page (default ${DEFAULT_LIMIT}).`),
});

function guestName(g: { firstName: string; lastName: string }): string {
  return `${g.firstName} ${g.lastName}`.trim();
}

function clip(s: string | null | undefined, n: number): string | null {
  if (!s) return null;
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export const readSeating: AiTool<typeof inputSchema> = {
  name: "read_seating",
  description:
    "Read the reception seating plan — a page of tables (name, shape, capacity, notes) with their seats in index order, each seat's occupant (name, dietary, child flag) or null when empty. Also returns plan-wide seating notes + day-of checklist, the ceremony aisle layout with per-row group assignments, and totals across ALL tables: capacity, seated count, attending-guest count, and the attending guests still without a seat. Tables are paged — pass offset/limit and follow nextOffset for the rest. seatIds are the currency for propose_seat_assign — only propose EMPTY seats; assigning an occupied seat would evict whoever is in it.",
  inputSchema,
  progressLabel: "Reading the seating plan…",
  definition: {
    name: "read_seating",
    description:
      "Read the reception seating plan: a page of tables (offset/limit → nextOffset) with seats + occupants, plan notes/checklist, ceremony layout + row assignments, and totals across all tables including unseated attending guests. seatIds are the currency for propose_seat_assign — only propose EMPTY seats.",
    input_schema: {
      type: "object",
      properties: {
        offset: { type: "integer", minimum: 0, description: "Skip this many tables (default 0)." },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          description: `Max tables per page (default ${DEFAULT_LIMIT}).`,
        },
      },
    },
  },
  async handler(input, ctx) {
    if (!(await canView(ctx.user, "seating"))) {
      return { ok: false, error: "The seating plan isn't visible to this user." };
    }

    const offset = input.offset ?? 0;
    const limit = input.limit ?? DEFAULT_LIMIT;

    const [
      tables,
      totalTables,
      capacityAgg,
      totalSeated,
      attendingGuests,
      unseated,
      weddingSettings,
      ceremony,
      ceremonyRows,
    ] = await Promise.all([
      db.table.findMany({
        orderBy: { createdAt: "asc" },
        skip: offset,
        take: limit,
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
      db.table.count(),
      db.table.aggregate({ _sum: { capacity: true } }),
      // Occupied seats across ALL tables == attending-or-not guests
      // pointing at a seat (tableSeatId is @unique on Guest, so this is
      // exactly the seated-seat count).
      db.guest.count({ where: { tableSeatId: { not: null } } }),
      db.guest.count({ where: { archived: false, rsvp: "ATTENDING" } }),
      db.guest.findMany({
        where: { archived: false, rsvp: "ATTENDING", tableSeatId: null },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: 200,
        select: { id: true, firstName: true, lastName: true },
      }),
      db.weddingSettings.findUnique({
        where: { id: 1 },
        select: { seatingNotes: true, seatingChecklist: true },
      }),
      db.ceremonySeating.findUnique({ where: { id: 1 } }),
      db.ceremonyRow.findMany({
        orderBy: [{ side: "asc" }, { rowIndex: "asc" }],
        select: {
          side: true,
          rowIndex: true,
          notes: true,
          guestGroup: { select: { name: true, colour: true } },
        },
      }),
    ]);

    let pageCapacity = 0;
    let pageSeated = 0;
    const tableRows = tables.map((t) => {
      const seatedCount = t.seats.filter((s) => s.guest !== null).length;
      pageCapacity += t.capacity;
      pageSeated += seatedCount;
      return {
        tableId: t.id,
        name: t.name,
        shape: t.shape,
        capacity: t.capacity,
        seatedCount,
        notes: clip(t.notes, 500),
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

    const nextOffset = offset + limit < totalTables ? offset + limit : null;

    return {
      ok: true,
      data: {
        tables: tableRows,
        page: {
          offset,
          limit,
          totalTables,
          nextOffset,
          pageCapacity,
          pageSeated,
        },
        totals: {
          totalCapacity: capacityAgg._sum.capacity ?? 0,
          totalSeated,
          attendingGuests,
          unseatedAttending: unseated.map((g) => ({
            guestId: g.id,
            name: guestName(g),
          })),
        },
        // Plan-wide seating notes + day-of checklist (from WeddingSettings).
        plan: {
          notes: clip(weddingSettings?.seatingNotes, 500),
          checklist: weddingSettings?.seatingChecklist ?? null,
        },
        // Ceremony aisle layout + per-row group assignments. Null when the
        // singleton hasn't been configured yet.
        ceremony: ceremony
          ? {
              leftRows: ceremony.leftRows,
              leftSeatsPerRow: ceremony.leftSeatsRow,
              rightRows: ceremony.rightRows,
              rightSeatsPerRow: ceremony.rightSeatsRow,
              notes: clip(ceremony.notes, 500),
              rows: ceremonyRows.map((r) => ({
                side: r.side,
                rowIndex: r.rowIndex,
                group: r.guestGroup?.name ?? null,
                colour: r.guestGroup?.colour ?? null,
                notes: clip(r.notes, 200),
              })),
            }
          : null,
      },
    };
  },
};
