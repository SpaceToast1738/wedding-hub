import { describe, expect, it } from "vitest";
import {
  parseCustomFieldValue,
  formatCustomFieldValue,
  mergeCustomFieldValue,
  type CustomFieldDef,
} from "@/lib/custom-fields";

const textDef: CustomFieldDef = {
  id: "f1", entity: "guest", name: "Hometown", type: "text", options: [], order: 0,
};
const numberDef: CustomFieldDef = {
  id: "f2", entity: "guest", name: "Years known", type: "number", options: [], order: 1,
};
const dateDef: CustomFieldDef = {
  id: "f3", entity: "guest", name: "Met on", type: "date", options: [], order: 2,
};
const selectDef: CustomFieldDef = {
  id: "f4", entity: "guest", name: "Travel mode", type: "select",
  options: ["Driving", "Train", "Flying"], order: 3,
};

describe("parseCustomFieldValue — C10", () => {
  it("text: trims and accepts non-empty strings", () => {
    expect(parseCustomFieldValue(textDef, "  Norwich  ")).toBe("Norwich");
  });

  it("text: returns null for empty / whitespace / null / undefined", () => {
    expect(parseCustomFieldValue(textDef, "")).toBeNull();
    expect(parseCustomFieldValue(textDef, "   ")).toBeNull();
    expect(parseCustomFieldValue(textDef, null)).toBeNull();
    expect(parseCustomFieldValue(textDef, undefined)).toBeNull();
  });

  it("text: throws on > 2000 chars", () => {
    expect(() => parseCustomFieldValue(textDef, "a".repeat(2001))).toThrow(/too long/);
  });

  it("number: parses bare and comma-separated input", () => {
    expect(parseCustomFieldValue(numberDef, "12")).toBe(12);
    expect(parseCustomFieldValue(numberDef, "1,234")).toBe(1234);
    expect(parseCustomFieldValue(numberDef, "  42 ")).toBe(42);
  });

  it("number: throws on non-numeric input", () => {
    expect(() => parseCustomFieldValue(numberDef, "abc")).toThrow(/must be a number/);
    expect(() => parseCustomFieldValue(numberDef, "12abc")).toThrow(/must be a number/);
  });

  it("number: rejects Infinity and NaN-shaped values", () => {
    expect(() => parseCustomFieldValue(numberDef, "Infinity")).toThrow(/must be a number/);
  });

  it("date: normalises to YYYY-MM-DD", () => {
    expect(parseCustomFieldValue(dateDef, "2026-09-26")).toBe("2026-09-26");
    expect(parseCustomFieldValue(dateDef, "2026-09-26T12:00:00Z")).toBe("2026-09-26");
  });

  it("date: throws on invalid input", () => {
    expect(() => parseCustomFieldValue(dateDef, "not-a-date")).toThrow(/not a valid date/);
  });

  it("select: accepts values from options", () => {
    expect(parseCustomFieldValue(selectDef, "Train")).toBe("Train");
  });

  it("select: throws on unknown values", () => {
    expect(() => parseCustomFieldValue(selectDef, "Helicopter")).toThrow(/must be one of/);
  });
});

describe("formatCustomFieldValue — C10", () => {
  it("renders dash for null/undefined", () => {
    expect(formatCustomFieldValue(textDef, null)).toBe("—");
    expect(formatCustomFieldValue(textDef, undefined)).toBe("—");
  });

  it("number: en-GB locale with thousands separator", () => {
    expect(formatCustomFieldValue(numberDef, 1234)).toBe("1,234");
    expect(formatCustomFieldValue(numberDef, 0)).toBe("0");
  });

  it("date: en-GB short format", () => {
    // Format: "26 Sep 2026" — locale-dependent but the day/year are stable.
    const formatted = formatCustomFieldValue(dateDef, "2026-09-26");
    expect(formatted).toMatch(/26.*2026/);
  });

  it("text + select: pass through", () => {
    expect(formatCustomFieldValue(textDef, "Hello")).toBe("Hello");
    expect(formatCustomFieldValue(selectDef, "Train")).toBe("Train");
  });
});

describe("mergeCustomFieldValue — C10", () => {
  it("adds a new field to the map", () => {
    const result = mergeCustomFieldValue(null, "f1", "Norwich");
    expect(result).toEqual({ f1: "Norwich" });
  });

  it("updates an existing field in place", () => {
    const result = mergeCustomFieldValue({ f1: "Norwich" }, "f1", "London");
    expect(result).toEqual({ f1: "London" });
  });

  it("setting null drops the key entirely", () => {
    const result = mergeCustomFieldValue({ f1: "Norwich", f2: 12 }, "f1", null);
    expect(result).toEqual({ f2: 12 });
  });

  it("doesn't mutate the input", () => {
    const before = { f1: "Norwich" };
    mergeCustomFieldValue(before, "f1", "London");
    expect(before).toEqual({ f1: "Norwich" });
  });
});
