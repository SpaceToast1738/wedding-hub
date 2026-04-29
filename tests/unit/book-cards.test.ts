import { describe, expect, it } from "vitest";
import {
  formatBookFieldValue,
  normaliseRecipeList,
  parseBookFieldValue,
  parseOutfitItems,
  parseWithWhom,
  validateOutfit,
  validateRecipe,
  validateShot,
  type BookFieldDefShape,
} from "@/lib/book-cards";

// ─── FIELD card ───────────────────────────────────────────────────

const TEXT_DEF: BookFieldDefShape = {
  id: "f1",
  label: "Note",
  type: "text",
  options: [],
  order: 0,
};
const NUMBER_DEF: BookFieldDefShape = {
  id: "f2",
  label: "Count",
  type: "number",
  options: [],
  order: 0,
};
const DATE_DEF: BookFieldDefShape = {
  id: "f3",
  label: "Due",
  type: "date",
  options: [],
  order: 0,
};
const SELECT_DEF: BookFieldDefShape = {
  id: "f4",
  label: "Status",
  type: "select",
  options: ["Ordered", "Fitted", "Collected"],
  order: 0,
};

describe("parseBookFieldValue — v1.26.0", () => {
  it("returns null for empty / whitespace input", () => {
    expect(parseBookFieldValue(TEXT_DEF, "")).toBe(null);
    expect(parseBookFieldValue(TEXT_DEF, "   ")).toBe(null);
    expect(parseBookFieldValue(TEXT_DEF, null)).toBe(null);
    expect(parseBookFieldValue(TEXT_DEF, undefined)).toBe(null);
  });

  it("trims text values", () => {
    expect(parseBookFieldValue(TEXT_DEF, "  hello  ")).toBe("hello");
  });

  it("rejects text over 2000 chars", () => {
    expect(() => parseBookFieldValue(TEXT_DEF, "x".repeat(2001))).toThrow();
  });

  it("parses numbers, stripping thousands separators", () => {
    expect(parseBookFieldValue(NUMBER_DEF, "1,234")).toBe(1234);
    expect(parseBookFieldValue(NUMBER_DEF, "1 234.5")).toBe(1234.5);
    expect(parseBookFieldValue(NUMBER_DEF, "0")).toBe(0);
  });

  it("rejects non-numeric strings for number fields", () => {
    expect(() => parseBookFieldValue(NUMBER_DEF, "abc")).toThrow();
  });

  it("normalises dates to YYYY-MM-DD", () => {
    expect(parseBookFieldValue(DATE_DEF, "2026-09-26")).toBe("2026-09-26");
    expect(parseBookFieldValue(DATE_DEF, "2026-09-26T14:00:00Z")).toBe("2026-09-26");
  });

  it("rejects invalid dates", () => {
    expect(() => parseBookFieldValue(DATE_DEF, "not-a-date")).toThrow();
  });

  it("accepts only listed options for select fields", () => {
    expect(parseBookFieldValue(SELECT_DEF, "Fitted")).toBe("Fitted");
    expect(() => parseBookFieldValue(SELECT_DEF, "Other")).toThrow();
  });
});

describe("formatBookFieldValue — v1.26.0", () => {
  it("renders em-dash for null values", () => {
    expect(formatBookFieldValue(TEXT_DEF, null)).toBe("—");
    expect(formatBookFieldValue(NUMBER_DEF, undefined)).toBe("—");
  });

  it("formats numbers with locale separators", () => {
    expect(formatBookFieldValue(NUMBER_DEF, 1234)).toMatch(/1[,.]234/);
  });

  it("formats dates in en-GB short form", () => {
    const out = formatBookFieldValue(DATE_DEF, "2026-09-26");
    expect(out).toMatch(/26/);
    expect(out).toMatch(/Sep/);
    expect(out).toMatch(/2026/);
  });

  it("returns text values unchanged", () => {
    expect(formatBookFieldValue(TEXT_DEF, "hello")).toBe("hello");
  });
});

// ─── RECIPE card ──────────────────────────────────────────────────

describe("normaliseRecipeList — v1.26.0", () => {
  it("trims + drops empties", () => {
    expect(normaliseRecipeList(["  apple ", "", "  ", "pear"])).toEqual([
      "apple",
      "pear",
    ]);
  });
});

describe("validateRecipe — v1.26.0", () => {
  it("normalises ingredients + steps + notes", () => {
    const out = validateRecipe({
      ingredients: ["  Apple ", "", "Pear"],
      steps: ["Mix ", "Stir"],
      notes: "  Serve cold  ",
    });
    expect(out.ingredients).toEqual(["Apple", "Pear"]);
    expect(out.steps).toEqual(["Mix", "Stir"]);
    expect(out.notes).toBe("Serve cold");
  });

  it("collapses empty notes to null", () => {
    const out = validateRecipe({ ingredients: [], steps: [], notes: "  " });
    expect(out.notes).toBe(null);
  });

  it("rejects too-many ingredients", () => {
    const lots = Array.from({ length: 101 }, (_, i) => `Item ${i}`);
    expect(() => validateRecipe({ ingredients: lots, steps: [], notes: null })).toThrow();
  });

  it("rejects an entry over 500 chars", () => {
    expect(() =>
      validateRecipe({ ingredients: ["x".repeat(501)], steps: [], notes: null }),
    ).toThrow();
  });
});

// ─── SHOT_LIST card ───────────────────────────────────────────────

describe("parseWithWhom — v1.26.0", () => {
  it("splits comma-separated values + trims + drops empties", () => {
    expect(parseWithWhom("Bryony, Jamie ,  ,Aimee")).toEqual([
      "Bryony",
      "Jamie",
      "Aimee",
    ]);
  });
  it("returns [] on null / undefined / empty", () => {
    expect(parseWithWhom(null)).toEqual([]);
    expect(parseWithWhom(undefined)).toEqual([]);
    expect(parseWithWhom("")).toEqual([]);
  });
});

describe("validateShot — v1.26.0", () => {
  it("requires a non-empty title", () => {
    expect(() =>
      validateShot({ title: "  ", withWhom: [], location: null, notes: null }),
    ).toThrow();
  });
  it("returns the canonical shape", () => {
    const out = validateShot({
      title: "  Couple by altar  ",
      withWhom: ["Bryony", "  Jamie  ", ""],
      location: "  Altar  ",
      notes: " ",
    });
    expect(out.title).toBe("Couple by altar");
    expect(out.withWhom).toEqual(["Bryony", "Jamie"]);
    expect(out.location).toBe("Altar");
    expect(out.notes).toBe(null);
  });
});

// ─── OUTFIT card ──────────────────────────────────────────────────

describe("validateOutfit — v1.26.0", () => {
  it("requires a non-empty person name", () => {
    expect(() =>
      validateOutfit({
        personName: "",
        role: null,
        items: [],
        supplier: null,
        status: null,
        notes: null,
      }),
    ).toThrow();
  });

  it("returns the canonical shape", () => {
    const out = validateOutfit({
      personName: "  Bryony  ",
      role: " Bride ",
      items: ["  Lace gown ", "", "Veil"],
      supplier: " Maggie Sottero ",
      status: " Fitted ",
      notes: "  ",
    });
    expect(out.personName).toBe("Bryony");
    expect(out.role).toBe("Bride");
    expect(out.items).toEqual(["Lace gown", "Veil"]);
    expect(out.supplier).toBe("Maggie Sottero");
    expect(out.status).toBe("Fitted");
    expect(out.notes).toBe(null);
  });

  it("rejects too many items", () => {
    expect(() =>
      validateOutfit({
        personName: "Bryony",
        role: null,
        items: Array.from({ length: 31 }, (_, i) => `Item ${i}`),
        supplier: null,
        status: null,
        notes: null,
      }),
    ).toThrow();
  });
});

describe("parseOutfitItems — v1.26.0", () => {
  it("aliases parseWithWhom (same comma-split behaviour)", () => {
    expect(parseOutfitItems("Suit, Shirt, Tie")).toEqual([
      "Suit",
      "Shirt",
      "Tie",
    ]);
  });
});
