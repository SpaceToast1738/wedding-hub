import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { requireUser } from "@/lib/actions";
import { formatMoneyDecimal } from "@/lib/format";
import { formatWeddingDate, getWeddingSettings } from "@/lib/wedding-settings";
import { EmptyPayments, EmptyState } from "@/components/ui/Illustrations";
import { InlinePaymentGrid } from "./InlinePaymentGrid";
import { PaymentRow } from "./PaymentRow";

// v1.57.0 (XL8): accepts `?supplier=<id>` filter — supplier-detail
// "Manage on Payments →" deep-link now lands at the filtered list
// instead of the unfiltered firehose. Pattern mirrors `/tasks`.
//
// v1.75.0: page also loads BookBuildCard + BookOutfit data so the
// inline grid (and PaymentRow edit mode) can offer per-row links to
// the specific BUILD material or outfit-item that a payment paid for.
// Plus the global file list, for receipt picking.
export default async function PaymentsPage({
  searchParams,
}: {
  // v1.77.0: + `?category=<id>` to scope the list to one budget
  // category. Mirrors the v1.57.0 `?supplier=` pattern. The two are
  // composable — `?supplier=X&category=Y` AND-filters.
  searchParams: Promise<{ supplier?: string; category?: string }>;
}) {
  const user = await requireUser();
  if (!user.isCouple) redirect("/");
  const wedding = await getWeddingSettings();
  const sp = await searchParams;
  const supplierFilter = typeof sp.supplier === "string" ? sp.supplier : null;
  const categoryFilter = typeof sp.category === "string" ? sp.category : null;

  // v1.77.0: combine filters via Prisma AND so each chip stacks.
  const paymentsWhere: Record<string, unknown> = {};
  if (supplierFilter) paymentsWhere.supplierId = supplierFilter;
  if (categoryFilter) paymentsWhere.budgetLine = { categoryId: categoryFilter };

  const [payments, suppliers, buildCardsRaw, outfitCardsRaw, allFiles, categories] = await Promise.all([
    db.payment.findMany({
      where: Object.keys(paymentsWhere).length > 0 ? paymentsWhere : undefined,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      // v1.75.0: surface receipt count + linked book-row identity for
      // PaymentRow's chip rendering. Materials surface their parent
      // card's title via the cascading include; outfit items surface
      // their card's personName + role.
      include: {
        bookBuildMaterial: {
          select: {
            id: true,
            name: true,
            card: { select: { subsection: { select: { title: true, slug: true } } } },
          },
        },
        bookOutfitItem: {
          select: {
            id: true,
            itemLabel: true,
            card: {
              select: {
                personName: true,
                subsection: { select: { title: true, slug: true } },
              },
            },
          },
        },
        // v1.79.0: linked BudgetLine for the in-row chip + edit picker.
        budgetLine: {
          select: {
            id: true,
            description: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    // v1.75.0: BUILD cards for the link picker. We surface the
    // subsection title (the user's mental model is "the centerpieces
    // page", not "the BUILD card on the centerpieces page") and the
    // material list with current ordered state so the picker can grey
    // out already-ordered rows.
    db.bookBuildCard.findMany({
      include: {
        subsection: { select: { id: true, title: true, slug: true } },
        materials: {
          orderBy: { order: "asc" },
          select: { id: true, name: true, ordered: true },
        },
      },
    }),
    // v1.75.0: BookOutfit (per-item) cards for the link picker. We
    // join through to the parent card for the personName.
    db.bookOutfit.findMany({
      orderBy: [{ order: "asc" }],
      select: {
        id: true,
        itemLabel: true,
        card: { select: { personName: true, role: true } },
      },
    }),
    // v1.75.0: file list for the "pick existing receipt" path.
    db.file.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, mimeType: true },
    }),
    // v1.77.0: budget categories for the filter banner display.
    // v1.79.0: + lines per category for the per-row budget-line
    // picker so payments roll up into /budget via the B2 contract.
    db.budgetCategory.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        lines: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true, description: true },
        },
      },
    }),
  ]);

  const total = payments.reduce((sum, p) => sum + Number(p.amount.toString()), 0);
  const paid = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount.toString()), 0);
  const outstanding = total - paid;
  const filteredSupplier = supplierFilter
    ? suppliers.find((s) => s.id === supplierFilter)
    : null;
  // v1.77.0: resolve the category filter target's display name for
  // the filter banner.
  const filteredCategory = categoryFilter
    ? categories.find((c) => c.id === categoryFilter)
    : null;

  // v1.75.0: derive the autofill datalist for the description input
  // from the existing payments query (no extra round-trip). Dedupe,
  // alphabetise, cap at 50.
  const recentDescriptions = Array.from(
    new Set(
      payments
        .map((p) => p.description.trim())
        .filter((d) => d.length > 0),
    ),
  )
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 50);

  // v1.75.0: shape BUILD options for the link picker — flattened to
  // {cardTitle, materials} so the cascading select renders without
  // the consumer having to dig into Prisma's nested shape.
  const buildOptions = buildCardsRaw
    .filter((c) => c.materials.length > 0)
    .map((c) => ({
      cardId: c.id,
      cardTitle: c.subsection.title,
      cardSlug: c.subsection.slug,
      materials: c.materials.map((m) => ({
        id: m.id,
        name: m.name,
        ordered: m.ordered,
      })),
    }));

  const outfitOptions = outfitCardsRaw.map((o) => ({
    id: o.id,
    label: [
      o.card.personName ?? "Outfit",
      o.card.role ? `(${o.card.role})` : null,
      o.itemLabel ? `— ${o.itemLabel}` : null,
    ]
      .filter(Boolean)
      .join(" "),
  }));

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={`Outstanding: ${formatMoneyDecimal(outstanding as unknown as { toString(): string })} · Paid: ${formatMoneyDecimal(paid as unknown as { toString(): string })}`}
        actions={
          <div className="flex items-center gap-2">
            <PrintButton />
          </div>
        }
      />
      {filteredSupplier && (
        <div className="bg-moss-50 border-b border-moss-300 px-4 sm:px-6 py-2 flex items-center gap-3 text-xs">
          <span className="text-ink-secondary">
            Filtered by supplier:{" "}
            <strong className="text-ink-primary">{filteredSupplier.name}</strong>
          </span>
          <Link
            href={categoryFilter ? `/payments?category=${categoryFilter}` : "/payments"}
            className="text-info hover:underline ml-auto"
          >
            Clear ×
          </Link>
        </div>
      )}
      {filteredCategory && (
        <div className="bg-moss-50 border-b border-moss-300 px-4 sm:px-6 py-2 flex items-center gap-3 text-xs">
          <span className="text-ink-secondary">
            Filtered by category:{" "}
            <strong className="text-ink-primary">{filteredCategory.name}</strong>
          </span>
          <Link
            href={supplierFilter ? `/payments?supplier=${supplierFilter}` : "/payments"}
            className="text-info hover:underline ml-auto"
          >
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
          {/* v1.75.0: Excel-style multi-row inline grid replaces the
              v1.74.0 single-row InlineAddPaymentRow. Per-row Enter
              commits; description has datalist autofill from past
              payments; supplier picker keeps the inline-create flow;
              new 🔗 link + 📎 receipt chips per row. */}
          <div className="no-print">
            <InlinePaymentGrid
              suppliers={suppliers}
              recentDescriptions={recentDescriptions}
              buildOptions={buildOptions}
              outfitOptions={outfitOptions}
              files={allFiles}
              budgetCategories={categories}
            />
          </div>
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
                    <th className="px-4 py-2 text-left">Linked / Receipts</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <PaymentRow
                      key={p.id}
                      payment={p}
                      suppliers={suppliers}
                      files={allFiles}
                      budgetCategories={categories}
                      canEdit={true}
                    />
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
