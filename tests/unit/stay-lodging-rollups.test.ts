import { describe, expect, it } from "vitest";
import { lodgingRollups, stayRollups } from "@/lib/book-cards";

// v1.36.0: pure rollups for STAY (single booking) and LODGING_GUIDE
// (recommended hotels). STAY computes nights + days-to-check-in +
// phase pill; LODGING_GUIDE counts items per price-band.

describe("stayRollups", () => {
  it("returns all nulls when no dates are set", () => {
    const r = stayRollups({});
    expect(r.nights).toBeNull();
    expect(r.daysToCheckIn).toBeNull();
    expect(r.phase).toBeNull();
  });

  it("computes nights between check-in and check-out", () => {
    const r = stayRollups({
      checkInDate: new Date("2026-09-25T15:00:00Z"),
      checkOutDate: new Date("2026-09-27T11:00:00Z"),
    });
    expect(r.nights).toBe(2);
  });

  it("nights of 0 when check-in and check-out are the same instant", () => {
    const r = stayRollups({
      checkInDate: new Date("2026-09-25T15:00:00Z"),
      checkOutDate: new Date("2026-09-25T15:00:00Z"),
    });
    expect(r.nights).toBe(0);
  });

  it("nights null when only one date set", () => {
    const r = stayRollups({ checkInDate: new Date("2026-09-25T00:00:00Z") });
    expect(r.nights).toBeNull();
  });

  it("daysToCheckIn is positive for future, negative for past", () => {
    const now = new Date("2026-08-01T00:00:00Z");
    const future = stayRollups({ checkInDate: new Date("2026-08-15T00:00:00Z") }, now);
    expect(future.daysToCheckIn).toBe(14);
    const past = stayRollups({ checkInDate: new Date("2026-07-25T00:00:00Z") }, now);
    expect(past.daysToCheckIn).toBe(-7);
  });

  it("phase = upcoming when check-in is future", () => {
    const now = new Date("2026-08-01T00:00:00Z");
    const r = stayRollups(
      {
        checkInDate: new Date("2026-09-25T15:00:00Z"),
        checkOutDate: new Date("2026-09-27T11:00:00Z"),
      },
      now,
    );
    expect(r.phase).toBe("upcoming");
  });

  it("phase = current between check-in and check-out", () => {
    const now = new Date("2026-09-26T08:00:00Z");
    const r = stayRollups(
      {
        checkInDate: new Date("2026-09-25T15:00:00Z"),
        checkOutDate: new Date("2026-09-27T11:00:00Z"),
      },
      now,
    );
    expect(r.phase).toBe("current");
  });

  it("phase = past after check-out", () => {
    const now = new Date("2026-09-28T00:00:00Z");
    const r = stayRollups(
      {
        checkInDate: new Date("2026-09-25T15:00:00Z"),
        checkOutDate: new Date("2026-09-27T11:00:00Z"),
      },
      now,
    );
    expect(r.phase).toBe("past");
  });
});

describe("lodgingRollups", () => {
  it("returns 0 + empty map for an empty card", () => {
    const r = lodgingRollups({ items: [] });
    expect(r.itemCount).toBe(0);
    expect(r.perPriceBand.size).toBe(0);
  });

  it("counts items per price-band label", () => {
    const r = lodgingRollups({
      items: [
        { priceRangeLabel: "£" },
        { priceRangeLabel: "£" },
        { priceRangeLabel: "££" },
        { priceRangeLabel: "£££" },
      ],
    });
    expect(r.itemCount).toBe(4);
    expect(r.perPriceBand.get("£")).toBe(2);
    expect(r.perPriceBand.get("££")).toBe(1);
    expect(r.perPriceBand.get("£££")).toBe(1);
  });

  it("buckets null/empty price labels under the empty key", () => {
    const r = lodgingRollups({
      items: [
        { priceRangeLabel: null },
        { priceRangeLabel: "" },
        { priceRangeLabel: "  " },
        { priceRangeLabel: "££" },
      ],
    });
    expect(r.itemCount).toBe(4);
    expect(r.perPriceBand.get("")).toBe(3);
    expect(r.perPriceBand.get("££")).toBe(1);
  });
});
