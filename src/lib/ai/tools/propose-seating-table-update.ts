import { z } from "zod";
import { db } from "@/lib/db";
import { seatingTableUpdateSchema } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// v2.8.1 (Tier 2, Slice 3): edit an existing table's capacity, canvas
// position, rotation or notes. Bridges to the seating.table.update apply
// handler (src/lib/ai/apply/misc.ts). Name + shape are intentionally NOT
// editable (no clean human mutator exists for them). Shrinking capacity
// below the number of seated guests is refused at apply-time (no silent
// eviction); this tool also warns at propose-time.
const inputSchema = z.object({
  tableId: z.string().min(1).describe("Table id from read_seating."),
  capacity: z
    .number()
    .int()
    .min(1)
    .max(40)
    .optional()
    .describe("New seat count (1–40). Shrinking below the seated count is refused."),
  posX: z
    .number()
    .min(0)
    .max(5000)
    .optional()
    .describe("New X position on the canvas. MUST be sent together with posY."),
  posY: z
    .number()
    .min(0)
    .max(5000)
    .optional()
    .describe("New Y position on the canvas. MUST be sent together with posX."),
  rotation: z
    .number()
    .min(-360)
    .max(720)
    .optional()
    .describe("New rotation in degrees — only applied alongside a posX/posY move."),
  notes: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .describe("Per-table notes. An empty string or null clears them."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this table changes. Shown to the couple.",
    ),
});

export const proposeSeatingTableUpdate: AiTool<typeof inputSchema> = {
  name: "propose_seating_table_update",
  description:
    "Propose editing an existing table's capacity, canvas position, rotation or notes. Name and shape are NOT editable here. Shrinking capacity below the number of seated guests is refused (no silent eviction) — unseat guests first with propose_seat_unassign. Position: send posX and posY together; rotation only takes effect alongside a position change. At least one editable field must be set. Requires a tableId from read_seating.",
  inputSchema,
  progressLabel: "Proposing table update…",
  definition: {
    name: "propose_seating_table_update",
    description:
      "Propose editing a table's capacity / position / rotation / notes (NOT name or shape). Shrinking below the seated count is refused. Send posX+posY together. Requires tableId from a prior read_seating call.",
    input_schema: {
      type: "object",
      properties: {
        tableId: { type: "string", description: "Table id from read_seating." },
        capacity: {
          type: "integer",
          minimum: 1,
          maximum: 40,
          description: "New seat count (1–40).",
        },
        posX: { type: "number", description: "New X position (send together with posY)." },
        posY: { type: "number", description: "New Y position (send together with posX)." },
        rotation: {
          type: "number",
          description: "Rotation in degrees (only applied with a position change).",
        },
        notes: {
          type: ["string", "null"],
          description: "Per-table notes; empty string or null clears them.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining the change.",
        },
      },
      required: ["tableId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const hasField =
      input.capacity !== undefined ||
      input.posX !== undefined ||
      input.posY !== undefined ||
      input.rotation !== undefined ||
      input.notes !== undefined;
    if (!hasField) {
      return {
        ok: false,
        error:
          "Nothing to change — set at least one of capacity, posX+posY, rotation or notes.",
      };
    }
    if ((input.posX === undefined) !== (input.posY === undefined)) {
      return {
        ok: false,
        error: "posX and posY must be provided together to move a table.",
      };
    }

    const table = await db.table.findUnique({
      where: { id: input.tableId },
      select: {
        name: true,
        seats: { select: { guest: { select: { id: true } } } },
      },
    });
    if (!table) {
      // No table family in resolveRefs — same prefix style, hand-rolled.
      return {
        ok: false,
        error: `Unknown ids: table:${input.tableId}. Use a tableId from read_seating — never invent ids.`,
      };
    }
    const occupiedCount = table.seats.filter((s) => s.guest).length;
    if (input.capacity !== undefined && input.capacity < occupiedCount) {
      return {
        ok: false,
        error: `Can't shrink "${table.name}" to ${input.capacity}: ${occupiedCount} guest(s) are seated there. Unseat ${occupiedCount - input.capacity} first with propose_seat_unassign.`,
      };
    }

    const payloadResult = seatingTableUpdateSchema.safeParse({
      tableId: input.tableId,
      ...(input.capacity !== undefined && { capacity: input.capacity }),
      ...(input.posX !== undefined && { posX: input.posX }),
      ...(input.posY !== undefined && { posY: input.posY }),
      ...(input.rotation !== undefined && { rotation: input.rotation }),
      ...(input.notes !== undefined && { notes: input.notes }),
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "seating.table.update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const bits: string[] = [];
    if (input.capacity !== undefined) bits.push(`capacity → ${input.capacity}`);
    if (input.posX !== undefined && input.posY !== undefined) bits.push("moves the table");
    if (input.rotation !== undefined) bits.push(`rotation → ${input.rotation}°`);
    if (input.notes !== undefined) bits.push(input.notes ? "sets notes" : "clears notes");

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "seating.table.update",
        title: `Update table "${table.name}"`,
        detail: bits.join(", "),
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
