import { z } from "zod";
import { db } from "@/lib/db";
import { budgetLineDeleteSchema } from "@/lib/ai/proposals/schemas";
import { canView } from "@/lib/permissions";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import {
  clipDisplay,
  DELETE_PROPOSED_MESSAGE,
  reasonFromRationale,
} from "./propose-delete-common";
import type { AiTool } from "./types";

// v2.8.0: destructive kind. Bridges to the budget.line.delete apply
// handler (src/lib/ai/apply/deletes.ts) — a PERMANENT db delete that
// cascades the line's components (linked payments survive, unlinked).
// Couple-only end to end, same as every other budget.* kind.
const inputSchema = z.object({
  lineId: z
    .string()
    .min(1)
    .describe("Budget line id — get this from read_budget, never invent one."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this budget line should be permanently deleted. Shown to the couple.",
    ),
});

export const proposeBudgetLineDelete: AiTool<typeof inputSchema> = {
  name: "propose_budget_line_delete",
  description:
    "Propose PERMANENTLY deleting a budget line. This is destructive: applying removes the line and its cost components for good (a JSON snapshot is kept on the proposal for manual recovery, but there is no undo button). Payments linked to the line survive — they just lose the link — but any recorded estimated/actual/paid amounts on the line disappear from the budget totals. Money surfaces are couple-only, so only the couple can apply it. Requires a lineId from read_budget.",
  inputSchema,
  progressLabel: "Proposing budget line delete…",
  definition: {
    name: "propose_budget_line_delete",
    description:
      "Propose permanently deleting a budget line (snapshot-backed, no undo; cascades its components, keeps linked payments). Requires lineId from read_budget.",
    input_schema: {
      type: "object",
      properties: {
        lineId: { type: "string", description: "Budget line id from read_budget." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this line should be deleted.",
        },
      },
      required: ["lineId", "rationale"],
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

    const line = await db.budgetLine.findUnique({
      where: { id: input.lineId },
      select: {
        description: true,
        category: { select: { name: true } },
        _count: { select: { components: true, payments: true } },
      },
    });
    if (!line) {
      return { ok: false, error: unknownIdsError([`budgetLine:${input.lineId}`]) };
    }

    const payloadResult = budgetLineDeleteSchema.safeParse({
      lineId: input.lineId,
      targetLabel: clipDisplay(line.description, 200),
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
        kind: "budget.line.delete",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detailBits = [`in ${line.category.name}`, "permanent — snapshot kept"];
    if (line._count.components) {
      detailBits.push(`${line._count.components} component(s) deleted with it`);
    }
    if (line._count.payments) {
      detailBits.push(`${line._count.payments} linked payment(s) kept, unlinked`);
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "budget.line.delete",
        title: `Delete budget line "${line.description}"`,
        detail: detailBits.join(" · "),
        message: DELETE_PROPOSED_MESSAGE,
      },
    };
  },
};
