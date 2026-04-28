import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddSupplierToggle } from "./AddSupplierToggle";
import { SuppliersClient } from "./SuppliersClient";

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
  const lead = suppliers.filter(
    (s) => s.status === "SHORTLIST" || s.status === "CONTACTED" || s.status === "QUOTED",
  ).length;

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle={`${booked} booked · ${lead} in pipeline · ${suppliers.length} total`}
        actions={editable ? <AddSupplierToggle /> : undefined}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          {/* v1.21.0: SuppliersClient owns the sticky-search state +
              category grouping. Server fetches + sums; client filters. */}
          <SuppliersClient suppliers={suppliers} canEdit={editable} />
        </div>
      </div>
    </>
  );
}
