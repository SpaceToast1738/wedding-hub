import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { PageLinkedTasksStrip } from "@/components/ui/PageLinkedTasksStrip";
import { SeatingTabs } from "../SeatingTabs";
import { CeremonyClient } from "./CeremonyClient";

// v1.23.0: ceremony seating placeholder.
// v1.46.0: per-row group assignments via the CeremonyRow table.
// v1.47.0: aisle-outward fill from member counts within each row.
// v1.48.0: auto-fill — couple manages an ordered list of guest
// groups (each with side BRIDE/GROOM/BOTH); allocator walks the
// list in order, packing each group's members into eligible seats.
// CeremonyRow rows are no longer rendered; preserved one release
// as a buffer (see schema.prisma comment).
export default async function CeremonySeatingPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "seating");

  const [row, groupsRaw, navTagForPage] = await Promise.all([
    db.ceremonySeating.findUnique({ where: { id: 1 } }),
    db.guestGroup.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        colour: true,
        side: true,
        order: true,
        _count: { select: { members: true } },
      },
    }),
    // v1.52.0 (backlog #7): tasks tagged with the page's nav tag
    // surface as a strip below the header.
    db.navTag.findFirst({
      where: { route: "/seating/ceremony" },
      select: { id: true, name: true },
    }),
  ]);

  const linkedTasks = navTagForPage
    ? await db.task.findMany({
        where: { navTags: { some: { id: navTagForPage.id } } },
        orderBy: [
          { status: "asc" },
          { priority: "desc" },
          { dueDate: "asc" },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          priority: true,
          dueDate: true,
        },
      })
    : [];

  const seating = row ?? {
    leftRows: 8,
    leftSeatsRow: 8,
    rightRows: 8,
    rightSeatsRow: 8,
    notes: null,
  };

  const totalSeats =
    seating.leftRows * seating.leftSeatsRow + seating.rightRows * seating.rightSeatsRow;

  const groups = groupsRaw.map((g) => ({
    id: g.id,
    name: g.name,
    colour: g.colour,
    side: g.side as "BRIDE" | "GROOM" | "BOTH",
    order: g.order,
    memberCount: g._count.members,
  }));

  return (
    <>
      <PageHeader
        title="Ceremony seating"
        subtitle={`${totalSeats} seats · ${seating.leftRows}×${seating.leftSeatsRow} left / ${seating.rightRows}×${seating.rightSeatsRow} right`}
      />
      <SeatingTabs />
      {navTagForPage && (
        <PageLinkedTasksStrip
          tasks={linkedTasks}
          navTagName={navTagForPage.name}
        />
      )}
      <CeremonyClient
        initial={{
          leftRows: seating.leftRows,
          leftSeatsRow: seating.leftSeatsRow,
          rightRows: seating.rightRows,
          rightSeatsRow: seating.rightSeatsRow,
          notes: seating.notes ?? "",
        }}
        groups={groups}
        canEdit={editable}
      />
    </>
  );
}
