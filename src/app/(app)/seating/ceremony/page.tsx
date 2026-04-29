import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
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
        actions={
          <Link
            href="/seating"
            className="text-xs px-2.5 py-1.5 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-ink-primary transition-colors"
          >
            ← Reception
          </Link>
        }
      />
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
