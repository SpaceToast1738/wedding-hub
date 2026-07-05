import { z } from "zod";
import { db } from "@/lib/db";
import { supplierCreateSchema, SUPPLIER_STATUSES } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  status: z.enum(SUPPLIER_STATUSES).optional(),
  website: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this supplier belongs on the plan. Shown to the couple in the review UI.",
    ),
});

export const proposeSupplierCreate: AiTool<typeof inputSchema> = {
  name: "propose_supplier_create",
  description:
    "Propose a new supplier/vendor for the couple to review. **This does NOT create the supplier** — it writes a proposal the couple will Apply, Edit, or Dismiss. Call read_suppliers first to make sure this vendor isn't already shortlisted. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing supplier…",
  definition: {
    name: "propose_supplier_create",
    description:
      "Propose a new supplier/vendor. Writes a proposal — does not create the row directly. Check read_suppliers first to avoid duplicates.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Vendor/business name." },
        category: { type: "string", description: "e.g. 'venue', 'photographer', 'florist'." },
        status: {
          type: "string",
          enum: [...SUPPLIER_STATUSES],
          description: "Booking status. SHORTLIST by default.",
        },
        website: { type: "string", description: "Optional URL." },
        notes: { type: "string", description: "Any extra detail to remember." },
        rationale: {
          type: "string",
          description:
            "One or two sentences explaining why this supplier belongs on the plan. Shown to the couple.",
        },
      },
      required: ["name", "category", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const payloadResult = supplierCreateSchema.safeParse({
      name: input.name,
      category: input.category,
      status: input.status ?? "SHORTLIST",
      website: input.website ?? null,
      notes: input.notes ?? null,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "supplier.create",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "supplier.create",
        title: input.name,
        detail: input.category,
        message: "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
