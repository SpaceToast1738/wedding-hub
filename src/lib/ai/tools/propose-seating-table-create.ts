import { z } from "zod";
import { db } from "@/lib/db";
import { TABLE_SHAPES, seatingTableCreateSchema } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// v2.8.1 (Tier 2, Slice 3): add a reception table. Bridges to the
// seating.table.create apply handler (src/lib/ai/apply/misc.ts) →
// createTableCore, which creates the Table plus `capacity` empty Seats
// and auto-places it on the canvas (nextGridPosition) — the payload never
// carries coordinates. Guests are seated separately with
// propose_seat_assign.
const inputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .describe('Table name, e.g. "Top table" or "Table 5".'),
  shape: z
    .enum(TABLE_SHAPES)
    .optional()
    .describe("Table shape: ROUND (default), RECTANGLE or HEAD."),
  capacity: z
    .number()
    .int()
    .min(1)
    .max(40)
    .describe("Number of empty seats to create (1–40)."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this table is needed. Shown to the couple.",
    ),
});

export const proposeSeatingTableCreate: AiTool<typeof inputSchema> = {
  name: "propose_seating_table_create",
  description:
    "Propose adding a new reception table with a given number of empty seats. The table drops into the next free slot on the seating canvas automatically — you do NOT set coordinates. Shape is ROUND, RECTANGLE or HEAD (default ROUND). Guests are seated separately with propose_seat_assign after the table exists.",
  inputSchema,
  progressLabel: "Proposing new table…",
  definition: {
    name: "propose_seating_table_create",
    description:
      "Propose a new reception table with N empty seats (auto-placed on the canvas). Shape ROUND|RECTANGLE|HEAD, default ROUND. Seat guests separately with propose_seat_assign.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Table name." },
        shape: {
          type: "string",
          enum: [...TABLE_SHAPES],
          description: "Table shape (default ROUND).",
        },
        capacity: {
          type: "integer",
          minimum: 1,
          maximum: 40,
          description: "Number of empty seats to create (1–40).",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this table is needed.",
        },
      },
      required: ["name", "capacity", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    // No refs to resolve — a table is created fresh. safeParse applies the
    // shape default so the summary + apply both see a concrete shape.
    const payloadResult = seatingTableCreateSchema.safeParse({
      name: input.name,
      shape: input.shape ?? "ROUND",
      capacity: input.capacity,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "seating.table.create",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "seating.table.create",
        title: `New table "${input.name}"`,
        detail: `${payloadResult.data.capacity} seat(s) · ${payloadResult.data.shape}`,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
