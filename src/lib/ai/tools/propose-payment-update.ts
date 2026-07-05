import { z } from "zod";
import { db } from "@/lib/db";
import {
  paymentUpdateSchema,
  FUND_SOURCES,
  PAYMENT_STATUSES,
} from "@/lib/ai/proposals/schemas";
import { canView } from "@/lib/permissions";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// Patch semantics: omit = keep the current value, null = clear.
// updatePayment is a full-record replace underneath — omitted FormData
// fields wipe, including fileIds (all receipts) — so the apply bridge
// merges this patch against the live row and always carries receipts,
// book links (bookBuildMaterialId / bookOutfitId), and the recorded
// paidDate through byte-identical. Money is INTEGER PENCE.
const inputSchema = z.object({
  paymentId: z
    .string()
    .min(1)
    .describe("Payment id — get this from read_payments, never invent one."),
  description: z.string().min(1).max(200).optional(),
  amountPence: z.number().int().min(1).max(100_000_000).optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
  dueDate: z.string().max(30).optional().nullable(),
  method: z.string().max(100).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  budgetLineId: z.string().optional().nullable(),
  budgetLineComponentId: z.string().optional().nullable(),
  fundSource: z.enum(FUND_SOURCES).optional().nullable(),
  fundLabel: z.string().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change makes sense."),
});

export const proposePaymentUpdate: AiTool<typeof inputSchema> = {
  name: "propose_payment_update",
  description:
    "Propose a partial update to an existing payment. Only include fields you want changed — omitted fields keep their current value, null clears. Money is integer PENCE. Receipts, book-item links, and the recorded paid date are never touched — they're carried through from the live row. To just flip the status, prefer propose_payment_set_status. Requires a paymentId from read_payments. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing payment update…",
  definition: {
    name: "propose_payment_update",
    description:
      "Propose a partial update to a payment. Omit fields to keep them, pass null to clear. Amount is integer pence. Receipts, book links, and the paid date are carried through unchanged.",
    input_schema: {
      type: "object",
      properties: {
        paymentId: { type: "string", description: "Payment id from read_payments." },
        description: { type: "string" },
        amountPence: { type: "integer", description: "New amount in integer pence (£250.00 = 25000)." },
        status: { type: "string", enum: [...PAYMENT_STATUSES] },
        dueDate: { type: ["string", "null"], description: "ISO date (YYYY-MM-DD). null clears." },
        method: { type: ["string", "null"] },
        supplierId: { type: ["string", "null"], description: "Supplier id. null unlinks." },
        budgetLineId: { type: ["string", "null"], description: "Budget line id. null detaches from the budget." },
        budgetLineComponentId: { type: ["string", "null"], description: "Component id. null detaches." },
        fundSource: {
          type: ["string", "null"],
          enum: [...FUND_SOURCES, null],
          description: "Explicit fund override. null reverts to inheriting from the linked line.",
        },
        fundLabel: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this change makes sense.",
        },
      },
      required: ["paymentId", "rationale"],
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

    const patch: Record<string, unknown> = { paymentId: input.paymentId };
    if (input.description !== undefined) patch.description = input.description;
    if (input.amountPence !== undefined) patch.amountPence = input.amountPence;
    if (input.status !== undefined) patch.status = input.status;
    if (input.dueDate !== undefined) patch.dueDate = input.dueDate;
    if (input.method !== undefined) patch.method = input.method;
    if (input.supplierId !== undefined) patch.supplierId = input.supplierId;
    if (input.budgetLineId !== undefined) patch.budgetLineId = input.budgetLineId;
    if (input.budgetLineComponentId !== undefined)
      patch.budgetLineComponentId = input.budgetLineComponentId;
    if (input.fundSource !== undefined) patch.fundSource = input.fundSource;
    if (input.fundLabel !== undefined) patch.fundLabel = input.fundLabel;
    if (input.notes !== undefined) patch.notes = input.notes;

    if (Object.keys(patch).length === 1) {
      return {
        ok: false,
        error: "The update contains no changes. Include at least one field to change.",
      };
    }

    const { invalid, names } = await resolveRefs({
      paymentIds: [input.paymentId],
      supplierIds: typeof input.supplierId === "string" ? [input.supplierId] : [],
      budgetLineIds: typeof input.budgetLineId === "string" ? [input.budgetLineId] : [],
    });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    // Components aren't in resolveRefs — validate directly. The human
    // action only auto-resolves the parent line when the posted lineId
    // is EMPTY, and the merge bridge posts the current (possibly
    // different) line — so pin the component's parent line into the
    // patch here to keep the two FKs consistent at apply time.
    if (typeof input.budgetLineComponentId === "string") {
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
      if (typeof input.budgetLineId === "string" && input.budgetLineId !== component.lineId) {
        return {
          ok: false,
          error: `Component "${component.label}" belongs to a different budget line than the budgetLineId you passed. Link the component alone (its parent line is filled in automatically) or fix the line id.`,
        };
      }
      patch.budgetLineId = component.lineId;
    }

    const payloadResult = paymentUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "payment.update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const bits: string[] = [];
    if (typeof input.amountPence === "number") {
      bits.push(`amount → £${(input.amountPence / 100).toFixed(2)}`);
    }
    if (input.status !== undefined) bits.push(`status → ${input.status}`);
    if (typeof input.supplierId === "string") {
      bits.push(`supplier: ${names.suppliers.get(input.supplierId)}`);
    }
    if (typeof input.budgetLineId === "string") {
      bits.push(`line: ${names.budgetLines.get(input.budgetLineId)}`);
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "payment.update",
        title: `Update payment "${names.payments.get(input.paymentId)}"`,
        detail: bits.length ? bits.join(" · ") : undefined,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
