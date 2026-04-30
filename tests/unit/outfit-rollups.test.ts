import { describe, expect, it } from "vitest";
import { outfitRollups } from "@/lib/book-cards";

// v1.35.0: OUTFIT card pure rollups. Per-item collected percentage
// + the soonest-future fitting milestone (fitting → alterations →
// pickup) with days-remaining. When all three milestones are past
// we surface the most-recent past one so the header strip stays
// useful rather than empty.

describe("outfitRollups", () => {
  it("returns zeros and no milestone for an empty card", () => {
    const r = outfitRollups({ items: [] });
    expect(r.itemCount).toBe(0);
    expect(r.collectedCount).toBe(0);
    expect(r.percentCollected).toBe(0);
    expect(r.nextMilestone).toBeNull();
    expect(r.daysToNext).toBeNull();
  });

  it("counts items with status 'Collected' (case-insensitive)", () => {
    const r = outfitRollups({
      items: [
        { status: "Collected" },
        { status: "collected" },
        { status: "Fitted" },
        { status: null },
      ],
    });
    expect(r.collectedCount).toBe(2);
    expect(r.percentCollected).toBe(50);
  });

  it("percentCollected rounds to integer", () => {
    const r = outfitRollups({
      items: [{ status: "Collected" }, { status: "Ordered" }, { status: "Fitted" }],
    });
    expect(r.percentCollected).toBe(33);
  });

  it("picks the soonest future milestone", () => {
    const now = new Date("2026-08-01T00:00:00Z");
    const r = outfitRollups(
      {
        fittingDate: new Date("2026-09-01T00:00:00Z"),
        alterationsDueBy: new Date("2026-08-15T00:00:00Z"),
        pickupDate: new Date("2026-09-20T00:00:00Z"),
        items: [],
      },
      now,
    );
    expect(r.nextMilestone?.label).toBe("Alterations");
    expect(r.daysToNext).toBe(14);
  });

  it("falls back to the most-recent past milestone when all are behind", () => {
    const now = new Date("2026-09-30T00:00:00Z");
    const r = outfitRollups(
      {
        fittingDate: new Date("2026-08-01T00:00:00Z"),
        alterationsDueBy: new Date("2026-08-15T00:00:00Z"),
        pickupDate: new Date("2026-09-15T00:00:00Z"),
        items: [],
      },
      now,
    );
    expect(r.nextMilestone?.label).toBe("Pickup");
    expect(r.daysToNext).toBe(-15);
  });

  it("treats today as future (>= now)", () => {
    const now = new Date("2026-08-15T12:00:00Z");
    const fitting = new Date("2026-08-15T12:00:00Z"); // exactly now
    const r = outfitRollups({ fittingDate: fitting, items: [] }, now);
    expect(r.nextMilestone?.label).toBe("Fitting");
    expect(r.daysToNext).toBe(0);
  });

  it("returns null when no milestones are set", () => {
    const r = outfitRollups({ items: [{ status: "Ordered" }] });
    expect(r.nextMilestone).toBeNull();
    expect(r.daysToNext).toBeNull();
  });

  it("100% collected when every item is collected", () => {
    const r = outfitRollups({
      items: [{ status: "Collected" }, { status: "collected" }],
    });
    expect(r.percentCollected).toBe(100);
  });
});
