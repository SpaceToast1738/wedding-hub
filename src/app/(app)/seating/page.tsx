import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddTableToggle } from "./AddTableToggle";
import { SeatingClient } from "./SeatingClient";

export default async function SeatingPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "seating");

  const [tables, allGuests] = await Promise.all([
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
    // v1.20.6: fetch ALL non-archived guests, not just attending ones,
    // so the side panel can show RSVP status at a glance and the user
    // can drag pending guests onto provisional seats. tableSeat→table
    // join lets the panel show "currently at X" subscript.
    db.guest.findMany({
      where: { archived: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        rsvp: true,
        tableSeatId: true,
        tableSeat: { select: { table: { select: { id: true, name: true } } } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const allGuestsForClient = allGuests.map((g) => ({
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    rsvp: g.rsvp as "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE",
    currentSeatId: g.tableSeatId,
    currentTableName: g.tableSeat?.table.name ?? null,
  }));
  const seatedCount = tables.reduce((n, t) => n + t.seats.filter((s) => s.guest).length, 0);
  const totalCapacity = tables.reduce((n, t) => n + t.capacity, 0);
  const attendingUnseated = allGuestsForClient.filter(
    (g) => g.rsvp === "ATTENDING" && !g.currentSeatId,
  ).length;

  return (
    <>
      <PageHeader
        title="Seating"
        subtitle={`${tables.length} tables · ${seatedCount}/${totalCapacity} seats filled · ${attendingUnseated} attending unseated`}
        actions={editable ? <AddTableToggle /> : undefined}
      />
      <SeatingClient tables={tables} allGuests={allGuestsForClient} canEdit={editable} />
    </>
  );
}
