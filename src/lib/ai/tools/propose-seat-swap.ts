import { z } from "zod";
import { db } from "@/lib/db";
import { seatSwapSchema } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// v2.8.1 (Tier 2, Slice 3): swap two seats' occupants. Bridges to the
// seat.swap apply handler (src/lib/ai/apply/misc.ts) → swapSeatsCore.
// Same-table only, and no bystander is ever evicted — the two guests
// simply exchange places (if one seat is empty, the seated guest moves
// into it). Cross-table, identical and both-empty pairs are refused.
const inputSchema = z.object({
  seatId1: z.string().min(1).describe("First seat id from read_seating."),
  seatId2: z
    .string()
    .min(1)
    .describe("Second seat id from read_seating — MUST be at the same table as seatId1."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY the two guests should swap places. Shown to the couple.",
    ),
});

export const proposeSeatSwap: AiTool<typeof inputSchema> = {
  name: "propose_seat_swap",
  description:
    "Propose swapping the occupants of two seats AT THE SAME TABLE. Both seats must belong to the same table; cross-table swaps, identical seats and two empty seats are refused. No bystander is evicted — the two guests exchange places (if one seat is empty, the seated guest simply moves into it). To move a guest to a DIFFERENT table, use propose_seat_unassign then propose_seat_assign instead. Requires two seatIds from read_seating.",
  inputSchema,
  progressLabel: "Proposing seat swap…",
  definition: {
    name: "propose_seat_swap",
    description:
      "Propose swapping two seats' occupants (same table only). Cross-table / identical / both-empty pairs are refused. Requires two seatIds from a prior read_seating call.",
    input_schema: {
      type: "object",
      properties: {
        seatId1: { type: "string", description: "First seat id from read_seating." },
        seatId2: {
          type: "string",
          description: "Second seat id — must be at the same table as seatId1.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why the two guests should swap.",
        },
      },
      required: ["seatId1", "seatId2", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    if (input.seatId1 === input.seatId2) {
      return {
        ok: false,
        error: "Both seat ids are the same — pick two different seats to swap.",
      };
    }

    const [seat1, seat2] = await Promise.all([
      db.seat.findUnique({
        where: { id: input.seatId1 },
        select: {
          index: true,
          tableId: true,
          table: { select: { name: true } },
          guest: { select: { firstName: true, lastName: true } },
        },
      }),
      db.seat.findUnique({
        where: { id: input.seatId2 },
        select: {
          index: true,
          tableId: true,
          guest: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const invalid: string[] = [];
    if (!seat1) invalid.push(`seat:${input.seatId1}`);
    if (!seat2) invalid.push(`seat:${input.seatId2}`);
    if (invalid.length || !seat1 || !seat2) {
      return {
        ok: false,
        error: `Unknown ids: ${invalid.join(", ")}. Use seatIds from read_seating — never invent ids.`,
      };
    }

    if (seat1.tableId !== seat2.tableId) {
      return {
        ok: false,
        error:
          "Those seats are at different tables — swaps only work within one table. Use propose_seat_unassign + propose_seat_assign to move a guest across tables.",
      };
    }
    if (!seat1.guest && !seat2.guest) {
      return { ok: false, error: "Both seats are empty — nothing to swap." };
    }

    const payloadResult = seatSwapSchema.safeParse({
      seatId1: input.seatId1,
      seatId2: input.seatId2,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "seat.swap",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const name1 = seat1.guest
      ? `${seat1.guest.firstName} ${seat1.guest.lastName}`.trim()
      : "(empty)";
    const name2 = seat2.guest
      ? `${seat2.guest.firstName} ${seat2.guest.lastName}`.trim()
      : "(empty)";

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "seat.swap",
        title: `Swap seats at ${seat1.table.name}`,
        detail: `${name1} (seat ${seat1.index + 1}) ↔ ${name2} (seat ${seat2.index + 1})`,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
