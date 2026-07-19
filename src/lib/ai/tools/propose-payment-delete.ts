import { z } from "zod";
import { db } from "@/lib/db";
import { paymentDeleteSchema } from "@/lib/ai/proposals/schemas";
import { canView } from "@/lib/permissions";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import {
  clipDisplay,
  DELETE_PROPOSED_MESSAGE,
  reasonFromRationale,
} from "./propose-delete-common";
import type { AiTool } from "./types";

// v2.8.0: destructive kind. Bridges to the payment.delete apply
// handler (src/lib/ai/apply/deletes.ts) — a PERMANENT db delete with
// a recovery snapshot. Couple-only end to end, same as every other
// payment.* kind.
const inputSchema = z.object({
  paymentId: z
    .string()
    .min(1)
    .describe("Payment id — get this from read_payments, never invent one."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this payment should be permanently deleted. Shown to the couple.",
    ),
});

export const proposePaymentDelete: AiTool<typeof inputSchema> = {
  name: "propose_payment_delete",
  description:
    "Propose PERMANENTLY deleting a payment record. This is destructive: applying removes the row for good (a JSON snapshot is kept on the proposal for manual recovery, but there is no undo button). For a payment that fell through, propose_payment_set_status CANCELLED keeps the history and is almost always better — reserve deletion for genuinely wrong rows (duplicates, entry mistakes). Money surfaces are couple-only, so only the couple can apply it. Requires a paymentId from read_payments.",
  inputSchema,
  progressLabel: "Proposing payment delete…",
  definition: {
    name: "propose_payment_delete",
    description:
      "Propose permanently deleting a payment record (snapshot-backed, no undo). Prefer propose_payment_set_status CANCELLED for payments that fell through. Requires paymentId from read_payments.",
    input_schema: {
      type: "object",
      properties: {
        paymentId: { type: "string", description: "Payment id from read_payments." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this payment should be deleted.",
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

    const payment = await db.payment.findUnique({
      where: { id: input.paymentId },
      select: { description: true, status: true },
    });
    if (!payment) {
      return { ok: false, error: unknownIdsError([`payment:${input.paymentId}`]) };
    }

    const payloadResult = paymentDeleteSchema.safeParse({
      paymentId: input.paymentId,
      targetLabel: clipDisplay(payment.description, 200),
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
        kind: "payment.delete",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detailBits = [`currently ${payment.status}`, "permanent — snapshot kept"];
    if (payment.status === "PAID") {
      detailBits.push("this is a RECORDED PAID payment — deleting it changes the spend totals");
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "payment.delete",
        title: `Delete payment "${payment.description}"`,
        detail: detailBits.join(" · "),
        message: DELETE_PROPOSED_MESSAGE,
      },
    };
  },
};
