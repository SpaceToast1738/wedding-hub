import { z } from "zod";
import { db } from "@/lib/db";
import { seatUnassignSchema } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// v2.8.1 (Tier 2, Slice 3): clear a seat. Bridges to the seat.unassign
// apply handler (src/lib/ai/apply/misc.ts) → unassignSeatCore, which
// frees the seat's occupant back into the unseated pool. NOT destructive:
// the guest is not removed or archived, just unseated. Already-empty
// seats are refused (nothing to do).
const inputSchema = z.object({
  seatId: z
    .string()
    .min(1)
    .describe("Seat id from read_seating — the seat to clear. Never invent one."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY the guest at this seat should be unseated. Shown to the couple.",
    ),
});

export const proposeSeatUnassign: AiTool<typeof inputSchema> = {
  name: "propose_seat_unassign",
  description:
    "Propose clearing a reception seat — unseat whoever is sitting there. The guest returns to the unseated pool; they are NOT removed or archived. Requires a seatId from read_seating. Empty seats are refused (nothing to do). Use this to free a seat before re-seating someone, or to take a guest off a table.",
  inputSchema,
  progressLabel: "Proposing unseat…",
  definition: {
    name: "propose_seat_unassign",
    description:
      "Propose unseating the guest at a specific seat (they become unseated, not deleted). Empty seats are refused. Requires seatId from a prior read_seating call.",
    input_schema: {
      type: "object",
      properties: {
        seatId: { type: "string", description: "Seat id from read_seating." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why the guest should be unseated.",
        },
      },
      required: ["seatId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const seat = await db.seat.findUnique({
      where: { id: input.seatId },
      select: {
        index: true,
        table: { select: { name: true } },
        guest: { select: { firstName: true, lastName: true } },
      },
    });
    if (!seat) {
      // No seat family in resolveRefs — same prefix style, hand-rolled.
      return {
        ok: false,
        error: `Unknown ids: seat:${input.seatId}. Use a seatId from read_seating — never invent ids.`,
      };
    }
    if (!seat.guest) {
      return {
        ok: false,
        error: `Seat ${seat.index + 1} at ${seat.table.name} is already empty — nothing to unseat.`,
      };
    }
    const guestName = `${seat.guest.firstName} ${seat.guest.lastName}`.trim();

    const payloadResult = seatUnassignSchema.safeParse({ seatId: input.seatId });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "seat.unassign",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "seat.unassign",
        title: `Unseat ${guestName}`,
        detail: `from ${seat.table.name} (seat ${seat.index + 1}) — they return to the unseated pool`,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
