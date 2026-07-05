import { z } from "zod";
import { supplierUpdateSchema, SUPPLIER_STATUSES } from "@/lib/ai/proposals/schemas";
import { db } from "@/lib/db";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import type { AiTool } from "./types";

// `name` is deliberately NOT exposed here — a supplier's name is the
// primary human-facing label used everywhere it's referenced (task
// "supplier:" chips, communication logs). If the AI ever resolves the
// wrong supplierId, "correcting" the name silently relabels the wrong
// vendor — a worse, quieter failure than a wrong status. Renaming a
// supplier isn't a normal part of the planning workflow anyway.
const inputSchema = z.object({
  supplierId: z
    .string()
    .min(1)
    .describe("The id of the supplier to update — get this from a prior read_suppliers call."),
  category: z.string().min(1).max(100).optional(),
  status: z.enum(SUPPLIER_STATUSES).optional(),
  website: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this update makes sense. Shown to the couple."),
});

export const proposeSupplierUpdate: AiTool<typeof inputSchema> = {
  name: "propose_supplier_update",
  description:
    "Propose an update to an existing supplier — status, category, website, or notes. Only include what you want changed. You MUST call read_suppliers first so you have a valid supplierId. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing supplier update…",
  definition: {
    name: "propose_supplier_update",
    description:
      "Propose a partial update to an existing supplier. Only include fields you want changed. Requires supplierId from a prior read_suppliers call.",
    input_schema: {
      type: "object",
      properties: {
        supplierId: { type: "string", description: "From read_suppliers output." },
        category: { type: "string" },
        status: {
          type: "string",
          enum: [...SUPPLIER_STATUSES],
          description: "e.g. move from SHORTLIST to BOOKED once confirmed.",
        },
        website: { type: "string" },
        notes: { type: "string" },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this update makes sense.",
        },
      },
      required: ["supplierId", "rationale"],
    },
  },
  async handler(input, ctx) {
    if (!ctx.canWrite) {
      return {
        ok: false,
        error: "You don't have permission to write proposals. Ask the couple for ai_write access.",
      };
    }

    const { invalid, names } = await resolveRefs({ supplierIds: [input.supplierId] });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    const patch: Record<string, unknown> = { supplierId: input.supplierId };
    if (input.category !== undefined) patch.category = input.category;
    if (input.status !== undefined) patch.status = input.status;
    if (input.website !== undefined) patch.website = input.website;
    if (input.notes !== undefined) patch.notes = input.notes;

    // A patch with only supplierId is an empty, un-actionable proposal
    // — reject it, same guard as propose_task_update.
    if (Object.keys(patch).length === 1) {
      return {
        ok: false,
        error:
          "The update contains no changes. Include at least one field to change (category, status, website, or notes).",
      };
    }

    const payloadResult = supplierUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "supplier.update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "supplier.update",
        title: `Update "${names.suppliers.get(input.supplierId)}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
