import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { canEdit, canView, canViewMoney } from "@/lib/permissions";
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
  // v1.76.0: gate the Agreed / Paid / Outstanding rollup. Non-money
  // users see the supplier's status + contact info but not the £
  // contract value or running total.
  const showMoney = await canViewMoney(user);

  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ primary: "desc" }, { name: "asc" }] },
      contracts: { orderBy: { signedAt: "desc" } },
      communications: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { dueDate: "asc" } },
      // v1.28.0: tasks/questions/decisions linked to this supplier.
      // Sorted: open before done, then priority desc, then due-asc.
      tasks: {
        orderBy: [
          { status: "asc" },
          { priority: "desc" },
          { dueDate: "asc" },
        ],
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          priority: true,
          dueDate: true,
        },
      },
    },
  });
  if (!supplier) notFound();

  // v1.58.0 (XL4): BUILD cards whose budget line is supplier-linked.
  // BookBuildCard → BudgetLine → supplierId chain. Surfaces "this
  // supplier provides materials for these DIY projects" so the
  // couple can spot the cross-cutting relationships without
  // bouncing between /budget and /book.
  const buildCardsViaBudget = await db.bookBuildCard.findMany({
    where: { budgetLine: { supplierId: id } },
    select: {
      id: true,
      status: true,
      quantityNeeded: true,
      subsection: {
        select: {
          slug: true,
          title: true,
          section: { select: { slug: true, title: true } },
        },
      },
      budgetLine: { select: { id: true, description: true, estimated: true } },
    },
  });

  // v1.37.5 (P7b/C): "Used in setup" — find every BookSetupItem
  // whose `source` field matches this supplier's name (case-
  // insensitive). String match, no FK — matches the v1.30.5 cross-
  // module-reference rule (read-time queries, not denormalisation).
  const setupItems = await db.bookSetupItem.findMany({
    where: { source: { equals: supplier.name, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      quantity: true,
      packed: true,
      placed: true,
      card: {
        select: {
          id: true,
          space: true,
          subsection: {
            select: { slug: true, title: true, section: { select: { slug: true } } },
          },
        },
      },
    },
    orderBy: [{ packed: "asc" }, { placed: "asc" }],
  });

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
  // v1.77.0: over-agreed warning. When the running payment total
  // (paid + due) exceeds amountAgreed, surface a chip on the rollup
  // section so the couple knows the relationship has slipped beyond
  // the contracted price.
  const totalCommitted = totalPaid + totalDue;
  const agreedNumber =
    supplier.amountAgreed == null ? null : Number(supplier.amountAgreed.toString());
  const overAgreed =
    showMoney &&
    agreedNumber != null &&
    agreedNumber > 0 &&
    totalCommitted > agreedNumber;

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
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
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
              {showMoney && (
                <>
                  <Row label="Agreed" value={formatGBP(supplier.amountAgreed)} />
                  <Row label="Paid to date" value={formatGBP(totalPaid)} />
                  <Row label="Outstanding" value={formatGBP(totalDue)} />
                  {overAgreed && agreedNumber != null && (
                    <div className="px-4 py-2.5 bg-danger-bg/50 border-t border-danger-border">
                      <p className="text-[12px] text-danger font-medium">
                        ⚠ Over agreed by {formatGBP(totalCommitted - agreedNumber)} ·
                        committed {formatGBP(totalCommitted)} against {formatGBP(agreedNumber)}.
                      </p>
                    </div>
                  )}
                </>
              )}
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
            showMoney={showMoney}
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

          {/* v1.37.5 (P7b/C): Used in setup — items on any SETUP
              card whose `source` matches this supplier's name. Hidden
              when no rows match. */}
          {setupItems.length > 0 && (
            <section className="bg-surface border border-border-soft rounded-md shadow-sm">
              <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-ink-primary">
                  Used in setup
                  <span className="ml-2 text-[11px] font-normal text-ink-tertiary">
                    {setupItems.length} {setupItems.length === 1 ? "item" : "items"}
                  </span>
                </h2>
              </header>
              <ul className="divide-y divide-border-soft text-sm">
                {setupItems.map((it) => (
                  <li key={it.id} className="px-4 py-2 flex items-baseline gap-3">
                    <Link
                      href={`/book/${it.card.subsection.section.slug}#${it.card.subsection.slug}`}
                      className="text-ink-primary hover:text-moss-700 hover:underline truncate flex-1"
                      title={`${it.card.space ?? it.card.subsection.title} → ${it.name}`}
                    >
                      <span className="font-medium">{it.name}</span>
                      <span className="text-ink-tertiary"> · {it.card.space ?? it.card.subsection.title}</span>
                    </Link>
                    {it.quantity != null && (
                      <span className="text-xs text-ink-tertiary tabular-nums">
                        ×{it.quantity}
                      </span>
                    )}
                    <span className="flex items-center gap-1 flex-shrink-0">
                      {it.packed && (
                        <span className="text-[10px] uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-canvas border border-border-soft text-ink-tertiary">
                          packed
                        </span>
                      )}
                      {it.placed && (
                        <span className="text-[10px] uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-moss-50 border-moss-300 text-moss-700">
                          placed
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* v1.58.0 (XL4): BUILD cards whose budget line is supplier-
              linked. The chain BookBuildCard → BudgetLine.supplierId
              is invisible elsewhere; this surfaces "this supplier is
              the source of materials for these DIY projects". */}
          {buildCardsViaBudget.length > 0 && (
            <section className="bg-surface border border-border-soft rounded-md shadow-sm">
              <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-ink-primary">
                  Linked from DIY
                  <span className="ml-2 text-[11px] font-normal text-ink-tertiary">
                    {buildCardsViaBudget.length} {buildCardsViaBudget.length === 1 ? "card" : "cards"}
                  </span>
                </h2>
                <span className="text-[10px] text-ink-tertiary italic">
                  via budget line
                </span>
              </header>
              <ul className="divide-y divide-border-soft text-sm">
                {buildCardsViaBudget.map((c) => (
                  <li key={c.id} className="px-4 py-2 flex items-baseline gap-3">
                    <Link
                      href={`/book/${c.subsection.section.slug}#${c.subsection.slug}`}
                      className="text-ink-primary hover:text-moss-700 hover:underline truncate flex-1"
                    >
                      <span className="font-medium">{c.subsection.title}</span>
                      <span className="text-ink-tertiary"> · {c.subsection.section.title}</span>
                    </Link>
                    {c.status && (
                      <span className="text-[10px] uppercase tracking-wider text-ink-tertiary">{c.status}</span>
                    )}
                    {c.quantityNeeded != null && (
                      <span className="text-xs text-ink-tertiary tabular-nums">×{c.quantityNeeded}</span>
                    )}
                    {c.budgetLine && (
                      <Link
                        href="/budget"
                        className="text-[10px] text-info hover:underline whitespace-nowrap"
                        title={c.budgetLine.description}
                      >
                        £{c.budgetLine.estimated == null ? "—" : Number(c.budgetLine.estimated).toFixed(0)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* v1.28.0: Linked tasks/questions/decisions — read-only on
              this page. Click any row to deep-link into the task list
              filtered by this supplier (TODO once filter pill ships
              for v1.28.0). */}
          <section className="bg-surface border border-border-soft rounded-md shadow-sm">
            <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-ink-primary">
                Linked tasks &amp; questions
                <span className="ml-2 text-[11px] font-normal text-ink-tertiary">
                  {supplier.tasks.length}
                </span>
              </h2>
              <Link href={`/tasks?supplier=${supplier.id}`} className="text-[11px] text-info hover:underline">
                See all on Tasks →
              </Link>
            </header>
            {supplier.tasks.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-tertiary italic">
                No tasks linked yet. Add one from the Tasks page and pick this supplier.
              </p>
            ) : (
              <ul className="divide-y divide-border-soft text-sm">
                {supplier.tasks.map((t) => (
                  <li key={t.id} className="flex items-baseline gap-3 px-4 py-2">
                    <span className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider w-16">
                      {t.type === "TASK" ? "Task" : t.type === "QUESTION" ? "Question" : "Decision"}
                    </span>
                    <span className={[
                      "flex-1 min-w-0 truncate",
                      t.status === "DONE" ? "text-ink-tertiary line-through" : "text-ink-primary",
                    ].join(" ")}>
                      {t.title}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-ink-tertiary">
                      {t.status.toLowerCase().replace("_", " ")}
                    </span>
                    <span className="text-xs text-ink-tertiary tabular-nums w-20 text-right">
                      {formatDate(t.dueDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Linked payments — read-only on this page; full CRUD lives on /payments */}
          <section className="bg-surface border border-border-soft rounded-md shadow-sm">
            <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-ink-primary">
                Payments
                <span className="ml-2 text-[11px] font-normal text-ink-tertiary">
                  {supplier.payments.length}
                </span>
              </h2>
              <Link
                href={`/payments?supplier=${supplier.id}`}
                className="text-[11px] text-info hover:underline"
              >
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

