// v2.4.0: full payment-row read. Couple-only (payments is a
// COUPLE_ONLY_SECTIONS hardwall), so surfacing amountPence here does
// NOT breach money parity — the ban is on money leaking into book /
// guest / task surfaces that non-couple users can read. Receipt file
// ids and storage paths are never returned; only the count.

import { z } from "zod";
import { PAYMENT_STATUSES } from "@/lib/ai/proposals/schemas";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import type { AiTool } from "./types";

const inputSchema = z.object({
  status: z.enum(PAYMENT_STATUSES).optional(),
  dueBefore: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

function trimNotes(notes: string | null): string | null {
  if (!notes) return null;
  return notes.length > 300 ? notes.slice(0, 300) + "…" : notes;
}

export const readPayments: AiTool<typeof inputSchema> = {
  name: "read_payments",
  description:
    "Read individual payments — amount (integer pence), status, due/paid dates, method, supplier, budget-line links, fund source, and receipt count. Returns paymentIds usable in payment update proposals. Couple-only: refuses if the caller doesn't have access to /payments. Filter by status or dueBefore (ISO date); returns 25 by default ordered by due date.",
  inputSchema,
  progressLabel: "Reading payments…",
  definition: {
    name: "read_payments",
    description:
      "Read payments: description, amountPence, status, due/paid dates, method, supplier, budget links, fund source, receipt count. Returns paymentIds for payment proposals. Couple-only.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [...PAYMENT_STATUSES],
          description: "Filter by payment status.",
        },
        dueBefore: {
          type: "string",
          description: "ISO date. Return payments with dueDate before this.",
        },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Default 25." },
      },
    },
  },
  async handler(input, ctx) {
    if (!(await canView(ctx.user, "payments"))) {
      return { ok: false, error: "Payments are couple-only; caller doesn't have access." };
    }

    const where: Record<string, unknown> = {};
    if (input.status) where.status = input.status;
    if (input.dueBefore) {
      const d = new Date(input.dueBefore);
      if (isNaN(d.getTime())) {
        return { ok: false, error: `dueBefore is not a valid ISO date: '${input.dueBefore}'.` };
      }
      where.dueDate = { lt: d };
    }

    const payments = await db.payment.findMany({
      where,
      take: input.limit ?? 25,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        description: true,
        amount: true,
        status: true,
        dueDate: true,
        paidDate: true,
        method: true,
        supplierId: true,
        supplier: { select: { name: true } },
        budgetLineId: true,
        budgetLineComponentId: true,
        fundSource: true,
        fundLabel: true,
        notes: true,
        fileIds: true,
      },
    });

    return {
      ok: true,
      data: {
        count: payments.length,
        payments: payments.map((p) => ({
          paymentId: p.id,
          description: p.description,
          // Decimal pounds in the DB; the AI contract is integer pence.
          amountPence: Math.round(Number(p.amount) * 100),
          status: p.status,
          dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null,
          paidDate: p.paidDate?.toISOString().slice(0, 10) ?? null,
          method: p.method,
          supplierId: p.supplierId,
          supplierName: p.supplier?.name ?? null,
          budgetLineId: p.budgetLineId,
          budgetLineComponentId: p.budgetLineComponentId,
          fundSource: p.fundSource,
          fundLabel: p.fundLabel,
          notes: trimNotes(p.notes),
          receiptCount: p.fileIds.length,
        })),
      },
    };
  },
};
