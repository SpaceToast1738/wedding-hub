import { describe, expect, it } from "vitest";
import { outfitRollups } from "@/lib/book-cards";

// v1.93.0: OUTFIT card rollups simplified. Milestone logic
// (fitting / alterations / pickup) removed — those dates live as
// Tasks now. Status lifecycle is Planned / Purchased / Received /
// Already own; "done" states (Received + Already own) count toward
// collectedCount.

describe("outfitRollups", () => {
  it("returns zeros for an empty card", () => {
    const r = outfitRollups({ items: [] });
    expect(r.itemCount).toBe(0);
    expect(r.collectedCount).toBe(0);
    expect(r.percentCollected).toBe(0);
  });

  it("counts items with status 'Received' or 'Already own' as done", () => {
    const r = outfitRollups({
      items: [
        { status: "Received" },
        { status: "Already own" },
        { status: "Planned" },
        { status: "Purchased" },
        { status: null },
      ],
    });
    expect(r.itemCount).toBe(5);
    expect(r.collectedCount).toBe(2);
    expect(r.percentCollected).toBe(40);
  });

  it("status comparison is case-insensitive", () => {
    const r = outfitRollups({
      items: [
        { status: "received" },
        { status: "ALREADY OWN" },
        { status: "Planned" },
      ],
    });
    expect(r.collectedCount).toBe(2);
  });

  it("percentCollected rounds to integer", () => {
    const r = outfitRollups({
      items: [
        { status: "Received" },
        { status: "Planned" },
        { status: "Purchased" },
      ],
    });
    expect(r.percentCollected).toBe(33);
  });

  it("100% when every item is in a done state", () => {
    const r = outfitRollups({
      items: [{ status: "Received" }, { status: "Already own" }],
    });
    expect(r.percentCollected).toBe(100);
  });

  it("treats Purchased as in-progress (not done)", () => {
    const r = outfitRollups({
      items: [{ status: "Purchased" }, { status: "Purchased" }],
    });
    expect(r.collectedCount).toBe(0);
    expect(r.percentCollected).toBe(0);
  });
});
