import { z } from "zod";
import { db } from "@/lib/db";
import {
  budgetLineUpdateSchema,
  FUND_SOURCES,
  PER_HEAD_SOURCES,
} from "@/lib/ai/proposals/schemas";
import { canView } from "@/lib/permissions";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// Patch semantics: omit = keep the current value, null = clear.
// updateLine is a full-record replace underneath (every omitted
// FormData field WIPES), so the apply bridge merges this patch against
// the live row. v2.9.2: `categoryId` is now an OPT-IN move — omit to
// keep the line where it is; set it to relocate the line to another
// category (the apply bridge validates the target exists first).
// `actual`/`paid` stay bridge-carried so the AI can never pin or unpin
// the B2 actual-override.
const inputSchema = z.object({
  lineId: z
    .string()
    .min(1)
    .describe("Budget line id — get this from read_budget, never invent one."),
  categoryId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Move the line to this budget category id (from read_budget). Omit to keep it where it is.",
    ),
  description: z.string().min(1).max(200).optional(),
  estimatedPence: z.number().int().min(0).max(100_000_000).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  perHeadPence: z.number().int().min(0).max(100_000_000).optional().nullable(),
  headcountSource: z.enum(PER_HEAD_SOURCES).optional().nullable(),
  manualHeadcount: z.number().int().min(0).max(10_000).optional().nullable(),
  minimumHeadcount: z.number().int().min(0).max(10_000).optional().nullable(),
  fundSource: z.enum(FUND_SOURCES).optional().nullable(),
  fundLabel: z.string().max(120).optional().nullable(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change makes sense."),
});

export const proposeBudgetLineUpdate: AiTool<typeof inputSchema> = {
  name: "propose_budget_line_update",
  description:
    "Propose a partial update to an existing budget line. Only include fields you want changed — omitted fields keep their current value, null clears. Money is integer PENCE. You CAN move the line to another category by passing categoryId (validated at apply). You cannot change the line's actual or paid figures — those stay exactly as they are. Requires a lineId from read_budget. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing budget line update…",
  definition: {
    name: "propose_budget_line_update",
    description:
      "Propose a partial update to a budget line. Omit fields to keep them, pass null to clear. Money is integer pence. Pass categoryId to move the line to another category. The line's actual and paid figures cannot be changed.",
    input_schema: {
      type: "object",
      properties: {
        lineId: { type: "string", description: "Budget line id from read_budget." },
        categoryId: {
          type: "string",
          description: "Move the line to this category id (from read_budget). Omit to keep it.",
        },
        description: { type: "string" },
        estimatedPence: {
          type: ["integer", "null"],
          description: "New estimate in integer pence (£250.00 = 25000). null clears it.",
        },
        supplierId: {
          type: ["string", "null"],
          description: "Supplier id from read_suppliers. null unlinks.",
        },
        notes: { type: ["string", "null"] },
        perHeadPence: {
          type: ["integer", "null"],
          description: "Per-guest cost in integer pence. null clears.",
        },
        headcountSource: {
          type: ["string", "null"],
          enum: [...PER_HEAD_SOURCES, null],
          description: "Which guest count drives a per-head line. null reverts to flat.",
        },
        manualHeadcount: { type: ["integer", "null"] },
        minimumHeadcount: { type: ["integer", "null"] },
        fundSource: {
          type: ["string", "null"],
          enum: [...FUND_SOURCES, null],
          description: "Who pays. null reverts to unassigned.",
        },
        fundLabel: { type: ["string", "null"] },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this change makes sense.",
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

    const patch: Record<string, unknown> = { lineId: input.lineId };
    if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
    if (input.description !== undefined) patch.description = input.description;
    if (input.estimatedPence !== undefined) patch.estimatedPence = input.estimatedPence;
    if (input.supplierId !== undefined) patch.supplierId = input.supplierId;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.perHeadPence !== undefined) patch.perHeadPence = input.perHeadPence;
    if (input.headcountSource !== undefined) patch.headcountSource = input.headcountSource;
    if (input.manualHeadcount !== undefined) patch.manualHeadcount = input.manualHeadcount;
    if (input.minimumHeadcount !== undefined) patch.minimumHeadcount = input.minimumHeadcount;
    if (input.fundSource !== undefined) patch.fundSource = input.fundSource;
    if (input.fundLabel !== undefined) patch.fundLabel = input.fundLabel;

    // A patch with only lineId is an empty, un-actionable proposal.
    if (Object.keys(patch).length === 1) {
      return {
        ok: false,
        error: "The update contains no changes. Include at least one field to change.",
      };
    }

    const { invalid, names } = await resolveRefs({
      budgetLineIds: [input.lineId],
      budgetCategoryIds: input.categoryId ? [input.categoryId] : [],
      supplierIds: typeof input.supplierId === "string" ? [input.supplierId] : [],
    });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    const payloadResult = budgetLineUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "budget.line.update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const bits: string[] = [];
    if (input.categoryId) {
      bits.push(`moves to → ${names.budgetCategories.get(input.categoryId)}`);
    }
    if (typeof input.estimatedPence === "number") {
      bits.push(`estimated → £${(input.estimatedPence / 100).toFixed(2)}`);
    }
    if (input.estimatedPence === null) bits.push("clears estimated");
    if (typeof input.supplierId === "string") {
      bits.push(`supplier: ${names.suppliers.get(input.supplierId)}`);
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "budget.line.update",
        title: `Update budget line "${names.budgetLines.get(input.lineId)}"`,
        detail: bits.length ? bits.join(" · ") : undefined,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
