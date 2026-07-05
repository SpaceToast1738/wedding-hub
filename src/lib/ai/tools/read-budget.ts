import { z } from "zod";
import type { PerHeadSource } from "@prisma/client";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import {
  applyMinimum,
  computeActual,
  computeCompositeActual,
  computeCompositePaid,
  computeEstimated,
  computePaid,
} from "@/lib/budget";
import { fetchAllHeadcounts } from "@/lib/headcount";
import type { AiTool } from "./types";

const inputSchema = z.object({});

function penceToLabel(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

type HeadcountMap = Awaited<ReturnType<typeof fetchAllHeadcounts>>;

// Mirrors BudgetClient's resolveHeadcount so the AI sees the same
// per-head multipliers the /budget page renders.
function resolveHeadcount(
  row: { headcountSource: PerHeadSource | null; manualHeadcount: number | null },
  counts: HeadcountMap,
): number | null {
  if (row.headcountSource == null) return null;
  if (row.headcountSource === "MANUAL") return Math.max(0, row.manualHeadcount ?? 0);
  return counts[row.headcountSource];
}

// Mirrors BudgetClient's componentEffectiveEstimated (sans fund
// filter): per-head with the vendor-minimum floor, else flat, else 0.
function componentEstimatedPounds(
  c: {
    flatPence: number | null;
    perHeadPence: number | null;
    headcountSource: PerHeadSource | null;
    manualHeadcount: number | null;
    minimumHeadcount: number | null;
  },
  counts: HeadcountMap,
): number {
  if (c.perHeadPence != null && c.headcountSource != null) {
    const raw = resolveHeadcount(c, counts) ?? 0;
    return (c.perHeadPence * applyMinimum(raw, c.minimumHeadcount)) / 100;
  }
  return c.flatPence != null ? c.flatPence / 100 : 0;
}

export const readBudget: AiTool<typeof inputSchema> = {
  name: "read_budget",
  description:
    "Read the wedding budget — per-category totals (effective estimated vs actual vs paid, same maths as the /budget page: per-head × live headcount, component sums, B2 payment rollup), every line with its lineId/componentId (usable in budget.* proposals), and the top 10 payments coming due with their paymentIds. All per-line money is integer pence. Couple-only: refuses if the caller doesn't have access to /budget.",
  inputSchema,
  progressLabel: "Reading the budget…",
  definition: {
    name: "read_budget",
    description:
      "Read the wedding budget — per-category totals (effective estimated vs actual vs paid), every line with its lineId/componentId (usable in budget.* proposals), and the top 10 payments coming due with paymentIds. Per-line money is integer pence. Couple-only.",
    input_schema: { type: "object", properties: {} },
  },
  async handler(_input, ctx) {
    if (!(await canView(ctx.user, "budget"))) {
      return { ok: false, error: "Budget is couple-only; caller doesn't have access." };
    }

    const [categories, upcomingPayments, headcounts] = await Promise.all([
      db.budgetCategory.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          lines: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              description: true,
              estimated: true,
              actual: true,
              paid: true,
              perHeadPence: true,
              headcountSource: true,
              manualHeadcount: true,
              minimumHeadcount: true,
              fundSource: true,
              fundLabel: true,
              supplierId: true,
              notes: true,
              payments: { select: { amount: true, status: true } },
              components: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  label: true,
                  flatPence: true,
                  perHeadPence: true,
                  headcountSource: true,
                  manualHeadcount: true,
                  minimumHeadcount: true,
                  fundSource: true,
                  payments: { select: { amount: true, status: true } },
                },
              },
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
      fetchAllHeadcounts(),
    ]);

    let totalEst = 0, totalActual = 0, totalPaid = 0;
    const cats = categories.map((c) => {
      let est = 0, actual = 0, paid = 0;
      const lines = c.lines.map((l) => {
        // Effective figures, same rules as /budget: components win
        // over line-level estimate when present; actual/paid follow
        // the B2 contract (manual override wins, else payment sums
        // across line + components).
        const estPounds = l.components.length
          ? l.components.reduce(
              (s, comp) => s + componentEstimatedPounds(comp, headcounts),
              0,
            )
          : computeEstimated(l, resolveHeadcount(l, headcounts));
        const actualPounds = l.components.length
          ? computeCompositeActual(l)
          : computeActual(l);
        const paidPounds = l.components.length
          ? computeCompositePaid(l)
          : computePaid(l);
        est += estPounds;
        actual += actualPounds;
        paid += paidPounds;
        return {
          lineId: l.id,
          description: l.description,
          estimatedPence: Math.round(estPounds * 100),
          effectiveActualPence: Math.round(actualPounds * 100),
          perHeadPence: l.perHeadPence,
          headcountSource: l.headcountSource,
          manualHeadcount: l.manualHeadcount,
          minimumHeadcount: l.minimumHeadcount,
          fundSource: l.fundSource,
          fundLabel: l.fundLabel,
          supplierId: l.supplierId,
          notes: l.notes ? l.notes.slice(0, 200) : null,
          components: l.components.length
            ? l.components.map((comp) => ({
                componentId: comp.id,
                label: comp.label,
                flatPence: comp.flatPence,
                perHeadPence: comp.perHeadPence,
                headcountSource: comp.headcountSource,
                fundSource: comp.fundSource,
              }))
            : undefined,
        };
      });
      totalEst += est;
      totalActual += actual;
      totalPaid += paid;
      return {
        categoryId: c.id,
        name: c.name,
        estimated: penceToLabel(Math.round(est * 100)),
        actual: penceToLabel(Math.round(actual * 100)),
        paid: penceToLabel(Math.round(paid * 100)),
        lines,
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
          paymentId: p.id,
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
