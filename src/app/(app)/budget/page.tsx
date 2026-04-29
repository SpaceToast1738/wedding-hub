import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { requireUser } from "@/lib/actions";
import { redirect } from "next/navigation";
import { formatWeddingDate, getWeddingSettings } from "@/lib/wedding-settings";
import { BudgetClient } from "./BudgetClient";

export default async function BudgetPage() {
  const user = await requireUser();
  if (!user.isCouple) redirect("/");
  const wedding = await getWeddingSettings();

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
        actions={<PrintButton />}
      />
      <div className="flex-1 overflow-auto budget-page">
        {/* v1.24.0: print-only letterhead — same shape as /schedule
            and /guests/catering. Hidden on screen, visible on print. */}
        <div className="print-only-block max-w-3xl mx-auto px-6 pt-6 border-b-2 border-ink-primary pb-3 mb-6">
          <h1 className="font-display text-2xl text-ink-primary">{wedding.coupleLabel}</h1>
          <div className="text-xs text-ink-tertiary mt-1">
            Budget · {formatWeddingDate(wedding)} · {wedding.venue}
          </div>
        </div>
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
      </div>
    </>
  );
}
