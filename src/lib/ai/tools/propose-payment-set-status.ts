import { z } from "zod";
import { db } from "@/lib/db";
import { paymentSetStatusSchema, PAYMENT_STATUSES } from "@/lib/ai/proposals/schemas";
import { canView } from "@/lib/permissions";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = z.object({
  paymentId: z
    .string()
    .min(1)
    .describe("Payment id — get this from read_payments, never invent one."),
  status: z.enum(PAYMENT_STATUSES),
  paidDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .describe(
      "Only meaningful with status PAID: the date it was actually paid (YYYY-MM-DD). Omit to use today.",
    ),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY the status should change."),
});

export const proposePaymentSetStatus: AiTool<typeof inputSchema> = {
  name: "propose_payment_set_status",
  description:
    "Propose a status change on an existing payment (DUE, SCHEDULED, PAID, OVERDUE, CANCELLED). PAID stamps today as the paid date; moving off PAID clears it. Writes a proposal — money surfaces are couple-only, so only the couple can apply it. Requires a paymentId from read_payments. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing payment status…",
  definition: {
    name: "propose_payment_set_status",
    description:
      "Propose a payment status change. PAID stamps today as the paid date; moving off PAID clears the recorded paid date.",
    input_schema: {
      type: "object",
      properties: {
        paymentId: { type: "string", description: "Payment id from read_payments." },
        status: { type: "string", enum: [...PAYMENT_STATUSES] },
        paidDate: {
          type: "string",
          description: "With status PAID only: the date paid (YYYY-MM-DD). Omit for today.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why the status should change.",
        },
      },
      required: ["paymentId", "status", "rationale"],
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

    // Direct load rather than resolveRefs — the current status drives
    // both the no-op guard and the paid-date warning in the detail.
    const payment = await db.payment.findUnique({
      where: { id: input.paymentId },
      select: { description: true, status: true },
    });
    if (!payment) {
      return { ok: false, error: unknownIdsError([`payment:${input.paymentId}`]) };
    }
    if (payment.status === input.status) {
      return {
        ok: false,
        error: `"${payment.description}" is already ${input.status} — nothing to change.`,
      };
    }

    const payloadResult = paymentSetStatusSchema.safeParse({
      paymentId: input.paymentId,
      status: input.status,
      // paidDate is only honoured when marking PAID; ignore it otherwise
      // so the payload doesn't carry a misleading date onto a non-PAID
      // transition.
      paidDate: input.status === "PAID" ? input.paidDate ?? null : null,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "payment.set_status",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const bits: string[] = [`${payment.status} → ${input.status}`];
    if (input.status === "PAID") {
      bits.push(
        input.paidDate ? `paid ${input.paidDate}` : "PAID stamps today as the paid date",
      );
    } else if (payment.status === "PAID") {
      bits.push("moving off PAID clears the recorded paid date");
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "payment.set_status",
        title: `"${payment.description}" → ${input.status}`,
        detail: bits.join(" · "),
        message: "Status change proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
