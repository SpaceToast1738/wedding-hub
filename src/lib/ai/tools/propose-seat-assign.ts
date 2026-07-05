import { z } from "zod";
import { db } from "@/lib/db";
import { seatAssignSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = z.object({
  seatId: z
    .string()
    .min(1)
    .describe("Seat id — get this from read_seating, never invent one."),
  guestId: z.string().min(1).describe("Guest id from read_guests / read_seating."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this seat suits this guest."),
});

export const proposeSeatAssign: AiTool<typeof inputSchema> = {
  name: "propose_seat_assign",
  description:
    "Propose seating a guest at a specific reception seat. Requires a seatId from read_seating. Only EMPTY seats are proposable — the underlying action would silently evict the current occupant, so occupied seats are refused outright. The guest must be ATTENDING and not archived. If the guest is already seated elsewhere, applying MOVES them. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing seat assignment…",
  definition: {
    name: "propose_seat_assign",
    description:
      "Propose seating an ATTENDING guest at an empty reception seat. Occupied seats are refused; a guest already seated elsewhere is moved.",
    input_schema: {
      type: "object",
      properties: {
        seatId: { type: "string", description: "Seat id from read_seating." },
        guestId: { type: "string", description: "Guest id. Must be ATTENDING and not archived." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this seat suits this guest.",
        },
      },
      required: ["seatId", "guestId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const [seat, targetGuest] = await Promise.all([
      db.seat.findUnique({
        where: { id: input.seatId },
        select: {
          index: true,
          table: { select: { name: true } },
          guest: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      db.guest.findUnique({
        where: { id: input.guestId },
        select: {
          firstName: true,
          lastName: true,
          archived: true,
          rsvp: true,
          tableSeat: {
            select: { id: true, index: true, table: { select: { name: true } } },
          },
        },
      }),
    ]);

    const invalid: string[] = [];
    if (!seat) invalid.push(`seat:${input.seatId}`);
    if (!targetGuest) invalid.push(`guest:${input.guestId}`);
    if (invalid.length || !seat || !targetGuest) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    // Seats display 1-based everywhere in the seating UI (#{index+1}).
    const seatLabel = `seat ${seat.index + 1}`;
    const guestName = `${targetGuest.firstName} ${targetGuest.lastName}`.trim();

    if (targetGuest.archived) {
      return {
        ok: false,
        error: `${guestName} is archived — the couple would need to restore them before seating.`,
      };
    }
    if (targetGuest.rsvp !== "ATTENDING") {
      return {
        ok: false,
        error: `${guestName} hasn't confirmed — their RSVP is ${targetGuest.rsvp}. Only ATTENDING guests can be seated.`,
      };
    }
    if (seat.guest && seat.guest.id === input.guestId) {
      return {
        ok: false,
        error: `${guestName} is already at ${seat.table.name} ${seatLabel} — nothing to change.`,
      };
    }
    // assignGuestToSeat silently evicts whoever holds the seat —
    // refusing occupied seats here (and again in the apply bridge)
    // keeps that eviction path unreachable through the AI.
    if (seat.guest) {
      const occupant = `${seat.guest.firstName} ${seat.guest.lastName}`.trim();
      return {
        ok: false,
        error: `Seat ${seat.index + 1} at ${seat.table.name} is taken by ${occupant} — pick an empty seat or ask the couple to move them.`,
      };
    }

    const payloadResult = seatAssignSchema.safeParse({
      seatId: input.seatId,
      guestId: input.guestId,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "seat.assign",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const moving =
      targetGuest.tableSeat && targetGuest.tableSeat.id !== input.seatId
        ? `moves them from ${targetGuest.tableSeat.table.name} (seat ${targetGuest.tableSeat.index + 1})`
        : undefined;

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "seat.assign",
        title: `${guestName} → ${seat.table.name} ${seatLabel}`,
        detail: moving,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
