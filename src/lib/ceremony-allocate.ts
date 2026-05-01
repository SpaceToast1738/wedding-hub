// v1.48.0: auto-fill allocator for the ceremony seating canvas.
//
// Replaces the v1.46.0 / v1.47.0 manual per-row assignment model.
// The couple now manages a single ordered list of GuestGroups (each
// with a `side` constraint and member count); the canvas walks the
// list in order and packs members into seats automatically.
//
// Algorithm (per-group, in `order`):
//   1. Determine eligible side(s) from `group.side`:
//        BRIDE  → LEFT only
//        GROOM  → RIGHT only
//        BOTH   → either side, picking whichever has more remaining
//                 capacity at the moment the seat is taken (balances
//                 BOTH groups across the canvas instead of dumping
//                 them all on one side)
//   2. Walk eligible seats in fill order:
//        - Front rows first (lower rowIndex)
//        - Within a row: aisle-outward
//          • LEFT side: aisle is at the right edge — fill from
//            highest seatIndex backward
//          • RIGHT side: aisle is at the left edge — fill from
//            seatIndex 0 forward
//   3. Take `min(memberCount, remainingSeats)` consecutive seats.
//      Any leftover members become a shortfall for that group.
//
// Pure: takes plain shapes (no Prisma client) so unit tests don't
// need a fixture DB. The page-level loader builds the inputs and
// passes them in.

export type Side = "BRIDE" | "GROOM" | "BOTH";

export type GroupLite = {
  id: string;
  name: string;
  colour: string | null;
  side: Side;
  order: number;
  memberCount: number;
};

export type LayoutLite = {
  leftRows: number;
  leftSeatsRow: number;
  rightRows: number;
  rightSeatsRow: number;
};

export type SeatKey = `LEFT-${number}-${number}` | `RIGHT-${number}-${number}`;

export type SeatFill = {
  groupId: string;
  groupName: string;
  colour: string | null;
  glyph: string | null;
};

export type GroupAllocation = {
  groupId: string;
  /** Seat keys actually filled by this group's members. */
  filledSeats: SeatKey[];
  /** memberCount > capacity for the eligible side(s) → how many can't fit. */
  shortfall: number;
};

export type AllocationResult = {
  /** Seat key → fill. Only populated for filled seats. */
  fills: Map<SeatKey, SeatFill>;
  /** Per-group breakdown keyed by group id. */
  perGroup: Map<string, GroupAllocation>;
  /** Number of seats untouched (any group could still fill these). */
  unfilledLeft: number;
  unfilledRight: number;
};

function generateFlatSeats(side: "LEFT" | "RIGHT", layout: LayoutLite): SeatKey[] {
  const out: SeatKey[] = [];
  const rows = side === "LEFT" ? layout.leftRows : layout.rightRows;
  const seatsPerRow = side === "LEFT" ? layout.leftSeatsRow : layout.rightSeatsRow;
  for (let r = 0; r < rows; r++) {
    if (side === "LEFT") {
      // Aisle is at the right edge — fill from highest seatIndex backward.
      for (let s = seatsPerRow - 1; s >= 0; s--) {
        out.push(`LEFT-${r}-${s}` as SeatKey);
      }
    } else {
      // Aisle is at the left edge — fill from seatIndex 0 forward.
      for (let s = 0; s < seatsPerRow; s++) {
        out.push(`RIGHT-${r}-${s}` as SeatKey);
      }
    }
  }
  return out;
}

function firstLetter(s: string): string | null {
  const c = s.trim().slice(0, 1).toUpperCase();
  return c || null;
}

/**
 * Allocate every group's members across the ceremony canvas.
 * Walks `groups` sorted ascending by `order`. Returns the seat
 * fill map plus per-group totals.
 */
export function allocateCeremony(
  groups: GroupLite[],
  layout: LayoutLite,
): AllocationResult {
  const sorted = [...groups].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const leftFlat = generateFlatSeats("LEFT", layout);
  const rightFlat = generateFlatSeats("RIGHT", layout);
  let leftCursor = 0;
  let rightCursor = 0;

  const fills = new Map<SeatKey, SeatFill>();
  const perGroup = new Map<string, GroupAllocation>();

  function commit(group: GroupLite, key: SeatKey) {
    fills.set(key, {
      groupId: group.id,
      groupName: group.name,
      colour: group.colour,
      glyph: firstLetter(group.name),
    });
    const g = perGroup.get(group.id);
    if (g) g.filledSeats.push(key);
  }

  for (const group of sorted) {
    perGroup.set(group.id, {
      groupId: group.id,
      filledSeats: [],
      shortfall: 0,
    });
    let remaining = Math.max(0, group.memberCount);

    if (group.side === "BRIDE") {
      while (remaining > 0 && leftCursor < leftFlat.length) {
        commit(group, leftFlat[leftCursor]!);
        leftCursor++;
        remaining--;
      }
    } else if (group.side === "GROOM") {
      while (remaining > 0 && rightCursor < rightFlat.length) {
        commit(group, rightFlat[rightCursor]!);
        rightCursor++;
        remaining--;
      }
    } else {
      // BOTH — balance across sides, taking from whichever side
      // has more remaining capacity. Ties go to LEFT (matches the
      // generic "front-and-aisle first" preference).
      while (remaining > 0 && (leftCursor < leftFlat.length || rightCursor < rightFlat.length)) {
        const leftRem = leftFlat.length - leftCursor;
        const rightRem = rightFlat.length - rightCursor;
        if (leftRem === 0) {
          commit(group, rightFlat[rightCursor]!);
          rightCursor++;
        } else if (rightRem === 0) {
          commit(group, leftFlat[leftCursor]!);
          leftCursor++;
        } else if (leftRem >= rightRem) {
          commit(group, leftFlat[leftCursor]!);
          leftCursor++;
        } else {
          commit(group, rightFlat[rightCursor]!);
          rightCursor++;
        }
        remaining--;
      }
    }

    // Anything left over is a shortfall for this group.
    const ga = perGroup.get(group.id);
    if (ga) ga.shortfall = remaining;
  }

  return {
    fills,
    perGroup,
    unfilledLeft: leftFlat.length - leftCursor,
    unfilledRight: rightFlat.length - rightCursor,
  };
}
