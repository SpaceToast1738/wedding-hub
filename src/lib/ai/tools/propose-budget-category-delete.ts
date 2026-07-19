import { z } from "zod";
import { db } from "@/lib/db";
import { budgetCategoryDeleteSchema } from "@/lib/ai/proposals/schemas";
import { canView } from "@/lib/permissions";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import {
  clipDisplay,
  DELETE_PROPOSED_MESSAGE,
  reasonFromRationale,
} from "./propose-delete-common";
import type { AiTool } from "./types";

// v2.8.0: destructive kind. Bridges to the budget.category.delete
// apply handler (src/lib/ai/apply/deletes.ts). EMPTY categories only —
// refused (here AND at apply) while lines remain, so emptying a
// category is always a separate, visible set of budget.line.delete
// proposals, never an implicit cascade. Couple-only end to end.
const inputSchema = z.object({
  categoryId: z
    .string()
    .min(1)
    .describe("Budget category id — get this from read_budget, never invent one."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this empty category should be permanently deleted. Shown to the couple.",
    ),
});

export const proposeBudgetCategoryDelete: AiTool<typeof inputSchema> = {
  name: "propose_budget_category_delete",
  description:
    "Propose PERMANENTLY deleting an EMPTY budget category. This is destructive (a JSON snapshot is kept on the proposal for manual recovery, but there is no undo button) and is REFUSED while the category still contains lines — propose budget.line deletes first if the whole group truly has to go, so every line's removal is individually visible to the couple. Money surfaces are couple-only, so only the couple can apply it. Requires a categoryId from read_budget.",
  inputSchema,
  progressLabel: "Proposing category delete…",
  definition: {
    name: "propose_budget_category_delete",
    description:
      "Propose permanently deleting an EMPTY budget category (snapshot-backed, no undo; refused while it still has lines). Requires categoryId from read_budget.",
    input_schema: {
      type: "object",
      properties: {
        categoryId: { type: "string", description: "Budget category id from read_budget." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this category should be deleted.",
        },
      },
      required: ["categoryId", "rationale"],
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

    const category = await db.budgetCategory.findUnique({
      where: { id: input.categoryId },
      select: { name: true, _count: { select: { lines: true } } },
    });
    if (!category) {
      return { ok: false, error: unknownIdsError([`budgetCategory:${input.categoryId}`]) };
    }

    // Same refusal the apply handler (and the human deleteCategory)
    // enforces — refuse at propose time so an un-appliable proposal
    // never reaches the queue.
    if (category._count.lines > 0) {
      return {
        ok: false,
        error: `Can't delete "${category.name}" — ${category._count.lines} line${category._count.lines === 1 ? "" : "s"} still in this category. Propose deleting (or moving) the lines first.`,
      };
    }

    const payloadResult = budgetCategoryDeleteSchema.safeParse({
      categoryId: input.categoryId,
      targetLabel: clipDisplay(category.name, 200),
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
        kind: "budget.category.delete",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "budget.category.delete",
        title: `Delete budget category "${category.name}"`,
        detail: "currently empty · permanent — snapshot kept · re-checked at apply",
        message: DELETE_PROPOSED_MESSAGE,
      },
    };
  },
};
