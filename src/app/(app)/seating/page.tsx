import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddTableToggle } from "./AddTableToggle";
import { TableCard } from "./TableCard";

export default async function SeatingPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "seating");

  const [tables, attendingGuests] = await Promise.all([
    db.table.findMany({
      orderBy: { name: "asc" },
      include: {
        seats: {
          orderBy: { index: "asc" },
          include: {
            guest: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
    db.guest.findMany({
      where: { rsvp: "ATTENDING", archived: false },
      select: { id: true, firstName: true, lastName: true, tableSeatId: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const unseated = attendingGuests.filter((g) => !g.tableSeatId);
  const seatedCount = tables.reduce((n, t) => n + t.seats.filter((s) => s.guest).length, 0);
  const totalCapacity = tables.reduce((n, t) => n + t.capacity, 0);

  return (
    <>
      <PageHeader
        title="Seating"
        subtitle={`${tables.length} tables · ${seatedCount}/${totalCapacity} seats filled · ${unseated.length} unseated attendees`}
        actions={editable ? <AddTableToggle /> : undefined}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 space-y-4">
          <div className="bg-marigold-100/40 border border-marigold-700/20 text-marigold-700 rounded-md px-4 py-2.5 text-xs">
            ⓘ The drag-and-drop seating canvas comes in a later phase. For now, assign guests to seats from the dropdowns below.
          </div>
          {tables.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              No tables yet. {editable && "Add the first one above."}
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {tables.map((t) => (
                <TableCard key={t.id} table={t} unseatedGuests={unseated} canEdit={editable} />
              ))}
            </div>
          )}
          {unseated.length > 0 && (
            <section className="bg-surface border border-border-soft rounded-md p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-ink-primary mb-2">Unseated attendees</h2>
              <ul className="flex flex-wrap gap-2">
                {unseated.map((g) => (
                  <li key={g.id} className="text-xs text-ink-secondary bg-canvas border border-border-soft rounded-md px-2 py-1">
                    {g.firstName} {g.lastName}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
