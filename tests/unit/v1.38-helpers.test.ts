import { describe, expect, it } from "vitest";
import {
  parseBookFieldValue,
  recipeRollups,
  shotListRollups,
} from "@/lib/book-cards";
import { findShotsForGuest } from "@/lib/guest-cross-refs";

// v1.38.0 (P7b/B + P8): unit coverage for the new pure helpers and
// the FIELD validator's added required / min / max / dateMin /
// dateMax enforcement.

describe("shotListRollups", () => {
  it("returns zeros for empty input", () => {
    const r = shotListRollups([]);
    expect(r.shotCount).toBe(0);
    expect(r.capturedCount).toBe(0);
    expect(r.percentCaptured).toBe(0);
    expect(r.estimatedMinutesTotal).toBeNull();
    expect(r.perCategory.size).toBe(0);
  });

  it("counts captured + computes percent", () => {
    const r = shotListRollups([
      { captured: true },
      { captured: false },
      { captured: true },
      { captured: false },
    ]);
    expect(r.capturedCount).toBe(2);
    expect(r.percentCaptured).toBe(50);
  });

  it("sums durations across shots when at least one estimate is set", () => {
    const r = shotListRollups([
      { captured: false, estimatedMinutes: 10 },
      { captured: false, estimatedMinutes: 5 },
      { captured: false }, // no estimate — ignored
    ]);
    expect(r.estimatedMinutesTotal).toBe(15);
  });

  it("returns null estimatedMinutesTotal when no shot has an estimate", () => {
    const r = shotListRollups([{ captured: false }, { captured: true }]);
    expect(r.estimatedMinutesTotal).toBeNull();
  });

  it("buckets per category, including empty key for null/empty category", () => {
    const r = shotListRollups([
      { captured: false, category: "Pre-ceremony", estimatedMinutes: 15 },
      { captured: true, category: "Pre-ceremony" },
      { captured: false, category: "Family formals", estimatedMinutes: 20 },
      { captured: false, category: null },
      { captured: false, category: "  " },
    ]);
    expect(r.perCategory.get("Pre-ceremony")?.count).toBe(2);
    expect(r.perCategory.get("Pre-ceremony")?.captured).toBe(1);
    expect(r.perCategory.get("Pre-ceremony")?.estimatedMinutes).toBe(15);
    expect(r.perCategory.get("Family formals")?.estimatedMinutes).toBe(20);
    expect(r.perCategory.get("")?.count).toBe(2);
  });
});

describe("recipeRollups", () => {
  it("returns null sums + 0 counts for empty input", () => {
    const r = recipeRollups([]);
    expect(r.activeMinutes).toBeNull();
    expect(r.dayBeforeMinutes).toBeNull();
    expect(r.dayBeforeCount).toBe(0);
    expect(r.stepCount).toBe(0);
  });

  it("sums non-day-before durations into activeMinutes", () => {
    const r = recipeRollups([
      { durationMinutes: 5, dayBefore: false },
      { durationMinutes: 10, dayBefore: false },
      { durationMinutes: 30, dayBefore: true }, // not active
    ]);
    expect(r.activeMinutes).toBe(15);
  });

  it("sums day-before durations into dayBeforeMinutes + counts day-before steps", () => {
    const r = recipeRollups([
      { durationMinutes: 30, dayBefore: true },
      { durationMinutes: 60, dayBefore: true },
      { durationMinutes: 5, dayBefore: false },
    ]);
    expect(r.dayBeforeMinutes).toBe(90);
    expect(r.dayBeforeCount).toBe(2);
    expect(r.activeMinutes).toBe(5);
  });

  it("returns null when no step in that bucket has a duration set", () => {
    const r = recipeRollups([
      { dayBefore: false }, // no duration
      { dayBefore: true }, // no duration
    ]);
    expect(r.activeMinutes).toBeNull();
    expect(r.dayBeforeMinutes).toBeNull();
    expect(r.dayBeforeCount).toBe(1);
  });
});

describe("findShotsForGuest", () => {
  const shots = [
    {
      shotId: "s1",
      shotTitle: "Couple by altar",
      shotCategory: "Ceremony",
      shotOrder: 0,
      shotCaptured: false,
      cardId: "c1",
      subsectionSlug: "key-shots",
      subsectionTitle: "Key shots",
      sectionSlug: "photography",
      guestIds: ["g-bryony", "g-jamie"],
    },
    {
      shotId: "s2",
      shotTitle: "Family group",
      shotCategory: "Family formals",
      shotOrder: 1,
      shotCaptured: false,
      cardId: "c1",
      subsectionSlug: "key-shots",
      subsectionTitle: "Key shots",
      sectionSlug: "photography",
      guestIds: ["g-bryony"],
    },
    {
      shotId: "s3",
      shotTitle: "Bridesmaids",
      shotCategory: "Pre-ceremony",
      shotOrder: 0,
      shotCaptured: true,
      cardId: "c1",
      subsectionSlug: "key-shots",
      subsectionTitle: "Key shots",
      sectionSlug: "photography",
      guestIds: ["g-aimee"],
    },
  ];

  it("returns empty when no shot lists this guest", () => {
    expect(findShotsForGuest("g-nobody", shots)).toEqual([]);
  });

  it("returns shots that include the guest", () => {
    expect(findShotsForGuest("g-bryony", shots)).toHaveLength(2);
  });

  it("preserves capture state on the returned shape", () => {
    const r = findShotsForGuest("g-aimee", shots);
    expect(r[0]!.shotCaptured).toBe(true);
  });

  it("sorts by subsectionTitle then shotOrder", () => {
    const r = findShotsForGuest("g-bryony", shots);
    expect(r.map((s) => s.shotId)).toEqual(["s1", "s2"]);
  });
});

describe("parseBookFieldValue — v1.38.0 enforcements", () => {
  function def(overrides: Record<string, unknown>) {
    return {
      id: "x",
      label: "Test",
      type: "text" as const,
      options: [] as string[],
      order: 0,
      ...overrides,
    };
  }

  it("rejects empty value when required = true", () => {
    expect(() => parseBookFieldValue(def({ required: true }), "")).toThrow(/required/);
    expect(() => parseBookFieldValue(def({ required: true }), null)).toThrow(/required/);
  });

  it("accepts empty value when required = false", () => {
    expect(parseBookFieldValue(def({ required: false }), "")).toBeNull();
  });

  it("enforces number min", () => {
    expect(() =>
      parseBookFieldValue(def({ type: "number", min: 0 }), "-5"),
    ).toThrow(/≥ 0/);
  });

  it("enforces number max", () => {
    expect(() =>
      parseBookFieldValue(def({ type: "number", max: 100 }), "101"),
    ).toThrow(/≤ 100/);
  });

  it("accepts number inside range", () => {
    expect(parseBookFieldValue(def({ type: "number", min: 0, max: 100 }), "50")).toBe(50);
  });

  it("enforces dateMin", () => {
    expect(() =>
      parseBookFieldValue(
        def({ type: "date", dateMin: "2026-09-01" }),
        "2026-08-15",
      ),
    ).toThrow(/on or after 2026-09-01/);
  });

  it("enforces dateMax", () => {
    expect(() =>
      parseBookFieldValue(
        def({ type: "date", dateMax: "2026-09-26" }),
        "2026-09-30",
      ),
    ).toThrow(/on or before 2026-09-26/);
  });

  it("accepts date inside range", () => {
    expect(
      parseBookFieldValue(
        def({ type: "date", dateMin: "2026-09-01", dateMax: "2026-09-30" }),
        "2026-09-15",
      ),
    ).toBe("2026-09-15");
  });
});
