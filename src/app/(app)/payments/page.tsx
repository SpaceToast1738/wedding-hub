import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { requireUser } from "@/lib/actions";
import { formatMoneyDecimal } from "@/lib/format";
import { formatWeddingDate, getWeddingSettings } from "@/lib/wedding-settings";
import { EmptyPayments, EmptyState } from "@/components/ui/Illustrations";
import { AddPaymentToggle } from "./AddPaymentToggle";
import { PaymentRow } from "./PaymentRow";

// v1.57.0 (XL8): accepts `?supplier=<id>` filter — supplier-detail
// "Manage on Payments →" deep-link now lands at the filtered list
// instead of the unfiltered firehose. Pattern mirrors `/tasks`.
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>;
}) {
  const user = await requireUser();
  if (!user.isCouple) redirect("/");
  const wedding = await getWeddingSettings();
  const sp = await searchParams;
  const supplierFilter = typeof sp.supplier === "string" ? sp.supplier : null;

  const [payments, suppliers] = await Promise.all([
    db.payment.findMany({
      where: supplierFilter ? { supplierId: supplierFilter } : undefined,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    db.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const total = payments.reduce((sum, p) => sum + Number(p.amount.toString()), 0);
  const paid = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount.toString()), 0);
  const outstanding = total - paid;
  const filteredSupplier = supplierFilter
    ? suppliers.find((s) => s.id === supplierFilter)
    : null;

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={`Outstanding: ${formatMoneyDecimal(outstanding as unknown as { toString(): string })} · Paid: ${formatMoneyDecimal(paid as unknown as { toString(): string })}`}
        actions={
          <div className="flex items-center gap-2">
            <PrintButton />
            <AddPaymentToggle suppliers={suppliers} />
          </div>
        }
      />
      {filteredSupplier && (
        <div className="bg-moss-50 border-b border-moss-300 px-4 sm:px-6 py-2 flex items-center gap-3 text-xs">
          <span className="text-ink-secondary">
            Filtered by supplier:{" "}
            <strong className="text-ink-primary">{filteredSupplier.name}</strong>
          </span>
          <Link href="/payments" className="text-info hover:underline ml-auto">
            Clear ×
          </Link>
        </div>
      )}
      <div className="flex-1 overflow-auto payments-page">
        {/* v1.24.0: print-only letterhead. */}
        <div className="print-only-block max-w-6xl mx-auto px-6 pt-6 border-b-2 border-ink-primary pb-3 mb-6">
          <h1 className="font-display text-2xl text-ink-primary">{wedding.coupleLabel}</h1>
          <div className="text-xs text-ink-tertiary mt-1">
            Payments · {formatWeddingDate(wedding)} · {wedding.venue}
          </div>
        </div>
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
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
