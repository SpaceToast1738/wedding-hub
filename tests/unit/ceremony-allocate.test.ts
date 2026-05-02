// v1.48.0: tests for the auto-fill ceremony seating allocator.
// v1.70.0: updated for GuestMember[] (was memberCount: number) +
//   new deduplication and household-clustering tests.

import { describe, expect, it } from "vitest";
import {
  allocateCeremony,
  type GroupLite,
  type GuestMember,
  type LayoutLite,
} from "@/lib/ceremony-allocate";

const layout: LayoutLite = {
  leftRows: 3,
  leftSeatsRow: 4,
  rightRows: 3,
  rightSeatsRow: 4,
};

// Creates N members each in their own household (no clustering by default).
// idPrefix scopes member IDs to the group so different groups don't collide,
// which would trigger the deduplication logic unintentionally.
function makeMembers(count: number, idPrefix: string, householdOverrides?: (string | null)[]): GuestMember[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${idPrefix}-${i}`,
    householdId: householdOverrides?.[i] ?? `h${i}`,
    isChild: false,
  }));
}

function makeGroup(
  id: string,
  side: "BRIDE" | "GROOM" | "BOTH",
  memberCount: number,
  order = 0,
  colour = "#abc",
): GroupLite {
  return { id, name: id.toUpperCase(), colour, side, order, members: makeMembers(memberCount, id) };
}

describe("allocateCeremony — BRIDE side packs LEFT only", () => {
  it("front-row LEFT aisle outward (seatIndex 3 first, then 2, 1, 0)", () => {
    const g = makeGroup("bride", "BRIDE", 5);
    const result = allocateCeremony([g], layout);
    const filled = result.perGroup.get("bride")!.filledSeats;
    expect(filled).toEqual([
      "LEFT-0-3",
      "LEFT-0-2",
      "LEFT-0-1",
      "LEFT-0-0",
      "LEFT-1-3",
    ]);
  });

  it("never touches RIGHT seats", () => {
    const g = makeGroup("bride", "BRIDE", 8);
    const result = allocateCeremony([g], layout);
    const filled = result.perGroup.get("bride")!.filledSeats;
    expect(filled.every((k) => k.startsWith("LEFT"))).toBe(true);
  });

  it("shortfall when memberCount exceeds total LEFT capacity", () => {
    const g = makeGroup("bride", "BRIDE", 15);
    const result = allocateCeremony([g], layout);
    expect(result.perGroup.get("bride")!.shortfall).toBe(3);
    expect(result.perGroup.get("bride")!.filledSeats.length).toBe(12);
  });
});

describe("allocateCeremony — GROOM side packs RIGHT only", () => {
  it("front-row RIGHT aisle outward (seatIndex 0 first, then 1, 2, 3)", () => {
    const g = makeGroup("groom", "GROOM", 5);
    const result = allocateCeremony([g], layout);
    const filled = result.perGroup.get("groom")!.filledSeats;
    expect(filled).toEqual([
      "RIGHT-0-0",
      "RIGHT-0-1",
      "RIGHT-0-2",
      "RIGHT-0-3",
      "RIGHT-1-0",
    ]);
  });

  it("never touches LEFT seats", () => {
    const g = makeGroup("groom", "GROOM", 8);
    const result = allocateCeremony([g], layout);
    const filled = result.perGroup.get("groom")!.filledSeats;
    expect(filled.every((k) => k.startsWith("RIGHT"))).toBe(true);
  });
});

describe("allocateCeremony — BOTH balances across sides", () => {
  it("first BOTH member goes LEFT (tie-break)", () => {
    const g = makeGroup("both", "BOTH", 1);
    const result = allocateCeremony([g], layout);
    expect(result.perGroup.get("both")!.filledSeats).toEqual(["LEFT-0-3"]);
  });

  it("alternates LEFT/RIGHT roughly evenly", () => {
    // 4 solo members (different households). Balance:
    // leftRem=12 >= rightRem=12 → L-0-3. leftRem=11 < 12 → R-0-0.
    // leftRem=11 >= rightRem=11 (tie) → L-0-2. leftRem=10 < 11 → R-0-1.
    const g = makeGroup("both", "BOTH", 4);
    const result = allocateCeremony([g], layout);
    const filled = result.perGroup.get("both")!.filledSeats;
    expect(filled).toEqual([
      "LEFT-0-3",
      "RIGHT-0-0",
      "LEFT-0-2",
      "RIGHT-0-1",
    ]);
  });

  it("overflows to whichever side still has space when one fills", () => {
    const groups = [
      makeGroup("bride", "BRIDE", 12, 0),
      makeGroup("both", "BOTH", 5, 1),
    ];
    const result = allocateCeremony(groups, layout);
    expect(result.perGroup.get("bride")!.filledSeats.length).toBe(12);
    expect(result.perGroup.get("bride")!.shortfall).toBe(0);
    const both = result.perGroup.get("both")!.filledSeats;
    expect(both.every((k) => k.startsWith("RIGHT"))).toBe(true);
    expect(both.length).toBe(5);
  });
});

describe("allocateCeremony — order matters", () => {
  it("walks groups in ascending `order`", () => {
    const groups = [
      makeGroup("a", "BRIDE", 2, 0),
      makeGroup("b", "BRIDE", 2, 1),
    ];
    const result = allocateCeremony(groups, layout);
    expect(result.perGroup.get("a")!.filledSeats).toEqual([
      "LEFT-0-3",
      "LEFT-0-2",
    ]);
    expect(result.perGroup.get("b")!.filledSeats).toEqual([
      "LEFT-0-1",
      "LEFT-0-0",
    ]);
  });

  it("input order doesn't matter; only `order` field does", () => {
    const groups = [
      makeGroup("b", "BRIDE", 2, 1),
      makeGroup("a", "BRIDE", 2, 0),
    ];
    const result = allocateCeremony(groups, layout);
    expect(result.perGroup.get("a")!.filledSeats).toEqual([
      "LEFT-0-3",
      "LEFT-0-2",
    ]);
  });
});

describe("allocateCeremony — fills payload + shortfall + remainders", () => {
  it("seat fills carry colour + glyph + group name", () => {
    const g = makeGroup("bride", "BRIDE", 1, 0, "#c79a91");
    g.name = "Olwyn-Davis";
    const result = allocateCeremony([g], layout);
    const fill = result.fills.get("LEFT-0-3");
    expect(fill).toEqual({
      groupId: "bride",
      groupName: "Olwyn-Davis",
      colour: "#c79a91",
      glyph: "O",
    });
  });

  it("returns unfilled counts after allocation", () => {
    const groups = [
      makeGroup("a", "BRIDE", 4, 0),
      makeGroup("b", "GROOM", 4, 1),
    ];
    const result = allocateCeremony(groups, layout);
    expect(result.unfilledLeft).toBe(8);
    expect(result.unfilledRight).toBe(8);
  });

  it("zero-member group records empty fills + zero shortfall", () => {
    const g = makeGroup("empty", "BRIDE", 0);
    const result = allocateCeremony([g], layout);
    expect(result.perGroup.get("empty")!.filledSeats).toEqual([]);
    expect(result.perGroup.get("empty")!.shortfall).toBe(0);
  });

  it("BOTH group hits shortfall only when the entire canvas is full", () => {
    const groups = [
      makeGroup("a", "BOTH", 24, 0),
      makeGroup("b", "BOTH", 5, 1),
    ];
    const result = allocateCeremony(groups, layout);
    expect(result.perGroup.get("a")!.filledSeats.length).toBe(24);
    expect(result.perGroup.get("a")!.shortfall).toBe(0);
    expect(result.perGroup.get("b")!.filledSeats.length).toBe(0);
    expect(result.perGroup.get("b")!.shortfall).toBe(5);
  });
});

describe("allocateCeremony — deduplication (one group per guest)", () => {
  it("guest in two groups is only allocated to the first (lower order)", () => {
    const sharedMember: GuestMember = { id: "shared", householdId: "hS", isChild: false };
    const groups: GroupLite[] = [
      {
        id: "a",
        name: "A",
        colour: null,
        side: "BRIDE",
        order: 0,
        members: [{ id: "a1", householdId: "h1", isChild: false }, sharedMember],
      },
      {
        id: "b",
        name: "B",
        colour: null,
        side: "BRIDE",
        order: 1,
        members: [sharedMember, { id: "b1", householdId: "h2", isChild: false }],
      },
    ];
    const result = allocateCeremony(groups, layout);
    // Group a: both members unique
    expect(result.perGroup.get("a")!.uniqueCount).toBe(2);
    expect(result.perGroup.get("a")!.duplicateCount).toBe(0);
    expect(result.perGroup.get("a")!.filledSeats.length).toBe(2);
    // Group b: shared is duplicate, only b1 fills a seat
    expect(result.perGroup.get("b")!.uniqueCount).toBe(1);
    expect(result.perGroup.get("b")!.duplicateCount).toBe(1);
    expect(result.perGroup.get("b")!.filledSeats.length).toBe(1);
    // Total fills = 3 (a1, shared, b1). shared is in group-a's range.
    expect(result.fills.size).toBe(3);
    expect(result.duplicateGuests).toBe(1);
  });

  it("records uniqueCount and duplicateCount=0 when no duplicates", () => {
    const g = makeGroup("bride", "BRIDE", 3);
    const result = allocateCeremony([g], layout);
    const alloc = result.perGroup.get("bride")!;
    expect(alloc.uniqueCount).toBe(3);
    expect(alloc.duplicateCount).toBe(0);
    expect(result.duplicateGuests).toBe(0);
  });
});

describe("allocateCeremony — household clustering", () => {
  it("clusters household members adjacently within a BRIDE group", () => {
    // 4 members interleaved across 2 households in raw order: h1,h2,h1,h2
    // After clustering: h1(g0,g2), h2(g1,g3)
    const members: GuestMember[] = [
      { id: "g0", householdId: "h1", isChild: false },
      { id: "g1", householdId: "h2", isChild: false },
      { id: "g2", householdId: "h1", isChild: false },
      { id: "g3", householdId: "h2", isChild: false },
    ];
    const g: GroupLite = { id: "bride", name: "BRIDE", colour: null, side: "BRIDE", order: 0, members };
    const result = allocateCeremony([g], layout);
    const filled = result.perGroup.get("bride")!.filledSeats;
    // All 4 members seated (no skip — each 2-member cluster fits in 4-seat row)
    expect(filled).toEqual(["LEFT-0-3", "LEFT-0-2", "LEFT-0-1", "LEFT-0-0"]);
    // Household h1 is at 0-3 and 0-2; h2 is at 0-1 and 0-0 — all adjacent ✓
  });

  it("skips row remainder to keep household together (row-no-split)", () => {
    // h1 has 3 members → fills LEFT-0-3, LEFT-0-2, LEFT-0-1. Cursor at pos 3.
    // h2 has 2 members → remaining in row = 1. Size 2 > 1 → skip to row 1.
    // h2 fills LEFT-1-3, LEFT-1-2.
    const members: GuestMember[] = [
      { id: "g0", householdId: "h1", isChild: false },
      { id: "g1", householdId: "h1", isChild: false },
      { id: "g2", householdId: "h1", isChild: false },
      { id: "g3", householdId: "h2", isChild: false },
      { id: "g4", householdId: "h2", isChild: false },
    ];
    const g: GroupLite = { id: "bride", name: "BRIDE", colour: null, side: "BRIDE", order: 0, members };
    const result = allocateCeremony([g], layout);
    const filled = result.perGroup.get("bride")!.filledSeats;
    expect(filled).toEqual([
      "LEFT-0-3", "LEFT-0-2", "LEFT-0-1", // h1 cluster in row 0
      "LEFT-1-3", "LEFT-1-2",              // h2 cluster skips to row 1
    ]);
    // All 5 members seated; no shortfall
    expect(result.perGroup.get("bride")!.shortfall).toBe(0);
    // LEFT-0-0 was skipped — shows as part of unfilledLeft
    expect(result.unfilledLeft).toBe(6); // 12 total - 5 filled - 1 skipped = 6
  });

  it("does not skip when household fits in remaining row seats", () => {
    // h1 has 2 members → fills LEFT-0-3, LEFT-0-2. Cursor at pos 2.
    // h2 has 2 members → remaining = 2. Size 2 <= 2 → NO skip.
    const members: GuestMember[] = [
      { id: "g0", householdId: "h1", isChild: false },
      { id: "g1", householdId: "h1", isChild: false },
      { id: "g2", householdId: "h2", isChild: false },
      { id: "g3", householdId: "h2", isChild: false },
    ];
    const g: GroupLite = { id: "bride", name: "BRIDE", colour: null, side: "BRIDE", order: 0, members };
    const result = allocateCeremony([g], layout);
    const filled = result.perGroup.get("bride")!.filledSeats;
    expect(filled).toEqual([
      "LEFT-0-3", "LEFT-0-2", // h1
      "LEFT-0-1", "LEFT-0-0", // h2 — fits in same row, no skip
    ]);
    expect(result.unfilledLeft).toBe(8);
  });

  it("does not skip for solo guests (cluster size 1)", () => {
    // All singletons — no row skipping regardless of row position
    const g = makeGroup("bride", "BRIDE", 5);
    const result = allocateCeremony([g], layout);
    const filled = result.perGroup.get("bride")!.filledSeats;
    expect(filled).toEqual([
      "LEFT-0-3", "LEFT-0-2", "LEFT-0-1", "LEFT-0-0",
      "LEFT-1-3",
    ]);
  });

  it("clusters household members in BOTH group (no row-no-split)", () => {
    // BOTH groups cluster by household but balance across sides member-by-member
    const members: GuestMember[] = [
      { id: "g0", householdId: "h1", isChild: false },
      { id: "g1", householdId: "h2", isChild: false },
      { id: "g2", householdId: "h1", isChild: false },
    ];
    const g: GroupLite = { id: "both", name: "BOTH", colour: null, side: "BOTH", order: 0, members };
    const result = allocateCeremony([g], layout);
    // After clustering: h1[g0,g2], h2[g1] → [g0, g2, g1]
    // g0 → L (12>=12 tie→L). g2 → R (11<12). g1 → L (11>=11 tie→L).
    const filled = result.perGroup.get("both")!.filledSeats;
    expect(filled).toEqual(["LEFT-0-3", "RIGHT-0-0", "LEFT-0-2"]);
  });
});
