import { describe, expect, it } from "vitest";
import { buildRollups, type BuildCardShape } from "@/lib/book-cards";

// v1.31.0: BUILD card pure rollups. Cover materials totalling, hours
// logged vs estimated, units done, percentages of materials ordered /
// arrived, and the prototype-blocker boolean across the 30-day window.

const baseCard: BuildCardShape = {
  quantityNeeded: null,
  estimatedMinutesPerUnit: null,
  prototypeDone: false,
  targetDate: null,
  materials: [],
  sessions: [],
};

describe("buildRollups", () => {
  it("returns zeros for an empty card", () => {
    const r = buildRollups(baseCard);
    expect(r.materialsTotalPence).toBe(0);
    expect(r.hoursLogged).toBe(0);
    expect(r.hoursEstimated).toBeNull();
    expect(r.unitsDone).toBe(0);
    expect(r.percentMaterialsOrdered).toBe(0);
    expect(r.percentMaterialsArrived).toBe(0);
    expect(r.prototypeBlocker).toBe(false);
  });

  it("sums materials cost (skipping null cost)", () => {
    const r = buildRollups({
      ...baseCard,
      materials: [
        { costPence: 1500, ordered: true, arrived: false },
        { costPence: null, ordered: false, arrived: false },
        { costPence: 500, ordered: true, arrived: true },
      ],
    });
    expect(r.materialsTotalPence).toBe(2000);
  });

  it("computes hoursLogged (rounded to 1 decimal)", () => {
    const r = buildRollups({
      ...baseCard,
      sessions: [
        { minutes: 45 },          // 0.75
        { minutes: 30 },          // 0.5
        { minutes: 12 },          // 0.2
      ],
    });
    expect(r.hoursLogged).toBe(1.5);
  });

  it("computes hoursEstimated only when both inputs present", () => {
    expect(
      buildRollups({
        ...baseCard,
        quantityNeeded: 12,
        estimatedMinutesPerUnit: 15,
      }).hoursEstimated,
    ).toBe(3); // 12 * 15 = 180 min = 3 hrs
    expect(
      buildRollups({ ...baseCard, quantityNeeded: 12 }).hoursEstimated,
    ).toBeNull();
    expect(
      buildRollups({ ...baseCard, estimatedMinutesPerUnit: 15 }).hoursEstimated,
    ).toBeNull();
  });

  it("totals unitsDone across sessions, treating null as 0", () => {
    const r = buildRollups({
      ...baseCard,
      sessions: [
        { minutes: 60, unitsCompleted: 5 },
        { minutes: 30, unitsCompleted: null },
        { minutes: 30, unitsCompleted: 3 },
      ],
    });
    expect(r.unitsDone).toBe(8);
  });

  it("percent materials ordered/arrived rounded to integer", () => {
    const r = buildRollups({
      ...baseCard,
      materials: [
        { ordered: true, arrived: false },
        { ordered: true, arrived: false },
        { ordered: false, arrived: false },
      ],
    });
    expect(r.percentMaterialsOrdered).toBe(67);
    expect(r.percentMaterialsArrived).toBe(0);
  });

  it("prototypeBlocker fires when targetDate is within 30 days and prototype not done", () => {
    const now = new Date("2026-09-10T00:00:00Z");
    const target = new Date("2026-09-25T00:00:00Z"); // 15 days
    const r = buildRollups(
      { ...baseCard, prototypeDone: false, targetDate: target },
      now,
    );
    expect(r.prototypeBlocker).toBe(true);
  });

  it("prototypeBlocker silent if prototype is done", () => {
    const now = new Date("2026-09-10T00:00:00Z");
    const target = new Date("2026-09-15T00:00:00Z");
    const r = buildRollups(
      { ...baseCard, prototypeDone: true, targetDate: target },
      now,
    );
    expect(r.prototypeBlocker).toBe(false);
  });

  it("prototypeBlocker silent if target is far away", () => {
    const now = new Date("2026-04-01T00:00:00Z");
    const target = new Date("2026-09-26T00:00:00Z"); // ~178 days
    const r = buildRollups(
      { ...baseCard, prototypeDone: false, targetDate: target },
      now,
    );
    expect(r.prototypeBlocker).toBe(false);
  });

  it("prototypeBlocker silent for past target dates", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    const target = new Date("2026-09-26T00:00:00Z"); // already passed
    const r = buildRollups(
      { ...baseCard, prototypeDone: false, targetDate: target },
      now,
    );
    expect(r.prototypeBlocker).toBe(false);
  });

  it("prototypeBlocker fires at exactly the 30-day boundary", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const target = new Date("2026-10-01T00:00:00Z"); // 30 days exactly
    const r = buildRollups(
      { ...baseCard, prototypeDone: false, targetDate: target },
      now,
    );
    expect(r.prototypeBlocker).toBe(true);
  });
});
