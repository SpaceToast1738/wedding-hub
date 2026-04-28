import { describe, expect, it } from "vitest";
import {
  diffEditedFields,
  mergeEditedFields,
  daysSinceEdited,
} from "@/lib/last-edited-fields";

describe("diffEditedFields — C4", () => {
  it("returns the field names that changed", () => {
    const prev = { name: "Robert", email: "rob@example.com", isChild: false };
    const next = { name: "Bob", email: "rob@example.com", isChild: false };
    expect(diffEditedFields(prev, next)).toEqual(["name"]);
  });

  it("returns empty when nothing changed", () => {
    const prev = { name: "Robert", email: null };
    const next = { name: "Robert", email: null };
    expect(diffEditedFields(prev, next)).toEqual([]);
  });

  it("treats null vs empty-string vs undefined as equivalent", () => {
    const prev = { phone: null, role: undefined };
    const next = { phone: "", role: null };
    expect(diffEditedFields(prev, next)).toEqual([]);
  });

  it("compares arrays order-insensitively (re-order isn't an edit)", () => {
    const prev = { dietary: ["Vegetarian", "Gluten-free"] };
    const next = { dietary: ["Gluten-free", "Vegetarian"] };
    expect(diffEditedFields(prev, next)).toEqual([]);
  });

  it("detects array additions/removals", () => {
    const prev = { dietary: ["Vegetarian"] };
    const next = { dietary: ["Vegetarian", "Gluten-free"] };
    expect(diffEditedFields(prev, next)).toEqual(["dietary"]);
  });

  it("detects boolean change", () => {
    const prev = { isChild: false };
    const next = { isChild: true };
    expect(diffEditedFields(prev, next)).toEqual(["isChild"]);
  });
});

describe("mergeEditedFields — C4", () => {
  const NOW = new Date("2026-04-28T12:00:00Z");

  it("stamps changed fields with the given timestamp", () => {
    const result = mergeEditedFields(null, ["dietary", "email"], NOW);
    expect(result).toEqual({
      dietary: "2026-04-28T12:00:00.000Z",
      email: "2026-04-28T12:00:00.000Z",
    });
  });

  it("preserves existing timestamps for fields that didn't change in this update", () => {
    const existing = {
      notes: "2026-01-01T00:00:00.000Z",
      dietary: "2026-02-15T10:00:00.000Z",
    };
    const result = mergeEditedFields(existing, ["email"], NOW);
    expect(result.notes).toBe("2026-01-01T00:00:00.000Z");
    expect(result.dietary).toBe("2026-02-15T10:00:00.000Z");
    expect(result.email).toBe("2026-04-28T12:00:00.000Z");
  });

  it("updates a previously-stamped field with the new timestamp", () => {
    const existing = { dietary: "2026-01-01T00:00:00.000Z" };
    const result = mergeEditedFields(existing, ["dietary"], NOW);
    expect(result.dietary).toBe("2026-04-28T12:00:00.000Z");
  });

  it("treats null/undefined existing as empty map", () => {
    expect(mergeEditedFields(null, ["a"], NOW)).toEqual({ a: NOW.toISOString() });
    expect(mergeEditedFields(undefined, ["a"], NOW)).toEqual({ a: NOW.toISOString() });
  });
});

describe("daysSinceEdited — C4", () => {
  const NOW = new Date("2026-04-28T12:00:00Z");

  it("returns null when no map", () => {
    expect(daysSinceEdited(null, "dietary", NOW)).toBeNull();
    expect(daysSinceEdited({}, "dietary", NOW)).toBeNull();
  });

  it("returns 0 for same-day edit", () => {
    expect(
      daysSinceEdited({ dietary: "2026-04-28T08:00:00.000Z" }, "dietary", NOW),
    ).toBe(0);
  });

  it("returns rounded day count for older edits", () => {
    expect(
      daysSinceEdited({ dietary: "2026-04-21T12:00:00.000Z" }, "dietary", NOW),
    ).toBe(7);
  });

  it("returns null for unparseable timestamps", () => {
    expect(daysSinceEdited({ dietary: "not-a-date" }, "dietary", NOW)).toBeNull();
  });

  it("returns null for fields not in the map", () => {
    expect(
      daysSinceEdited({ notes: "2026-04-21T12:00:00.000Z" }, "dietary", NOW),
    ).toBeNull();
  });
});
