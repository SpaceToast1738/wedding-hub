// v1.47.0: pure-decision tests for the ceremony seating allocator.
// Covers single-row exact / under / over fills, multi-row overflow,
// left+right spanning, and the aisle-outward packing direction
// (LEFT fills from rightmost seat, RIGHT fills from seatIndex 0).

import { describe, expect, it } from "vitest";
import {
  allocateAll,
  allocateGroup,
  resolveSeat,
  type AssignmentLite,
  type GroupLite,
  type LayoutLite,
} from "@/lib/ceremony-fill";

const layout: LayoutLite = { leftSeatsRow: 8, rightSeatsRow: 8 };

const olwyn: GroupLite = {
  id: "olwyn",
  name: "Olwyn-Davis extended family",
  colour: "#c79a91",
  memberCount: 12,
};

const small: GroupLite = {
  id: "small",
  name: "Small group",
  colour: "#abcdef",
  memberCount: 5,
};

const huge: GroupLite = {
  id: "huge",
  name: "Huge group",
  colour: "#000000",
  memberCount: 25,
};

describe("allocateGroup", () => {
  it("fills a single row exactly when memberCount === capacity", () => {
    const exact: GroupLite = { ...small, memberCount: 8 };
    const a = allocateGroup(
      exact,
      [{ side: "LEFT", rowIndex: 0, guestGroupId: exact.id }],
      layout,
    );
    expect(a.rowFills.get("LEFT-0")).toBe(8);
    expect(a.totalAssignedSeats).toBe(8);
    expect(a.totalFilledSeats).toBe(8);
    expect(a.shortfall).toBe(0);
    expect(a.surplus).toBe(0);
  });

  it("under-fills a single row when memberCount < capacity (surplus)", () => {
    const a = allocateGroup(
      small,
      [{ side: "LEFT", rowIndex: 0, guestGroupId: small.id }],
      layout,
    );
    expect(a.rowFills.get("LEFT-0")).toBe(5);
    expect(a.totalFilledSeats).toBe(5);
    expect(a.surplus).toBe(3);
    expect(a.shortfall).toBe(0);
  });

  it("over-fills a single row when memberCount > capacity (shortfall)", () => {
    const a = allocateGroup(
      huge,
      [{ side: "LEFT", rowIndex: 0, guestGroupId: huge.id }],
      layout,
    );
    expect(a.rowFills.get("LEFT-0")).toBe(8);
    expect(a.totalFilledSeats).toBe(8);
    expect(a.shortfall).toBe(17); // 25 - 8 don't fit
    expect(a.surplus).toBe(0);
  });

  it("overflows into the next assigned row, front first", () => {
    const a = allocateGroup(
      olwyn,
      [
        { side: "LEFT", rowIndex: 1, guestGroupId: olwyn.id },
        { side: "LEFT", rowIndex: 0, guestGroupId: olwyn.id }, // unsorted input
      ],
      layout,
    );
    expect(a.rowFills.get("LEFT-0")).toBe(8); // front fills first
    expect(a.rowFills.get("LEFT-1")).toBe(4); // overflow
    expect(a.totalFilledSeats).toBe(12);
    expect(a.totalAssignedSeats).toBe(16);
    expect(a.surplus).toBe(4);
    expect(a.shortfall).toBe(0);
  });

  it("LEFT fills before RIGHT within the same rowIndex", () => {
    const g: GroupLite = { ...olwyn, memberCount: 12 };
    const a = allocateGroup(
      g,
      [
        { side: "RIGHT", rowIndex: 0, guestGroupId: g.id },
        { side: "LEFT", rowIndex: 0, guestGroupId: g.id },
      ],
      layout,
    );
    expect(a.rowFills.get("LEFT-0")).toBe(8);
    expect(a.rowFills.get("RIGHT-0")).toBe(4);
  });

  it("ignores assignments for other groups", () => {
    const a = allocateGroup(
      small,
      [
        { side: "LEFT", rowIndex: 0, guestGroupId: "other-group" },
        { side: "RIGHT", rowIndex: 0, guestGroupId: small.id },
      ],
      layout,
    );
    expect(a.rowFills.has("LEFT-0")).toBe(false);
    expect(a.rowFills.get("RIGHT-0")).toBe(5);
  });

  it("with no assignments, every member is a shortfall", () => {
    // 5-member group with zero assigned rows — none fit anywhere.
    // Surplus is 0 because there are no assigned seats to spare.
    const a = allocateGroup(small, [], layout);
    expect(a.rowFills.size).toBe(0);
    expect(a.totalAssignedSeats).toBe(0);
    expect(a.totalFilledSeats).toBe(0);
    expect(a.shortfall).toBe(5);
    expect(a.surplus).toBe(0);
  });

  it("zero-member group records 0 fills but tracks assigned capacity", () => {
    const empty: GroupLite = { ...small, memberCount: 0 };
    const a = allocateGroup(
      empty,
      [{ side: "LEFT", rowIndex: 0, guestGroupId: empty.id }],
      layout,
    );
    expect(a.rowFills.get("LEFT-0")).toBe(0);
    expect(a.totalAssignedSeats).toBe(8);
    expect(a.totalFilledSeats).toBe(0);
    expect(a.surplus).toBe(8);
  });

  it("copes with mixed left+right capacities", () => {
    const skewed: LayoutLite = { leftSeatsRow: 6, rightSeatsRow: 10 };
    const g: GroupLite = { ...olwyn, memberCount: 14 };
    const a = allocateGroup(
      g,
      [
        { side: "LEFT", rowIndex: 0, guestGroupId: g.id },
        { side: "RIGHT", rowIndex: 0, guestGroupId: g.id },
      ],
      skewed,
    );
    expect(a.rowFills.get("LEFT-0")).toBe(6);
    expect(a.rowFills.get("RIGHT-0")).toBe(8); // 14 - 6
    expect(a.totalAssignedSeats).toBe(16);
  });
});

describe("allocateAll", () => {
  it("builds a per-group allocation map", () => {
    const map = allocateAll(
      [olwyn, small],
      [
        { side: "LEFT", rowIndex: 0, guestGroupId: olwyn.id },
        { side: "RIGHT", rowIndex: 0, guestGroupId: small.id },
      ],
      layout,
    );
    expect(map.size).toBe(2);
    expect(map.get(olwyn.id)?.rowFills.get("LEFT-0")).toBe(8);
    expect(map.get(small.id)?.rowFills.get("RIGHT-0")).toBe(5);
  });
});

describe("resolveSeat — aisle-outward packing", () => {
  // For a LEFT row with 8 seats and 5 filled, indices 3,4,5,6,7
  // (closest to the aisle, which is at the right edge) are filled.
  it("LEFT side packs from the rightmost seat backward", () => {
    const groups = [small];
    const assignments: AssignmentLite[] = [
      { side: "LEFT", rowIndex: 0, guestGroupId: small.id },
    ];
    const allocs = allocateAll(groups, assignments, layout);
    expect(resolveSeat("LEFT", 0, 0, layout, assignments, groups, allocs).kind).toBe("spare");
    expect(resolveSeat("LEFT", 0, 1, layout, assignments, groups, allocs).kind).toBe("spare");
    expect(resolveSeat("LEFT", 0, 2, layout, assignments, groups, allocs).kind).toBe("spare");
    expect(resolveSeat("LEFT", 0, 3, layout, assignments, groups, allocs).kind).toBe("filled");
    expect(resolveSeat("LEFT", 0, 4, layout, assignments, groups, allocs).kind).toBe("filled");
    expect(resolveSeat("LEFT", 0, 5, layout, assignments, groups, allocs).kind).toBe("filled");
    expect(resolveSeat("LEFT", 0, 6, layout, assignments, groups, allocs).kind).toBe("filled");
    expect(resolveSeat("LEFT", 0, 7, layout, assignments, groups, allocs).kind).toBe("filled");
  });

  // RIGHT side: aisle is at the LEFT edge (seatIndex 0). Fill from
  // index 0 forward.
  it("RIGHT side packs from seatIndex 0 forward", () => {
    const groups = [small];
    const assignments: AssignmentLite[] = [
      { side: "RIGHT", rowIndex: 0, guestGroupId: small.id },
    ];
    const allocs = allocateAll(groups, assignments, layout);
    expect(resolveSeat("RIGHT", 0, 0, layout, assignments, groups, allocs).kind).toBe("filled");
    expect(resolveSeat("RIGHT", 0, 1, layout, assignments, groups, allocs).kind).toBe("filled");
    expect(resolveSeat("RIGHT", 0, 2, layout, assignments, groups, allocs).kind).toBe("filled");
    expect(resolveSeat("RIGHT", 0, 3, layout, assignments, groups, allocs).kind).toBe("filled");
    expect(resolveSeat("RIGHT", 0, 4, layout, assignments, groups, allocs).kind).toBe("filled");
    expect(resolveSeat("RIGHT", 0, 5, layout, assignments, groups, allocs).kind).toBe("spare");
    expect(resolveSeat("RIGHT", 0, 6, layout, assignments, groups, allocs).kind).toBe("spare");
    expect(resolveSeat("RIGHT", 0, 7, layout, assignments, groups, allocs).kind).toBe("spare");
  });

  it("returns neutral for unassigned rows", () => {
    const groups = [small];
    const assignments: AssignmentLite[] = [
      { side: "LEFT", rowIndex: 0, guestGroupId: small.id },
    ];
    const allocs = allocateAll(groups, assignments, layout);
    expect(resolveSeat("LEFT", 1, 0, layout, assignments, groups, allocs).kind).toBe("neutral");
    expect(resolveSeat("RIGHT", 0, 0, layout, assignments, groups, allocs).kind).toBe("neutral");
  });

  it("filled seats carry colour + glyph + group name", () => {
    const groups = [small];
    const assignments: AssignmentLite[] = [
      { side: "RIGHT", rowIndex: 0, guestGroupId: small.id },
    ];
    const allocs = allocateAll(groups, assignments, layout);
    const seat = resolveSeat("RIGHT", 0, 0, layout, assignments, groups, allocs);
    expect(seat.kind).toBe("filled");
    if (seat.kind === "filled") {
      expect(seat.colour).toBe("#abcdef");
      expect(seat.glyph).toBe("S");
      expect(seat.groupName).toBe("Small group");
    }
  });

  it("spare seats carry colour + name but no glyph", () => {
    const groups = [small];
    const assignments: AssignmentLite[] = [
      { side: "RIGHT", rowIndex: 0, guestGroupId: small.id },
    ];
    const allocs = allocateAll(groups, assignments, layout);
    const seat = resolveSeat("RIGHT", 0, 7, layout, assignments, groups, allocs);
    expect(seat.kind).toBe("spare");
    if (seat.kind === "spare") {
      expect(seat.colour).toBe("#abcdef");
      expect(seat.groupName).toBe("Small group");
    }
  });

  it("over-allocated row caps fill at capacity (no spare)", () => {
    // Huge group with 25 members in only one 8-seat row — every
    // seat is filled, none are spare. Shortfall surfaces in the
    // allocation totals (tested above).
    const groups = [huge];
    const assignments: AssignmentLite[] = [
      { side: "LEFT", rowIndex: 0, guestGroupId: huge.id },
    ];
    const allocs = allocateAll(groups, assignments, layout);
    for (let i = 0; i < 8; i++) {
      expect(resolveSeat("LEFT", 0, i, layout, assignments, groups, allocs).kind).toBe("filled");
    }
  });
});
