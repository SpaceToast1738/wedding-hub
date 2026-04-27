import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddHouseholdToggle } from "./AddHouseholdToggle";
import { HouseholdBlock } from "./HouseholdBlock";

export default async function GuestsPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "guests");

  const households = await db.household.findMany({
    orderBy: [{ side: "asc" }, { name: "asc" }],
    include: {
      guests: {
        where: { archived: false },
        orderBy: [{ isChild: "asc" }, { firstName: "asc" }],
      },
    },
  });

  const totalGuests = households.reduce((n, h) => n + h.guests.length, 0);
  const attending = households.reduce((n, h) => n + h.guests.filter((g) => g.rsvp === "ATTENDING").length, 0);
  const pending = households.reduce((n, h) => n + h.guests.filter((g) => g.rsvp === "PENDING").length, 0);
  const declined = households.reduce((n, h) => n + h.guests.filter((g) => g.rsvp === "DECLINED").length, 0);

  return (
    <>
      <PageHeader
        title="Guests"
        subtitle={`${totalGuests} invited · ${attending} attending · ${pending} pending · ${declined} declined`}
        actions={
          editable ? (
            <>
              <Link
                href="/guests/import"
                className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700"
              >
                Import CSV
              </Link>
              <AddHouseholdToggle />
            </>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-4">
          {households.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              No households yet. {editable && "Add one above."}
            </p>
          ) : (
            households.map((h) => <HouseholdBlock key={h.id} household={h} canEdit={editable} />)
          )}
        </div>
      </div>
    </>
  );
}
