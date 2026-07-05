import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit, canView, canViewMoney } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddSupplierToggle } from "./AddSupplierToggle";
import { SuppliersClient } from "./SuppliersClient";

export default async function SuppliersPage() {
  const user = await requireUser();
  // v2.4.3: the detail page has gated canView("suppliers") since
  // v1.x but the list never did — any signed-in user could read the
  // whole roster regardless of their permission matrix.
  if (!(await canView(user, "suppliers"))) redirect("/");
  const editable = await canEdit(user, "suppliers");
  // v1.76.0: gate the Agreed amount on each supplier card. Without
  // money permission, users still see the supplier roster + status
  // but not the contracted prices.
  const showMoney = await canViewMoney(user);
  const suppliers = await db.supplier.findMany({
    // v2.5.1 (mod #7): status used to sort first, so promoting a
    // supplier's stage could reshuffle its whole category group (and
    // its position within it). Category (the group key) and name are
    // both effectively-stable fields — status is now a tie-breaker
    // only, applied after name. SuppliersClient re-sorts/re-groups
    // client-side too so this ordering holds even after client-side
    // status filtering.
    orderBy: [{ category: "asc" }, { name: "asc" }, { status: "asc" }],
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
        actions={editable ? <AddSupplierToggle showMoney={showMoney} /> : undefined}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          {/* v1.21.0: SuppliersClient owns the sticky-search state +
              category grouping. Server fetches + sums; client filters. */}
          <SuppliersClient suppliers={suppliers} canEdit={editable} showMoney={showMoney} />
        </div>
      </div>
    </>
  );
}
