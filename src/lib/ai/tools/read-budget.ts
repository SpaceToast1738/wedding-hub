import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import type { AiTool } from "./types";

const inputSchema = z.object({});

function penceToLabel(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export const readBudget: AiTool<typeof inputSchema> = {
  name: "read_budget",
  description:
    "Read the wedding budget summary — per-category totals of estimated vs actual vs paid spend, and the top 10 payments coming due. Couple-only: refuses if the caller doesn't have access to /budget.",
  inputSchema,
  progressLabel: "Reading the budget…",
  definition: {
    name: "read_budget",
    description:
      "Read the wedding budget summary — per-category totals of estimated vs actual vs paid spend, and the top 10 payments coming due. Couple-only.",
    input_schema: { type: "object", properties: {} },
  },
  async handler(_input, ctx) {
    if (!(await canView(ctx.user, "budget"))) {
      return { ok: false, error: "Budget is couple-only; caller doesn't have access." };
    }

    const [categories, upcomingPayments] = await Promise.all([
      db.budgetCategory.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          lines: {
            select: {
              estimated: true,
              actual: true,
              paid: true,
            },
          },
        },
      }),
      db.payment.findMany({
        where: { status: { in: ["DUE", "SCHEDULED", "OVERDUE"] } },
        orderBy: [{ dueDate: "asc" }],
        take: 10,
        select: {
          id: true,
          description: true,
          amount: true,
          status: true,
          dueDate: true,
          supplier: { select: { name: true } },
        },
      }),
    ]);

    let totalEst = 0, totalActual = 0, totalPaid = 0;
    const cats = categories.map((c) => {
      const est = c.lines.reduce((s, l) => s + Number(l.estimated ?? 0), 0);
      const actual = c.lines.reduce((s, l) => s + Number(l.actual ?? 0), 0);
      const paid = c.lines.reduce((s, l) => s + Number(l.paid ?? 0), 0);
      totalEst += est;
      totalActual += actual;
      totalPaid += paid;
      return {
        name: c.name,
        estimated: penceToLabel(Math.round(est * 100)),
        actual: penceToLabel(Math.round(actual * 100)),
        paid: penceToLabel(Math.round(paid * 100)),
      };
    });

    return {
      ok: true,
      data: {
        totals: {
          estimated: penceToLabel(Math.round(totalEst * 100)),
          actual: penceToLabel(Math.round(totalActual * 100)),
          paid: penceToLabel(Math.round(totalPaid * 100)),
        },
        categories: cats,
        upcomingPayments: upcomingPayments.map((p) => ({
          description: p.description,
          supplier: p.supplier?.name ?? null,
          amount: penceToLabel(Math.round(Number(p.amount) * 100)),
          status: p.status,
          dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null,
        })),
      },
    };
  },
};
