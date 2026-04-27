import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddTableToggle } from "./AddTableToggle";
import { SeatingClient } from "./SeatingClient";

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

  const unseated = attendingGuests
    .filter((g) => !g.tableSeatId)
    .map((g) => ({ id: g.id, firstName: g.firstName, lastName: g.lastName }));
  const seatedCount = tables.reduce((n, t) => n + t.seats.filter((s) => s.guest).length, 0);
  const totalCapacity = tables.reduce((n, t) => n + t.capacity, 0);

  return (
    <>
      <PageHeader
        title="Seating"
        subtitle={`${tables.length} tables · ${seatedCount}/${totalCapacity} seats filled · ${unseated.length} unseated`}
        actions={editable ? <AddTableToggle /> : undefined}
      />
      <SeatingClient tables={tables} unseatedGuests={unseated} canEdit={editable} />
    </>
  );
}
