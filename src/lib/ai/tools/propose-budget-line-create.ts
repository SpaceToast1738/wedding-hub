import { z } from "zod";
import { db } from "@/lib/db";
import {
  budgetLineCreateSchema,
  FUND_SOURCES,
  PER_HEAD_SOURCES,
} from "@/lib/ai/proposals/schemas";
import { canView } from "@/lib/permissions";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// All money here is INTEGER PENCE. The apply bridge formats the
// pound-strings the budget action's parseAmount/parsePence expect, so
// the silent NaN→null parser and the 100x-unit mistake are both
// unreachable from this surface. `actual` and `paid` are deliberately
// absent: a new line starts in payment-rollup mode (B2 contract) and
// only a human may pin an actual-override.
const inputSchema = z.object({
  categoryId: z
    .string()
    .min(1)
    .describe("Budget category id — get this from read_budget, never invent one."),
  description: z.string().min(1).max(200),
  estimatedPence: z.number().int().min(0).max(100_000_000).optional(),
  supplierId: z.string().optional(),
  notes: z.string().max(2000).optional(),
  perHeadPence: z.number().int().min(0).max(100_000_000).optional(),
  headcountSource: z.enum(PER_HEAD_SOURCES).optional(),
  manualHeadcount: z.number().int().min(0).max(10_000).optional(),
  minimumHeadcount: z.number().int().min(0).max(10_000).optional(),
  fundSource: z.enum(FUND_SOURCES).optional(),
  fundLabel: z.string().max(120).optional(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this line belongs in the budget."),
});

export const proposeBudgetLineCreate: AiTool<typeof inputSchema> = {
  name: "propose_budget_line_create",
  description:
    "Propose a new budget line inside an existing category. All money is integer PENCE (£250.00 = 25000). Writes a proposal — money surfaces are couple-only, so only the couple can apply it. Requires a categoryId from read_budget. For per-head pricing set perHeadPence + headcountSource. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing budget line…",
  definition: {
    name: "propose_budget_line_create",
    description:
      "Propose a new budget line for the couple to review. Money is integer pence. categoryId must come from read_budget.",
    input_schema: {
      type: "object",
      properties: {
        categoryId: { type: "string", description: "Budget category id from read_budget." },
        description: { type: "string", description: "What the money is for, e.g. 'Bridal bouquet'." },
        estimatedPence: {
          type: "integer",
          description: "Estimated cost in integer pence (£250.00 = 25000).",
        },
        supplierId: { type: "string", description: "Supplier id from read_suppliers." },
        notes: { type: "string" },
        perHeadPence: {
          type: "integer",
          description: "Per-guest cost in integer pence — for headcount-driven lines like catering.",
        },
        headcountSource: {
          type: "string",
          enum: [...PER_HEAD_SOURCES],
          description: "Which guest count drives a per-head line. MANUAL needs manualHeadcount.",
        },
        manualHeadcount: { type: "integer", description: "Fixed headcount when headcountSource is MANUAL." },
        minimumHeadcount: { type: "integer", description: "Vendor minimum-cover floor, if any." },
        fundSource: {
          type: "string",
          enum: [...FUND_SOURCES],
          description: "Who pays. Omit to leave unassigned (the default).",
        },
        fundLabel: { type: "string", description: "Free-text fund label, e.g. 'Mum & Dad'." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this line belongs in the budget.",
        },
      },
      required: ["categoryId", "description", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    if (!(await canView(ctx.user, "budget"))) {
      return {
        ok: false,
        error: "Budget is couple-only — you can't propose money changes for this caller.",
      };
    }

    const { invalid, names } = await resolveRefs({
      budgetCategoryIds: [input.categoryId],
      supplierIds: input.supplierId ? [input.supplierId] : [],
    });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    const payloadResult = budgetLineCreateSchema.safeParse({
      categoryId: input.categoryId,
      description: input.description,
      estimatedPence: input.estimatedPence,
      supplierId: input.supplierId,
      notes: input.notes,
      perHeadPence: input.perHeadPence,
      headcountSource: input.headcountSource,
      manualHeadcount: input.manualHeadcount,
      minimumHeadcount: input.minimumHeadcount,
      fundSource: input.fundSource,
      fundLabel: input.fundLabel,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "budget.line.create",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const parts: string[] = [names.budgetCategories.get(input.categoryId)!];
    if (input.estimatedPence !== undefined) {
      parts.push(`£${(input.estimatedPence / 100).toFixed(2)} est`);
    }
    if (input.supplierId) parts.push(`supplier: ${names.suppliers.get(input.supplierId)}`);

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "budget.line.create",
        title: input.description,
        detail: parts.join(" · "),
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
