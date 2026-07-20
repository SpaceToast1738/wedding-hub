// v2.9.2: rename a budget category. Money surfaces are couple-only, so
// only the couple can apply it (the apply path gates
// requireSectionEdit("budget")). Bridges to the budget.category.update
// apply handler (src/lib/ai/apply/money.ts → renameCategoryCore).

import { z } from "zod";
import { db } from "@/lib/db";
import { budgetCategoryUpdateSchema } from "@/lib/ai/proposals/schemas";
import { canView } from "@/lib/permissions";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = z.object({
  categoryId: z
    .string()
    .min(1)
    .describe("Budget category id — get this from read_budget, never invent one."),
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("The new category name."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this rename makes sense. Shown to the couple."),
});

export const proposeBudgetCategoryUpdate: AiTool<typeof inputSchema> = {
  name: "propose_budget_category_update",
  description:
    "Propose renaming an existing budget category. Money surfaces are couple-only, so only the couple can apply it. Requires a categoryId from read_budget. Don't rename onto an existing category's name — merge intent should be discussed, not silently applied. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing category rename…",
  definition: {
    name: "propose_budget_category_update",
    description:
      "Propose renaming a budget category (by categoryId from read_budget). Couple-only to apply. Renaming onto another existing category's name is refused.",
    input_schema: {
      type: "object",
      properties: {
        categoryId: { type: "string", description: "Budget category id from read_budget." },
        name: { type: "string", description: "The new category name." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this rename makes sense.",
        },
      },
      required: ["categoryId", "name", "rationale"],
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
    });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    // BudgetCategory.name has no unique constraint, but renaming onto an
    // existing name is a merge in disguise — refuse it (a different id
    // with the same name). Same-id no-op renames are harmless (the apply
    // core no-ops), so only a DIFFERENT category with that name blocks.
    const clash = await db.budgetCategory.findFirst({
      where: {
        name: { equals: input.name, mode: "insensitive" },
        id: { not: input.categoryId },
      },
      select: { name: true },
    });
    if (clash) {
      return {
        ok: false,
        error: `A different category named "${clash.name}" already exists — pick a distinct name (moving lines between categories is propose_budget_line_update with categoryId).`,
      };
    }

    const payloadResult = budgetCategoryUpdateSchema.safeParse({
      categoryId: input.categoryId,
      name: input.name,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "budget.category.update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "budget.category.update",
        title: `Rename category "${names.budgetCategories.get(input.categoryId)}" → "${input.name}"`,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
