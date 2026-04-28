import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { canEdit, canView } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { SupplierDetailClient } from "./SupplierDetailClient";
import { CustomFieldsBlock } from "./CustomFieldsBlock";

const STATUS_PILL: Record<string, "LEAD" | "BOOKED" | "PAID" | "DECLINED"> = {
  SHORTLIST: "LEAD",
  CONTACTED: "LEAD",
  QUOTED: "LEAD",
  BOOKED: "BOOKED",
  PAID: "PAID",
  REJECTED: "DECLINED",
};

function formatGBP(amount: unknown): string {
  if (amount === null || amount === undefined) return "—";
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "—";
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!(await canView(user, "suppliers"))) notFound();
  const editable = await canEdit(user, "suppliers");

  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ primary: "desc" }, { name: "asc" }] },
      contracts: { orderBy: { signedAt: "desc" } },
      communications: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { dueDate: "asc" } },
    },
  });
  if (!supplier) notFound();

  // v1.22.0: pull custom-field defs scoped to suppliers + the values
  // for this row so CustomFieldsBlock can render at the bottom.
  const customFieldDefs = await db.customField.findMany({
    where: { entity: "supplier" },
    orderBy: { order: "asc" },
  });
  const customFieldDefsTyped: CustomFieldDef[] = customFieldDefs.map((f) => ({
    id: f.id,
    entity: f.entity,
    name: f.name,
    type: f.type as "text" | "number" | "date" | "select",
    options: f.options,
    order: f.order,
  }));
  const customFieldValues =
    (supplier.customFieldValues as Record<string, string | number | null> | null) ?? {};

  const totalPaid = supplier.payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalDue = supplier.payments
    .filter((p) => p.status !== "PAID")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <>
      <PageHeader
        title={supplier.name}
        subtitle={supplier.category}
        actions={
          <Link
            href="/suppliers"
            className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700"
          >
            ← All suppliers
          </Link>
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-5">
          {/* Status + headline numbers */}
          <section className="bg-surface border border-border-soft rounded-md shadow-sm">
            <div className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <StatusPill status={STATUS_PILL[supplier.status] ?? "LEAD"} />
                <span className="text-xs text-ink-tertiary capitalize">
                  {supplier.status.toLowerCase()}
                </span>
              </div>
              {supplier.website && (
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-info hover:underline truncate max-w-[280px]"
                >
                  {supplier.website}
                </a>
              )}
            </div>
            <dl className="divide-y divide-border-soft text-sm">
              <Row label="Agreed" value={formatGBP(supplier.amountAgreed)} />
              <Row label="Paid to date" value={formatGBP(totalPaid)} />
              <Row label="Outstanding" value={formatGBP(totalDue)} />
              {supplier.notes && (
                <div className="grid grid-cols-3 gap-3 px-4 py-2.5">
                  <dt className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider self-start">
                    Notes
                  </dt>
                  <dd className="col-span-2 text-ink-primary whitespace-pre-wrap">{supplier.notes}</dd>
                </div>
              )}
            </dl>
          </section>

          <SupplierDetailClient
            supplierId={supplier.id}
            canEdit={editable}
            contacts={supplier.contacts.map((c) => ({
              id: c.id,
              name: c.name,
              role: c.role,
              email: c.email,
              phone: c.phone,
              primary: c.primary,
            }))}
            contracts={supplier.contracts.map((c) => ({
              id: c.id,
              signed: c.signed,
              signedAt: c.signedAt,
              amount: c.amount === null ? null : Number(c.amount),
              notes: c.notes,
            }))}
            communications={supplier.communications.map((c) => ({
              id: c.id,
              channel: c.channel,
              summary: c.summary,
              followUpAt: c.followUpAt,
              createdAt: c.createdAt,
            }))}
          />

          <CustomFieldsBlock
            supplierId={supplier.id}
            fields={customFieldDefsTyped}
            values={customFieldValues}
            canEdit={editable}
          />

          {/* Linked payments — read-only on this page; full CRUD lives on /payments */}
          <section className="bg-surface border border-border-soft rounded-md shadow-sm">
            <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-ink-primary">
                Payments
                <span className="ml-2 text-[11px] font-normal text-ink-tertiary">
                  {supplier.payments.length}
                </span>
              </h2>
              <Link href="/payments" className="text-[11px] text-info hover:underline">
                Manage on Payments →
              </Link>
            </header>
            {supplier.payments.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-tertiary italic">No payments tracked.</p>
            ) : (
              <ul className="divide-y divide-border-soft text-sm">
                {supplier.payments.map((p) => (
                  <li key={p.id} className="flex items-baseline gap-3 px-4 py-2">
                    <span className="text-ink-primary flex-1 min-w-0 truncate">
                      {p.description ?? "Payment"}
                    </span>
                    <span className="text-xs text-ink-tertiary">{formatDate(p.dueDate)}</span>
                    <span className="text-sm tabular-nums font-semibold text-ink-primary">
                      {formatGBP(p.amount)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-ink-tertiary">
                      {p.status.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-4 py-2.5">
      <dt className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider self-center">
        {label}
      </dt>
      <dd className="col-span-2 text-ink-primary tabular-nums">{value}</dd>
    </div>
  );
}

