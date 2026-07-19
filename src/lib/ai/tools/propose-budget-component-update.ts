import { z } from "zod";
import { db } from "@/lib/db";
import {
  budgetComponentUpdateSchema,
  FUND_SOURCES,
  PER_HEAD_SOURCES,
} from "@/lib/ai/proposals/schemas";
import { canView } from "@/lib/permissions";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// Patch semantics: omit = keep the current value, null = clear.
// updateComponent is a full-record replace underneath, so the apply
// bridge merges this patch against the live row. There is deliberately
// NO lineId — a wrong line would silently relocate the component. All
// money is INTEGER PENCE, written directly.
const inputSchema = z.object({
  componentId: z
    .string()
    .min(1)
    .describe("Budget component id — get this from read_budget, never invent one."),
  label: z.string().min(1).max(200).optional(),
  flatPence: z.number().int().min(0).max(100_000_000).optional().nullable(),
  perHeadPence: z.number().int().min(0).max(100_000_000).optional().nullable(),
  headcountSource: z.enum(PER_HEAD_SOURCES).optional().nullable(),
  manualHeadcount: z.number().int().min(0).max(10_000).optional().nullable(),
  minimumHeadcount: z.number().int().min(0).max(10_000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  fundSource: z.enum(FUND_SOURCES).optional().nullable(),
  fundLabel: z.string().max(120).optional().nullable(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change makes sense."),
});

export const proposeBudgetComponentUpdate: AiTool<typeof inputSchema> = {
  name: "propose_budget_component_update",
  description:
    "Propose a partial update to an existing budget-line component. Only include fields you want changed — omitted fields keep their current value, null clears. Money is integer PENCE. You cannot move the component to a different line. Writes a proposal — money surfaces are couple-only, so only the couple can apply it. Requires a componentId from read_budget. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing budget component update…",
  definition: {
    name: "propose_budget_component_update",
    description:
      "Propose a partial update to a budget-line component. Omit fields to keep them, pass null to clear. Money is integer pence. The component cannot be moved to another line.",
    input_schema: {
      type: "object",
      properties: {
        componentId: { type: "string", description: "Budget component id from read_budget." },
        label: { type: "string" },
        flatPence: {
          type: ["integer", "null"],
          description: "Flat cost in integer pence (£12.00 = 1200). null clears.",
        },
        perHeadPence: {
          type: ["integer", "null"],
          description: "Per-guest cost in integer pence. null clears.",
        },
        headcountSource: {
          type: ["string", "null"],
          enum: [...PER_HEAD_SOURCES, null],
          description: "Which guest count drives a per-head component. null reverts to flat.",
        },
        manualHeadcount: { type: ["integer", "null"] },
        minimumHeadcount: { type: ["integer", "null"] },
        notes: { type: ["string", "null"] },
        fundSource: {
          type: ["string", "null"],
          enum: [...FUND_SOURCES, null],
          description: "Who pays. null reverts to inheriting from the parent line.",
        },
        fundLabel: { type: ["string", "null"] },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this change makes sense.",
        },
      },
      required: ["componentId", "rationale"],
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

    const patch: Record<string, unknown> = { componentId: input.componentId };
    if (input.label !== undefined) patch.label = input.label;
    if (input.flatPence !== undefined) patch.flatPence = input.flatPence;
    if (input.perHeadPence !== undefined) patch.perHeadPence = input.perHeadPence;
    if (input.headcountSource !== undefined) patch.headcountSource = input.headcountSource;
    if (input.manualHeadcount !== undefined) patch.manualHeadcount = input.manualHeadcount;
    if (input.minimumHeadcount !== undefined) patch.minimumHeadcount = input.minimumHeadcount;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.fundSource !== undefined) patch.fundSource = input.fundSource;
    if (input.fundLabel !== undefined) patch.fundLabel = input.fundLabel;

    // A patch with only componentId is an empty, un-actionable proposal.
    if (Object.keys(patch).length === 1) {
      return {
        ok: false,
        error: "The update contains no changes. Include at least one field to change.",
      };
    }

    // Components aren't in resolveRefs — validate directly, and grab the
    // label for the review card title.
    const component = await db.budgetLineComponent.findUnique({
      where: { id: input.componentId },
      select: { label: true },
    });
    if (!component) {
      return { ok: false, error: unknownIdsError([`budgetLineComponent:${input.componentId}`]) };
    }

    const payloadResult = budgetComponentUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "budget.component_update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const bits: string[] = [];
    if (input.label !== undefined) bits.push(`label → ${input.label}`);
    if (typeof input.flatPence === "number") {
      bits.push(`flat → £${(input.flatPence / 100).toFixed(2)}`);
    }
    if (typeof input.perHeadPence === "number") {
      bits.push(`per head → £${(input.perHeadPence / 100).toFixed(2)}`);
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "budget.component_update",
        title: `Update component "${component.label}"`,
        detail: bits.length ? bits.join(" · ") : undefined,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
