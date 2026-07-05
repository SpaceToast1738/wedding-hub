import { z } from "zod";
import { db } from "@/lib/db";
import { budgetCategoryCreateSchema } from "@/lib/ai/proposals/schemas";
import { canView } from "@/lib/permissions";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this category is needed. Shown to the couple."),
});

export const proposeBudgetCategoryCreate: AiTool<typeof inputSchema> = {
  name: "propose_budget_category_create",
  description:
    "Propose a new budget category (e.g. Flowers, Stationery). Writes a proposal — money surfaces are couple-only, so only the couple can apply it. Check read_budget first: don't duplicate an existing category, add lines to it instead. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing budget category…",
  definition: {
    name: "propose_budget_category_create",
    description:
      "Propose a new budget category for the couple to review. Duplicates of an existing category name are refused — check read_budget first.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Category name, e.g. 'Flowers' or 'Stationery'." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this category is needed.",
        },
      },
      required: ["name", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    // Courtesy read/write-parity gate: the hard wall is requireEdit
    // ("budget") inside the human action at apply time, but a caller
    // who can't even read the budget would only produce blind junk
    // proposals here.
    if (!(await canView(ctx.user, "budget"))) {
      return {
        ok: false,
        error: "Budget is couple-only — you can't propose money changes for this caller.",
      };
    }

    // BudgetCategory.name has no unique constraint — without this
    // check a repeated Apply would land duplicate categories silently.
    const existing = await db.budgetCategory.findFirst({
      where: { name: { equals: input.name, mode: "insensitive" } },
      select: { name: true },
    });
    if (existing) {
      return {
        ok: false,
        error: `A category named "${existing.name}" already exists — propose budget lines inside it instead of creating a duplicate.`,
      };
    }

    const payloadResult = budgetCategoryCreateSchema.safeParse({ name: input.name });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "budget.category.create",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "budget.category.create",
        title: input.name,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
