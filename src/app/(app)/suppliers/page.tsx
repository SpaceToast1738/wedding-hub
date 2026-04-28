import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddSupplierToggle } from "./AddSupplierToggle";
import { SupplierCard } from "./SupplierCard";

export default async function SuppliersPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "suppliers");
  const suppliers = await db.supplier.findMany({
    orderBy: [{ status: "asc" }, { category: "asc" }, { name: "asc" }],
    // B4 (v1.11.0): pull the most-recent communication so the card
    // can render a "Last: <summary> · <relative date>" line.
    include: {
      communications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { summary: true, createdAt: true, channel: true },
      },
    },
  });

  const booked = suppliers.filter((s) => s.status === "BOOKED" || s.status === "PAID").length;
  const lead = suppliers.filter((s) => s.status === "SHORTLIST" || s.status === "CONTACTED" || s.status === "QUOTED").length;

  // Group by category
  const byCategory = new Map<string, typeof suppliers>();
  for (const s of suppliers) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle={`${booked} booked · ${lead} in pipeline · ${suppliers.length} total`}
        actions={editable ? <AddSupplierToggle /> : undefined}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {suppliers.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              No suppliers yet. {editable && "Add your first one above."}
            </p>
          ) : (
            Array.from(byCategory.entries()).map(([cat, list]) => (
              <section key={cat}>
                <h2 className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider mb-2">{cat}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((s) => (
                    <SupplierCard key={s.id} supplier={s} canEdit={editable} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </>
  );
}
