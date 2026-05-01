import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { getWeddingSettings } from "@/lib/wedding-settings";
import { AddTableToggle } from "./AddTableToggle";
import { SeatingClient } from "./SeatingClient";
import { SeatingTabs } from "./SeatingTabs";

export default async function SeatingPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "seating");

  const settings = await getWeddingSettings();
  const [tables, allGuests] = await Promise.all([
    db.table.findMany({
      orderBy: { name: "asc" },
      include: {
        seats: {
          orderBy: { index: "asc" },
          include: {
            // v1.22.7: include rsvp so the canvas can color seat dots
            // by confirmation status (moss=attending, marigold=pending,
            // info=maybe, muted=declined).
            guest: { select: { id: true, firstName: true, lastName: true, rsvp: true } },
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
        // v1.27.7: extra fields for the GuestDetailPanel that opens
        // when the planner clicks (no drag) a seated guest dot. Keeps
        // the existing AllGuestsPanel use unchanged — it just reads
        // the same columns it always has.
        email: true,
        isChild: true,
        dietary: true,
        plusOneAllowed: true,
        plusOneName: true,
        notes: true,
        household: { select: { name: true } },
        // v1.49.0: guest-group memberships for the read-only chip
        // strip on the GuestDetailPanel.
        groups: { select: { id: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  // All custom guest groups for the GuestDetailPanel chip render.
  const allGuestGroups = await db.guestGroup.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, colour: true, side: true },
  });

  const allGuestsForClient = allGuests.map((g) => ({
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    rsvp: g.rsvp as "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE",
    currentSeatId: g.tableSeatId,
    currentTableName: g.tableSeat?.table.name ?? null,
    // v1.27.7: extras for the guest detail panel.
    email: g.email,
    isChild: g.isChild,
    dietary: g.dietary,
    plusOneAllowed: g.plusOneAllowed,
    plusOneName: g.plusOneName,
    notes: g.notes,
    householdName: g.household?.name ?? null,
    // v1.49.0: chip strip on the detail panel.
    groupIds: g.groups.map((x) => x.id),
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
      {/* v1.23.1: tab bar for Reception ↔ Ceremony. */}
      <SeatingTabs />
      {/* v1.23.2: notes + checklist relocated into the canvas
          right-hand sidebar (and a top strip in list view) — see
          SeatingClient + SeatingCanvas. */}
      <SeatingClient
        tables={tables.map((t) => ({
          ...t,
          // v1.23.0 schema columns retained but UI mounts dropped.
          notes: null,
          checklist: null,
        }))}
        allGuests={allGuestsForClient}
        allGuestGroups={allGuestGroups}
        canEdit={editable}
        seatingNotes={settings.seatingNotes ?? ""}
        seatingChecklist={settings.seatingChecklist ?? []}
      />
    </>
  );
}
