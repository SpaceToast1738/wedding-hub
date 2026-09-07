import { describe, expect, it } from "vitest";
import { truncate, wrapSeatLabel } from "@/app/(app)/seating/seat-label";

describe("wrapSeatLabel", () => {
  it("leaves short names alone", () => {
    expect(wrapSeatLabel("Josh", 14)).toEqual(["Josh"]);
    expect(wrapSeatLabel("  Josh ", 14)).toEqual(["Josh"]);
  });

  it("returns nothing for an empty name", () => {
    expect(wrapSeatLabel("", 14)).toEqual([]);
    expect(wrapSeatLabel("   ", 14)).toEqual([]);
  });

  it("breaks at a space when over budget", () => {
    expect(wrapSeatLabel("Katherine (Kat)", 14)).toEqual(["Katherine", "(Kat)"]);
    expect(wrapSeatLabel("Gianmarco (Marco)", 14)).toEqual(["Gianmarco", "(Marco)"]);
  });

  it("breaks after a hyphen, keeping the hyphen on line one", () => {
    expect(wrapSeatLabel("Bryony-Olwyn", 8)).toEqual(["Bryony-", "Olwyn"]);
  });

  it("uses the last break-point that still fits line one", () => {
    expect(wrapSeatLabel("Mary Jane Watson", 14)).toEqual(["Mary Jane", "Watson"]);
    expect(wrapSeatLabel("Mary Jane Watson", 6)).toEqual(["Mary", "Jane…"]);
  });

  it("falls back to truncation when there is no break-point", () => {
    expect(wrapSeatLabel("Bartholomewson", 8)).toEqual(["Barthol…"]);
  });

  it("ignores a break-point that would leave line one over budget", () => {
    // Only space is at index 12 > 8, so it cannot help.
    expect(wrapSeatLabel("Bartholomews on", 8)).toEqual(["Barthol…"]);
  });

  it("truncates a second line that is still too long", () => {
    expect(wrapSeatLabel("Jo Bartholomewson", 8)).toEqual(["Jo", "Barthol…"]);
  });

  it("never exceeds two lines", () => {
    expect(wrapSeatLabel("Anna Maria Louisa Rose", 10)).toHaveLength(2);
  });
});

describe("truncate", () => {
  it("adds an ellipsis only when needed", () => {
    expect(truncate("Josh", 4)).toBe("Josh");
    expect(truncate("Joshua", 4)).toBe("Jos…");
  });
});
