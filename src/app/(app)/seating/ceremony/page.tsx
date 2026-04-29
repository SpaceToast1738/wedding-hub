import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { SeatingTabs } from "../SeatingTabs";
import { CeremonyClient } from "./CeremonyClient";

// v1.23.0: ceremony seating placeholder. No per-seat assignments yet —
// just configure rows + seats per side and render the layout. The
// reception canvas at /seating handles the dinner; this page handles
// the ceremony itself (aisle, rows, side allocations).
export default async function CeremonySeatingPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "seating");

  // Singleton fetch — falls back to schema defaults if no row exists.
  const row = await db.ceremonySeating.findUnique({ where: { id: 1 } });
  const seating = row ?? {
    leftRows: 8,
    leftSeatsRow: 8,
    rightRows: 8,
    rightSeatsRow: 8,
    notes: null,
  };

  const totalSeats =
    seating.leftRows * seating.leftSeatsRow + seating.rightRows * seating.rightSeatsRow;

  return (
    <>
      <PageHeader
        title="Ceremony seating"
        subtitle={`${totalSeats} seats · ${seating.leftRows}×${seating.leftSeatsRow} left / ${seating.rightRows}×${seating.rightSeatsRow} right`}
      />
      {/* v1.23.1: same Reception/Ceremony tab bar as the main
          /seating page so the IA is consistent across both views. */}
      <SeatingTabs />
      <CeremonyClient
        initial={{
          leftRows: seating.leftRows,
          leftSeatsRow: seating.leftSeatsRow,
          rightRows: seating.rightRows,
          rightSeatsRow: seating.rightSeatsRow,
          notes: seating.notes ?? "",
        }}
        canEdit={editable}
      />
    </>
  );
}
