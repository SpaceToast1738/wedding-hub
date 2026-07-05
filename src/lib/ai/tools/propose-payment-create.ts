import { z } from "zod";
import { db } from "@/lib/db";
import {
  paymentCreateSchema,
  FUND_SOURCES,
  PAYMENT_STATUSES,
} from "@/lib/ai/proposals/schemas";
import { canView } from "@/lib/permissions";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// Money is INTEGER PENCE; the apply bridge formats the pound-string
// createPayment's parseAmount expects. Deliberately absent: paidDate
// (set only via payment.set_status marking PAID), fileIds (receipts),
// bookBuildMaterialId / bookOutfitId (linking a BUILD material flips
// its `ordered` flag — a book-side mutation the AI must not trigger).
const inputSchema = z.object({
  description: z.string().min(1).max(200),
  amountPence: z
    .number()
    .int()
    .min(1)
    .max(100_000_000)
    .describe("Amount in integer pence — £250.00 is 25000."),
  status: z.enum(PAYMENT_STATUSES).optional(),
  dueDate: z.string().max(30).optional().describe("ISO date (YYYY-MM-DD)."),
  method: z.string().max(100).optional(),
  supplierId: z.string().optional(),
  budgetLineId: z.string().optional(),
  budgetLineComponentId: z.string().optional(),
  fundSource: z.enum(FUND_SOURCES).optional(),
  fundLabel: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this payment should be recorded."),
});

export const proposePaymentCreate: AiTool<typeof inputSchema> = {
  name: "propose_payment_create",
  description:
    "Propose a new payment (a due, scheduled, or already-paid amount). Money is integer PENCE (£250.00 = 25000). Writes a proposal — money surfaces are couple-only, so only the couple can apply it. Link it to a budget line (budgetLineId from read_budget) so it rolls into that line's actual spend. Omit fundSource to inherit the linked line's fund. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing payment…",
  definition: {
    name: "propose_payment_create",
    description:
      "Propose a new payment for the couple to review. Amount is integer pence. Link budgetLineId so the payment rolls into the line's actuals.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string", description: "What the payment is for, e.g. 'Venue deposit'." },
        amountPence: { type: "integer", description: "Amount in integer pence (£250.00 = 25000)." },
        status: {
          type: "string",
          enum: [...PAYMENT_STATUSES],
          description: "DUE by default. PAID records it as already settled.",
        },
        dueDate: { type: "string", description: "ISO date (YYYY-MM-DD). Optional." },
        method: { type: "string", description: "e.g. 'Bank transfer', 'Credit card'." },
        supplierId: { type: "string", description: "Supplier id from read_suppliers." },
        budgetLineId: { type: "string", description: "Budget line id from read_budget." },
        budgetLineComponentId: {
          type: "string",
          description: "Component id when the payment is for one sub-cost of a composite line.",
        },
        fundSource: {
          type: "string",
          enum: [...FUND_SOURCES],
          description: "Explicit fund override. Omit to inherit from the linked line (preferred).",
        },
        fundLabel: { type: "string" },
        notes: { type: "string" },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this payment should be recorded.",
        },
      },
      required: ["description", "amountPence", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    if (!(await canView(ctx.user, "payments"))) {
      return {
        ok: false,
        error: "Payments are couple-only — you can't propose money changes for this caller.",
      };
    }

    const { invalid, names } = await resolveRefs({
      supplierIds: input.supplierId ? [input.supplierId] : [],
      budgetLineIds: input.budgetLineId ? [input.budgetLineId] : [],
    });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    // Components aren't in resolveRefs — validate directly, and refuse
    // a line/component pair that disagree: createPayment stores both
    // FKs as posted, so a mismatched pair would corrupt the rollup.
    let componentLabel: string | null = null;
    if (input.budgetLineComponentId) {
      const component = await db.budgetLineComponent.findUnique({
        where: { id: input.budgetLineComponentId },
        select: { lineId: true, label: true },
      });
      if (!component) {
        return {
          ok: false,
          error: unknownIdsError([`budgetLineComponent:${input.budgetLineComponentId}`]),
        };
      }
      if (input.budgetLineId && input.budgetLineId !== component.lineId) {
        return {
          ok: false,
          error: `Component "${component.label}" belongs to a different budget line than the budgetLineId you passed. Link the component alone (its parent line is filled in automatically) or fix the line id.`,
        };
      }
      componentLabel = component.label;
    }

    const payloadResult = paymentCreateSchema.safeParse({
      description: input.description,
      amountPence: input.amountPence,
      status: input.status ?? "DUE",
      dueDate: input.dueDate,
      method: input.method,
      supplierId: input.supplierId,
      budgetLineId: input.budgetLineId,
      budgetLineComponentId: input.budgetLineComponentId,
      fundSource: input.fundSource,
      fundLabel: input.fundLabel,
      notes: input.notes,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "payment.create",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const parts: string[] = [`£${(input.amountPence / 100).toFixed(2)}`];
    if (input.status && input.status !== "DUE") parts.push(input.status);
    if (input.dueDate) parts.push(`due ${input.dueDate}`);
    if (input.supplierId) parts.push(`supplier: ${names.suppliers.get(input.supplierId)}`);
    if (input.budgetLineId) parts.push(`line: ${names.budgetLines.get(input.budgetLineId)}`);
    if (componentLabel) parts.push(`component: ${componentLabel}`);

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "payment.create",
        title: input.description,
        detail: parts.join(" · "),
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
