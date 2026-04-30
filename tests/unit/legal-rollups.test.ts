import { describe, expect, it } from "vitest";
import { legalRollups } from "@/lib/book-cards";

// v1.34.0: LEGAL card rollups. Days-to-due (negative if past),
// percent obtained, overdue flag (only when items aren't all done),
// and a count of items expiring before the wedding (so a passport
// or notice that lapses pre-wedding-day flags red).

describe("legalRollups", () => {
  const weddingDate = new Date("2026-09-26T14:00:00Z");

  it("returns zeros for an empty card with no due date", () => {
    const r = legalRollups({ items: [] }, weddingDate);
    expect(r.itemCount).toBe(0);
    expect(r.obtainedCount).toBe(0);
    expect(r.percentObtained).toBe(0);
    expect(r.daysToDue).toBeNull();
    expect(r.isOverdue).toBe(false);
    expect(r.expiringBeforeWedding).toBe(0);
  });

  it("counts obtained items and rounds percentObtained to integer", () => {
    const r = legalRollups(
      {
        items: [
          { obtained: true },
          { obtained: true },
          { obtained: false },
        ],
      },
      weddingDate,
    );
    expect(r.obtainedCount).toBe(2);
    expect(r.percentObtained).toBe(67);
  });

  it("computes daysToDue ahead of dueByDate", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const dueBy = new Date("2026-08-25T00:00:00Z"); // +10 days
    const r = legalRollups({ dueByDate: dueBy, items: [] }, weddingDate, now);
    expect(r.daysToDue).toBe(10);
  });

  it("daysToDue is negative when past and not all obtained → overdue", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const dueBy = new Date("2026-08-25T00:00:00Z"); // -7 days
    const r = legalRollups(
      {
        dueByDate: dueBy,
        items: [{ obtained: true }, { obtained: false }],
      },
      weddingDate,
      now,
    );
    expect(r.daysToDue).toBe(-7);
    expect(r.isOverdue).toBe(true);
  });

  it("isOverdue is false even when past dueByDate if every item is obtained", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const dueBy = new Date("2026-08-25T00:00:00Z");
    const r = legalRollups(
      {
        dueByDate: dueBy,
        items: [{ obtained: true }, { obtained: true }],
      },
      weddingDate,
      now,
    );
    expect(r.isOverdue).toBe(false);
  });

  it("counts items whose expiresAt is before the wedding", () => {
    const r = legalRollups(
      {
        items: [
          { obtained: true, expiresAt: new Date("2026-08-01T00:00:00Z") }, // pre-wedding
          { obtained: true, expiresAt: new Date("2026-09-25T00:00:00Z") }, // pre-wedding by 1 day
          { obtained: true, expiresAt: new Date("2026-09-26T15:00:00Z") }, // after wedding starts
          { obtained: true, expiresAt: new Date("2027-12-01T00:00:00Z") }, // far future
          { obtained: true }, // no expiry
        ],
      },
      weddingDate,
    );
    expect(r.expiringBeforeWedding).toBe(2);
  });

  it("expiringBeforeWedding is 0 when weddingDate is null", () => {
    const r = legalRollups(
      {
        items: [{ obtained: true, expiresAt: new Date("2025-01-01T00:00:00Z") }],
      },
      null,
    );
    expect(r.expiringBeforeWedding).toBe(0);
  });
});
