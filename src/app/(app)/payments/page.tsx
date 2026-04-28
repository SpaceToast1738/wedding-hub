import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/actions";
import { formatMoneyDecimal } from "@/lib/format";
import { EmptyPayments, EmptyState } from "@/components/ui/Illustrations";
import { AddPaymentToggle } from "./AddPaymentToggle";
import { PaymentRow } from "./PaymentRow";

export default async function PaymentsPage() {
  const user = await requireUser();
  if (!user.isCouple) redirect("/");

  const [payments, suppliers] = await Promise.all([
    db.payment.findMany({
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    db.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const total = payments.reduce((sum, p) => sum + Number(p.amount.toString()), 0);
  const paid = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount.toString()), 0);
  const outstanding = total - paid;

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={`Outstanding: ${formatMoneyDecimal(outstanding as unknown as { toString(): string })} · Paid: ${formatMoneyDecimal(paid as unknown as { toString(): string })}`}
        actions={<AddPaymentToggle suppliers={suppliers} />}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          {payments.length === 0 ? (
            <EmptyState
              illustration={EmptyPayments}
              title="No payments yet"
              body="Add your first one above. Linked payments roll up into the budget actuals."
            />
          ) : (
            <div className="bg-surface border border-border-soft rounded-md shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider bg-canvas">
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-left">Supplier</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-left">Due</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Method</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <PaymentRow key={p.id} payment={p} suppliers={suppliers} canEdit={true} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
