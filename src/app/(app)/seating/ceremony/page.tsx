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
//
// v1.46.0: per-row group assignments. Each row of seats can be tagged
// with a custom GuestGroup; the canvas tints every seat in the row
// with the group's colour and overlays a glyph (first letter) for
// colour-blind accessibility. Row assignments are couple-only via
// the panel below the canvas.
export default async function CeremonySeatingPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "seating");

  // Three reads run in parallel — layout config, row assignments,
  // and the custom guest groups for the picker / legend. All are
  // small reads; no need for a join.
  const [row, rowAssignments, groupsRaw] = await Promise.all([
    db.ceremonySeating.findUnique({ where: { id: 1 } }),
    db.ceremonyRow.findMany({
      orderBy: [{ side: "asc" }, { rowIndex: "asc" }],
      select: {
        side: true,
        rowIndex: true,
        guestGroupId: true,
        notes: true,
      },
    }),
    db.guestGroup.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        colour: true,
        _count: { select: { members: true } },
      },
    }),
  ]);

  const seating = row ?? {
    leftRows: 8,
    leftSeatsRow: 8,
    rightRows: 8,
    rightSeatsRow: 8,
    notes: null,
  };

  const totalSeats =
    seating.leftRows * seating.leftSeatsRow + seating.rightRows * seating.rightSeatsRow;

  // Coerce the polymorphic `side` string to the typed union the
  // client expects. Schema stores "LEFT" | "RIGHT" but Prisma
  // returns String. (Using String not enum keeps labelling
  // configurable in future without a migration.)
  const initialAssignments = rowAssignments
    .filter((a): a is { side: "LEFT" | "RIGHT"; rowIndex: number; guestGroupId: string | null; notes: string | null } =>
      a.side === "LEFT" || a.side === "RIGHT",
    );

  const groups = groupsRaw.map((g) => ({
    id: g.id,
    name: g.name,
    colour: g.colour,
    memberCount: g._count.members,
  }));

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
        initialAssignments={initialAssignments}
        groups={groups}
        canEdit={editable}
      />
    </>
  );
}
