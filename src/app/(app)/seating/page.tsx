import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { getWeddingSettings } from "@/lib/wedding-settings";
import { AddTableToggle } from "./AddTableToggle";
import { SeatingClient } from "./SeatingClient";
import { PlanNotesPanel } from "./PlanNotesPanel";

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
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/seating/ceremony"
              className="text-xs px-2.5 py-1.5 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-ink-primary transition-colors"
            >
              Ceremony →
            </Link>
            {editable && <AddTableToggle />}
          </div>
        }
      />
      {/* v1.23.0: plan-level notes (table-size policy, board-game
          allocation, day-of staffing). Collapsed by default to keep
          the canvas focused. */}
      <PlanNotesPanel
        initial={settings.seatingNotes ?? ""}
        canEdit={editable}
      />
      <SeatingClient
        tables={tables.map((t) => ({
          ...t,
          notes: t.notes ?? null,
          checklist: (t.checklist as { id: string; label: string; done: boolean }[] | null) ?? null,
        }))}
        allGuests={allGuestsForClient}
        canEdit={editable}
      />
    </>
  );
}
