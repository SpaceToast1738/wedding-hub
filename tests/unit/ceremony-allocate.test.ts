// v1.48.0: tests for the auto-fill ceremony seating allocator.
// Covers ordering, side constraints (BRIDE/GROOM/BOTH), aisle-
// outward packing per side, overflow into back rows, BOTH-balance
// behaviour, and shortfall when a group can't fit.

import { describe, expect, it } from "vitest";
import { allocateCeremony, type GroupLite, type LayoutLite } from "@/lib/ceremony-allocate";

const layout: LayoutLite = {
  leftRows: 3,
  leftSeatsRow: 4,
  rightRows: 3,
  rightSeatsRow: 4,
};

function makeGroup(id: string, side: "BRIDE" | "GROOM" | "BOTH", memberCount: number, order = 0, colour = "#abc"): GroupLite {
  return { id, name: id.toUpperCase(), colour, side, order, memberCount };
}

describe("allocateCeremony — BRIDE side packs LEFT only", () => {
  it("front-row LEFT aisle outward (seatIndex 3 first, then 2, 1, 0)", () => {
    // LEFT layout: 3 rows × 4 seats. A 5-member BRIDE group fills
    // the front-row aisle-side first (seat 3), then 2, 1, 0 — and
    // overflows seat 0 of the next row's aisle (seat 3 of row 1).
    const g = makeGroup("bride", "BRIDE", 5);
    const result = allocateCeremony([g], layout);
    const filled = result.perGroup.get("bride")!.filledSeats;
    expect(filled).toEqual([
      "LEFT-0-3", // aisle-side of row 0
      "LEFT-0-2",
      "LEFT-0-1",
      "LEFT-0-0", // far edge of row 0
      "LEFT-1-3", // aisle-side of row 1 (overflow)
    ]);
  });

  it("never touches RIGHT seats", () => {
    const g = makeGroup("bride", "BRIDE", 8);
    const result = allocateCeremony([g], layout);
    const filled = result.perGroup.get("bride")!.filledSeats;
    expect(filled.every((k) => k.startsWith("LEFT"))).toBe(true);
  });

  it("shortfall when memberCount exceeds total LEFT capacity", () => {
    // Total LEFT = 12 seats. 15-member BRIDE group has 3 shortfall.
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
      "RIGHT-0-0", // aisle-side of row 0
      "RIGHT-0-1",
      "RIGHT-0-2",
      "RIGHT-0-3", // far edge of row 0
      "RIGHT-1-0", // overflow
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
    // 4 members; capacities equal. Fills LEFT-0-3, then either side.
    // The tie-breaker prefers LEFT until LEFT has fewer remaining
    // than RIGHT — so the sequence is L, L, R, R for 4 members.
    // (LEFT goes from 12→11, RIGHT 12; then LEFT 11>RIGHT 12? no
    // 11<12 → next goes RIGHT. Then LEFT 11>RIGHT 11 (tie) → LEFT.
    // Then LEFT 10<RIGHT 11 → RIGHT.) Verify the pattern:
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
    // BRIDE first eats all 12 LEFT seats, then BOTH picks up RIGHT.
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
    // Two BRIDE groups. order=0 goes first, takes the front aisle.
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
    // Pass groups in reverse order; result should be the same.
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
    expect(result.unfilledLeft).toBe(8); // 12 - 4
    expect(result.unfilledRight).toBe(8);
  });

  it("zero-member group records empty fills + zero shortfall", () => {
    const g = makeGroup("empty", "BRIDE", 0);
    const result = allocateCeremony([g], layout);
    expect(result.perGroup.get("empty")!.filledSeats).toEqual([]);
    expect(result.perGroup.get("empty")!.shortfall).toBe(0);
  });

  it("BOTH group hits shortfall only when the entire canvas is full", () => {
    // Total capacity 24; first group eats all of it.
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
