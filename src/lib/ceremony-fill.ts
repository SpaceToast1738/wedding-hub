// v1.47.0: pure-decision helpers for the ceremony seating canvas.
//
// v1.46.0 tinted whole rows by their assigned group's colour with no
// regard for how many members the group actually had — an 8-seat row
// looked the same whether the group had 5 members or 25. v1.47.0
// computes the actual fill: walk a group's assignments front-to-back
// (left-then-right within a row), pack each row aisle-outward, fill
// only as many seats as the group has members. Seats in an assigned
// row past the member count render as "spare" (faded tint, no glyph)
// so the couple can see at a glance "this row is reserved but the
// group has 4 fewer guests than seats".
//
// Aisle convention (the sketches in `CeremonyClient`'s SVG):
//   - LEFT side  — aisle is on the RIGHT edge (highest seatIndex).
//                  Pack from the rightmost seat backward.
//   - RIGHT side — aisle is on the LEFT edge (lowest seatIndex).
//                  Pack from seatIndex 0 forward.
//
// Pure: takes plain inputs (no Prisma client) so unit tests don't
// need a fixture DB.

export type AssignmentLite = {
  side: "LEFT" | "RIGHT";
  rowIndex: number;
  guestGroupId: string | null;
};

export type GroupLite = {
  id: string;
  name: string;
  colour: string | null;
  memberCount: number;
};

export type LayoutLite = {
  leftSeatsRow: number;
  rightSeatsRow: number;
};

export type GroupAllocation = {
  groupId: string;
  /** key = `${side}-${rowIndex}` → number of seats actually filled in that row. */
  rowFills: Map<string, number>;
  /** Sum of capacity across every row assigned to this group. */
  totalAssignedSeats: number;
  /** Sum of `rowFills` values (≤ totalAssignedSeats, ≤ memberCount). */
  totalFilledSeats: number;
  /** memberCount > totalAssignedSeats → how many guests can't fit. */
  shortfall: number;
  /** memberCount < totalAssignedSeats → spare seats in assigned rows. */
  surplus: number;
};

/**
 * Allocate one group's members across its assigned rows.
 *
 * Order: front rows first (lower `rowIndex`), with LEFT before RIGHT
 * for the same `rowIndex`. Each row fills up to its capacity, then
 * the next row picks up the overflow. Stops when `memberCount` is
 * exhausted; remaining rows record 0 filled (still in `rowFills`
 * for the renderer to mark them as spare).
 */
export function allocateGroup(
  group: GroupLite,
  assignments: AssignmentLite[],
  layout: LayoutLite,
): GroupAllocation {
  const ordered = assignments
    .filter((a) => a.guestGroupId === group.id)
    .sort((a, b) => {
      if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
      return a.side === "LEFT" ? -1 : 1;
    });

  const rowFills = new Map<string, number>();
  let totalAssigned = 0;
  let totalFilled = 0;
  let remaining = Math.max(0, group.memberCount);

  for (const a of ordered) {
    const capacity = a.side === "LEFT" ? layout.leftSeatsRow : layout.rightSeatsRow;
    const filled = Math.min(remaining, capacity);
    rowFills.set(`${a.side}-${a.rowIndex}`, filled);
    totalAssigned += capacity;
    totalFilled += filled;
    remaining -= filled;
  }

  return {
    groupId: group.id,
    rowFills,
    totalAssignedSeats: totalAssigned,
    totalFilledSeats: totalFilled,
    shortfall: remaining,
    surplus: totalAssigned - totalFilled,
  };
}

/** Build the full allocation map keyed by group id. */
export function allocateAll(
  groups: GroupLite[],
  assignments: AssignmentLite[],
  layout: LayoutLite,
): Map<string, GroupAllocation> {
  const out = new Map<string, GroupAllocation>();
  for (const g of groups) out.set(g.id, allocateGroup(g, assignments, layout));
  return out;
}

export type SeatFill =
  | { kind: "neutral" }
  | { kind: "filled"; colour: string | null; glyph: string | null; groupName: string }
  | { kind: "spare"; colour: string | null; groupName: string };

/**
 * Resolve a single seat's fill given all allocations. Returns
 * `neutral` for unassigned rows, `filled` for seats actually taken
 * by a member, `spare` for assigned rows past the group's member
 * count.
 */
export function resolveSeat(
  side: "LEFT" | "RIGHT",
  rowIndex: number,
  seatIndex: number,
  layout: LayoutLite,
  assignments: AssignmentLite[],
  groups: GroupLite[],
  allocations: Map<string, GroupAllocation>,
): SeatFill {
  const a = assignments.find((x) => x.side === side && x.rowIndex === rowIndex);
  if (!a || !a.guestGroupId) return { kind: "neutral" };
  const group = groups.find((g) => g.id === a.guestGroupId);
  if (!group) return { kind: "neutral" };
  const alloc = allocations.get(group.id);
  if (!alloc) return { kind: "neutral" };

  const filledInRow = alloc.rowFills.get(`${side}-${rowIndex}`) ?? 0;
  const capacity = side === "LEFT" ? layout.leftSeatsRow : layout.rightSeatsRow;

  // Pack aisle-outward. LEFT: aisle on right, fill backward from the
  // last seat. RIGHT: aisle on left, fill forward from seatIndex 0.
  const isFilled =
    side === "LEFT"
      ? seatIndex >= capacity - filledInRow
      : seatIndex < filledInRow;

  if (isFilled) {
    const glyph = group.name.trim().slice(0, 1).toUpperCase() || null;
    return {
      kind: "filled",
      colour: group.colour,
      glyph,
      groupName: group.name,
    };
  }
  return { kind: "spare", colour: group.colour, groupName: group.name };
}
