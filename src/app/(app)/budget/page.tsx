import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/actions";
import { redirect } from "next/navigation";
import { BudgetClient } from "./BudgetClient";

export default async function BudgetPage() {
  const user = await requireUser();
  if (!user.isCouple) redirect("/");

  const [categories, suppliers] = await Promise.all([
    db.budgetCategory.findMany({
      orderBy: { order: "asc" },
      include: {
        lines: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          // B2: payments included so the client can recompute `actual`
          // when it's null (manual override semantics).
          include: { payments: { select: { amount: true } } },
        },
      },
    }),
    db.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Budget"
        subtitle="Categories, lines, and totals — couple only"
      />
      <BudgetClient
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          lines: c.lines.map((l) => ({
            id: l.id,
            description: l.description,
            estimated: l.estimated,
            actual: l.actual,
            paid: l.paid,
            supplierId: l.supplierId,
            notes: l.notes,
            // Pass amounts as strings so the client never imports the
            // Prisma Decimal type (keeps the bundle slim).
            payments: l.payments.map((p) => ({ amount: p.amount.toString() })),
          })),
        }))}
        suppliers={suppliers}
      />
    </>
  );
}
