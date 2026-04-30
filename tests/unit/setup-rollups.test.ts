import { describe, expect, it } from "vitest";
import { setupRollups } from "@/lib/book-cards";

// v1.33.0: SETUP card pure rollups. Counts + integer percentages
// for packed / placed flags. Edge case: 0-item cards must return
// 0% (not NaN, not divide-by-zero).

describe("setupRollups", () => {
  it("returns zeros for an empty card", () => {
    const r = setupRollups({ items: [] });
    expect(r.itemCount).toBe(0);
    expect(r.packedCount).toBe(0);
    expect(r.placedCount).toBe(0);
    expect(r.percentPacked).toBe(0);
    expect(r.percentPlaced).toBe(0);
  });

  it("counts packed and placed independently", () => {
    const r = setupRollups({
      items: [
        { packed: true, placed: true },
        { packed: true, placed: false },
        { packed: false, placed: false },
        { packed: true, placed: false },
      ],
    });
    expect(r.itemCount).toBe(4);
    expect(r.packedCount).toBe(3);
    expect(r.placedCount).toBe(1);
  });

  it("rounds percentages to integers", () => {
    const r = setupRollups({
      items: [
        { packed: true, placed: false },
        { packed: true, placed: false },
        { packed: false, placed: false },
      ],
    });
    expect(r.percentPacked).toBe(67);
    expect(r.percentPlaced).toBe(0);
  });

  it("100% when every item is packed and placed", () => {
    const r = setupRollups({
      items: [
        { packed: true, placed: true },
        { packed: true, placed: true },
      ],
    });
    expect(r.percentPacked).toBe(100);
    expect(r.percentPlaced).toBe(100);
  });

  it("0% when nothing is packed", () => {
    const r = setupRollups({
      items: [
        { packed: false, placed: false },
        { packed: false, placed: false },
      ],
    });
    expect(r.percentPacked).toBe(0);
  });
});
