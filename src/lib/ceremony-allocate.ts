// v1.48.0: auto-fill allocator for the ceremony seating canvas.
//
// v1.70.0 changes:
//   • GroupLite.members: GuestMember[] replaces memberCount: number so
//     the allocator has per-guest household info for clustering.
//   • Deduplication: a guest in multiple groups is only allocated once,
//     to the group with the lowest `order`. Later groups show a
//     `duplicateCount` in their GroupAllocation.
//   • Household clustering: within each group, members are emitted in
//     household order (all members of the same household adjacent) so
//     families sit together.
//   • Row-no-split: for BRIDE/GROOM (single-side) groups, if a
//     household cluster won't fit in the remaining seats of the current
//     row but fits in a full row, the cursor skips to the next row
//     start. The skipped seats appear as ordinary empty seats and can
//     be filled by later groups or left empty.
//
// Algorithm (per-group, in `order`):
//   1. Filter out members already claimed by an earlier group.
//   2. Cluster remaining members by household ID.
//   3. Determine eligible side(s) from `group.side`:
//        BRIDE  → LEFT only
//        GROOM  → RIGHT only
//        BOTH   → either side, picking whichever has more remaining
//                 capacity (balances BOTH groups across the canvas).
//   4. For BRIDE/GROOM: fill clusters with row-no-split heuristic.
//      For BOTH: fill clusters member-by-member (balancing per member).
//
// Pure: takes plain shapes (no Prisma client) so unit tests don't
// need a fixture DB. The page-level loader builds the inputs.

export type Side = "BRIDE" | "GROOM" | "BOTH";

export type GuestMember = {
  id: string;
  householdId: string | null;
  isChild: boolean;
};

export type GroupLite = {
  id: string;
  name: string;
  colour: string | null;
  side: Side;
  order: number;
  members: GuestMember[];
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
  /** uniqueCount > seated → how many unique members couldn't fit. */
  shortfall: number;
  /** Members not yet claimed by any earlier group. */
  uniqueCount: number;
  /** Members already allocated to an earlier group (skipped). */
  duplicateCount: number;
};

export type AllocationResult = {
  /** Seat key → fill. Only populated for filled seats. */
  fills: Map<SeatKey, SeatFill>;
  /** Per-group breakdown keyed by group id. */
  perGroup: Map<string, GroupAllocation>;
  /** Number of seats untouched (any group could still fill these). */
  unfilledLeft: number;
  unfilledRight: number;
  /** Total members skipped because they appeared in an earlier group. */
  duplicateGuests: number;
};

// Flattened seat sequence for one side, in fill order:
//   LEFT:  front row first, aisle (rightmost seatIndex) → far edge.
//   RIGHT: front row first, aisle (seatIndex 0) → far edge.
function generateFlatSeats(side: "LEFT" | "RIGHT", layout: LayoutLite): SeatKey[] {
  const out: SeatKey[] = [];
  const rows = side === "LEFT" ? layout.leftRows : layout.rightRows;
  const seatsPerRow = side === "LEFT" ? layout.leftSeatsRow : layout.rightSeatsRow;
  for (let r = 0; r < rows; r++) {
    if (side === "LEFT") {
      for (let s = seatsPerRow - 1; s >= 0; s--) {
        out.push(`LEFT-${r}-${s}` as SeatKey);
      }
    } else {
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

type HouseholdCluster = {
  members: GuestMember[];
};

// Group members by household, preserving order of first appearance.
function clusterByHousehold(members: GuestMember[]): HouseholdCluster[] {
  const map = new Map<string, GuestMember[]>();
  const order: string[] = [];
  for (const m of members) {
    const key = m.householdId ?? `__solo__${m.id}`;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(m);
  }
  return order.map((k) => ({ members: map.get(k)! }));
}

// Fill a single-side (BRIDE or GROOM) group with household clustering
// and the row-no-split heuristic. Returns the new cursor position and
// the shortfall (members that couldn't be seated).
function fillSingleSide(
  group: GroupLite,
  uniqueMembers: GuestMember[],
  flat: SeatKey[],
  cursor: number,
  seatsPerRow: number,
  commit: (key: SeatKey) => void,
): { newCursor: number; shortfall: number } {
  const clusters = clusterByHousehold(uniqueMembers);
  let cur = cursor;
  let shortfall = 0;

  for (const cluster of clusters) {
    const size = cluster.members.length;

    // Row-no-split: if a multi-member household won't fit in the
    // remaining seats of the current row but fits in a complete row,
    // advance the cursor to the next row start. The skipped seats
    // become empty and visible in unfilledLeft/Right.
    if (size > 1 && seatsPerRow > 0) {
      const posInRow = cur % seatsPerRow;
      const remainingInRow = seatsPerRow - posInRow;
      if (size > remainingInRow && size <= seatsPerRow && posInRow > 0) {
        cur += remainingInRow;
      }
    }

    for (let _mi = 0; _mi < cluster.members.length; _mi++) {
      if (cur >= flat.length) {
        shortfall++;
      } else {
        commit(flat[cur]!);
        cur++;
      }
    }
  }

  return { newCursor: cur, shortfall };
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
  const seenGuestIds = new Set<string>();
  let totalDuplicates = 0;

  function commit(group: GroupLite, key: SeatKey) {
    fills.set(key, {
      groupId: group.id,
      groupName: group.name,
      colour: group.colour,
      glyph: firstLetter(group.name),
    });
    perGroup.get(group.id)!.filledSeats.push(key);
  }

  for (const group of sorted) {
    const uniqueMembers = group.members.filter((m) => !seenGuestIds.has(m.id));
    const duplicateCount = group.members.length - uniqueMembers.length;
    totalDuplicates += duplicateCount;
    for (const m of uniqueMembers) seenGuestIds.add(m.id);

    perGroup.set(group.id, {
      groupId: group.id,
      filledSeats: [],
      shortfall: 0,
      uniqueCount: uniqueMembers.length,
      duplicateCount,
    });

    if (group.side === "BRIDE") {
      const { newCursor, shortfall } = fillSingleSide(
        group,
        uniqueMembers,
        leftFlat,
        leftCursor,
        layout.leftSeatsRow,
        (key) => commit(group, key),
      );
      leftCursor = newCursor;
      perGroup.get(group.id)!.shortfall = shortfall;
    } else if (group.side === "GROOM") {
      const { newCursor, shortfall } = fillSingleSide(
        group,
        uniqueMembers,
        rightFlat,
        rightCursor,
        layout.rightSeatsRow,
        (key) => commit(group, key),
      );
      rightCursor = newCursor;
      perGroup.get(group.id)!.shortfall = shortfall;
    } else {
      // BOTH — cluster by household then balance member-by-member
      // across whichever side has more remaining capacity. Row-no-split
      // is intentionally skipped for BOTH groups since they span sides.
      const clustered = clusterByHousehold(uniqueMembers).flatMap((c) => c.members);
      let shortfall = 0;
      for (let _i = 0; _i < clustered.length; _i++) {
        const leftRem = leftFlat.length - leftCursor;
        const rightRem = rightFlat.length - rightCursor;
        if (leftRem === 0 && rightRem === 0) {
          shortfall++;
        } else if (leftRem === 0) {
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
      }
      perGroup.get(group.id)!.shortfall = shortfall;
    }
  }

  return {
    fills,
    perGroup,
    unfilledLeft: leftFlat.length - leftCursor,
    unfilledRight: rightFlat.length - rightCursor,
    duplicateGuests: totalDuplicates,
  };
}
