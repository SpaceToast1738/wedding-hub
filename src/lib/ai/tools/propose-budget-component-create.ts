import { z } from "zod";
import { db } from "@/lib/db";
import {
  budgetComponentCreateSchema,
  FUND_SOURCES,
  PER_HEAD_SOURCES,
} from "@/lib/ai/proposals/schemas";
import { canView } from "@/lib/permissions";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// A budget-line component is a sub-cost row on a BudgetLine (e.g.
// "Chair covers" under a "Décor" line). A component is flat OR per-head,
// mirroring the line shape. All money is INTEGER PENCE, written straight
// to the DB (no £-string round-trip). When a line has components its
// effective estimate becomes the sum of them, so proposing components is
// how the AI breaks a coarse line into itemised costs.
const inputSchema = z.object({
  lineId: z
    .string()
    .min(1)
    .describe("Parent budget line id — get this from read_budget, never invent one."),
  label: z.string().min(1).max(200).describe("What this sub-cost is, e.g. 'Chair covers'."),
  flatPence: z.number().int().min(0).max(100_000_000).optional(),
  perHeadPence: z.number().int().min(0).max(100_000_000).optional(),
  headcountSource: z.enum(PER_HEAD_SOURCES).optional(),
  manualHeadcount: z.number().int().min(0).max(10_000).optional(),
  minimumHeadcount: z.number().int().min(0).max(10_000).optional(),
  notes: z.string().max(2000).optional(),
  fundSource: z.enum(FUND_SOURCES).optional(),
  fundLabel: z.string().max(120).optional(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this component belongs on the line."),
});

export const proposeBudgetComponentCreate: AiTool<typeof inputSchema> = {
  name: "propose_budget_component_create",
  description:
    "Propose a new sub-cost component on an existing budget line (e.g. itemising a 'Décor' line into 'Chair covers', 'Centrepieces'). A component is flat OR per-head; all money is integer PENCE (£12.00 = 1200). When a line has components its estimate becomes their sum. Writes a proposal — money surfaces are couple-only, so only the couple can apply it. Requires a lineId from read_budget. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing budget component…",
  definition: {
    name: "propose_budget_component_create",
    description:
      "Propose a new sub-cost component on a budget line for the couple to review. Flat OR per-head; money is integer pence. lineId must come from read_budget.",
    input_schema: {
      type: "object",
      properties: {
        lineId: { type: "string", description: "Parent budget line id from read_budget." },
        label: { type: "string", description: "What the sub-cost is, e.g. 'Chair covers'." },
        flatPence: {
          type: "integer",
          description: "Flat cost in integer pence (£12.00 = 1200). Use this OR perHeadPence.",
        },
        perHeadPence: {
          type: "integer",
          description: "Per-guest cost in integer pence — for headcount-driven components.",
        },
        headcountSource: {
          type: "string",
          enum: [...PER_HEAD_SOURCES],
          description: "Which guest count drives a per-head component. MANUAL needs manualHeadcount.",
        },
        manualHeadcount: { type: "integer", description: "Fixed headcount when headcountSource is MANUAL." },
        minimumHeadcount: { type: "integer", description: "Vendor minimum-cover floor, if any." },
        notes: { type: "string" },
        fundSource: {
          type: "string",
          enum: [...FUND_SOURCES],
          description: "Who pays. Omit to inherit the parent line's fund silently.",
        },
        fundLabel: { type: "string", description: "Free-text fund label, e.g. 'Mum & Dad'." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this component belongs on the line.",
        },
      },
      required: ["lineId", "label", "rationale"],
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

    const { invalid, names } = await resolveRefs({ budgetLineIds: [input.lineId] });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    const payloadResult = budgetComponentCreateSchema.safeParse({
      lineId: input.lineId,
      label: input.label,
      flatPence: input.flatPence,
      perHeadPence: input.perHeadPence,
      headcountSource: input.headcountSource,
      manualHeadcount: input.manualHeadcount,
      minimumHeadcount: input.minimumHeadcount,
      notes: input.notes,
      fundSource: input.fundSource,
      fundLabel: input.fundLabel,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "budget.component_create",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const parts: string[] = [`on ${names.budgetLines.get(input.lineId)}`];
    if (input.flatPence !== undefined) parts.push(`£${(input.flatPence / 100).toFixed(2)} flat`);
    if (input.perHeadPence !== undefined) {
      parts.push(`£${(input.perHeadPence / 100).toFixed(2)} per head`);
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "budget.component_create",
        title: input.label,
        detail: parts.join(" · "),
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
