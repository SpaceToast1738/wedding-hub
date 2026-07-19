import { z } from "zod";
import { db } from "@/lib/db";
import { seatingTableDeleteSchema } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import {
  clipDisplay,
  DELETE_PROPOSED_MESSAGE,
  reasonFromRationale,
} from "./propose-delete-common";
import type { AiTool } from "./types";

// v2.8.0: destructive kind. Bridges to the seating.table.delete apply
// handler (src/lib/ai/apply/deletes.ts) — a PERMANENT delete of the
// table and its seats. Guests are NEVER deleted: occupants land back
// in the unseated pool, and the snapshot records who sat where so the
// arrangement is restorable by hand.
const inputSchema = z.object({
  tableId: z
    .string()
    .min(1)
    .describe("The id of the table to delete — get this from a prior read_seating call."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this table should be permanently deleted. Shown to the couple.",
    ),
});

export const proposeSeatingTableDelete: AiTool<typeof inputSchema> = {
  name: "propose_seating_table_delete",
  description:
    "Propose PERMANENTLY deleting a seating table. This is destructive: applying removes the table and all of its seats for good (a JSON snapshot — including who sat where — is kept on the proposal for manual recovery, but there is no undo button). Guests are never deleted: anyone seated at the table becomes unseated and must be re-seated elsewhere. Check the occupancy with read_seating first and re-seat (or plan to re-seat) the occupants — deleting a full table mid-plan creates work for the couple. Requires a tableId from read_seating.",
  inputSchema,
  progressLabel: "Proposing table delete…",
  definition: {
    name: "propose_seating_table_delete",
    description:
      "Propose permanently deleting a seating table and its seats (snapshot-backed, no undo). Seated guests are kept but become unseated. Requires tableId from a prior read_seating call.",
    input_schema: {
      type: "object",
      properties: {
        tableId: { type: "string", description: "From read_seating output." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this table should be deleted.",
        },
      },
      required: ["tableId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const table = await db.table.findUnique({
      where: { id: input.tableId },
      select: {
        name: true,
        capacity: true,
        seats: { select: { guest: { select: { id: true } } } },
      },
    });
    if (!table) {
      // No table family in resolveRefs — same prefix style, hand-rolled.
      return {
        ok: false,
        error: `Unknown ids: table:${input.tableId}. Use ids from a read tool — never invent ids.`,
      };
    }
    const occupiedCount = table.seats.filter((s) => s.guest).length;

    const payloadResult = seatingTableDeleteSchema.safeParse({
      tableId: input.tableId,
      targetLabel: clipDisplay(table.name, 200),
      reason: reasonFromRationale(input.rationale),
    });
    if (!payloadResult.success) {
      return {
        ok: false,
        error: `Payload validation failed: ${payloadResult.error.message}`,
      };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "seating.table.delete",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detailBits = [
      `${table.capacity} seat(s)`,
      occupiedCount
        ? `${occupiedCount} seated guest(s) become UNSEATED (kept, not deleted)`
        : "no one is seated here",
      "permanent — snapshot kept",
    ];

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "seating.table.delete",
        title: `Delete table "${table.name}"`,
        detail: detailBits.join(" · "),
        message: DELETE_PROPOSED_MESSAGE,
      },
    };
  },
};
