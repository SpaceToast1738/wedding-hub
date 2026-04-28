import { describe, expect, it } from "vitest";
import {
  coerceBool,
  coerceChild,
  coerceRsvp,
  coerceSide,
  coerceTags,
  coerceDietary,
  detectSeparator,
  inferField,
  isEmptyValue,
  nonEmptyOrNull,
  splitFullName,
} from "@/lib/csv";

// The dedupeKey helper lives inside guests/import/actions.ts (not exported);
// we inline its definition here to test the contract directly. Any change
// to the production helper should be mirrored here. Match: same shape,
// same lower-casing, same trim semantics.
function dedupeKey(householdName: string, first: string, last: string): string {
  return `${householdName}|${first.trim().toLowerCase()}|${last.trim().toLowerCase()}`;
}

describe("dedupeKey", () => {
  it("lower-cases first + last but preserves household casing", () => {
    expect(dedupeKey("The Spencer Family", "Robert", "Spencer")).toBe(
      "The Spencer Family|robert|spencer",
    );
  });

  it("trims whitespace on names", () => {
    expect(dedupeKey("Smith", "  Anna  ", "  Smith ")).toBe("Smith|anna|smith");
  });

  it("handles names with case differences as the same key", () => {
    expect(dedupeKey("X", "Sarah", "Loughran")).toBe(
      dedupeKey("X", "SARAH", "loughran"),
    );
  });
});

describe("coerceBool — placeholder values", () => {
  // The v0.11.1 fix: Say I Do exports use "-" as the not-applicable
  // placeholder for highchair / children's-meal columns. Treat these as
  // false rather than emitting per-row warnings.
  it.each([["-"], ["—"], ["n/a"], ["N/A"], ["na"], ["NA"], ["none"], ["None"]])(
    "treats %s as false",
    (input) => {
      expect(coerceBool(input)).toBe(false);
    },
  );

  it("returns true for truthy values", () => {
    expect(coerceBool("yes")).toBe(true);
    expect(coerceBool("Yes")).toBe(true);
    expect(coerceBool("1")).toBe(true);
    expect(coerceBool("true")).toBe(true);
    expect(coerceBool("y")).toBe(true);
  });

  it("returns false for falsy values", () => {
    expect(coerceBool("no")).toBe(false);
    expect(coerceBool("No")).toBe(false);
    expect(coerceBool("0")).toBe(false);
    expect(coerceBool("false")).toBe(false);
    expect(coerceBool("")).toBe(false);
  });

  it("returns null for genuinely ambiguous values", () => {
    expect(coerceBool("maybe")).toBeNull();
    expect(coerceBool("xyz")).toBeNull();
  });
});

describe("coerceRsvp", () => {
  it("maps common RSVP strings", () => {
    expect(coerceRsvp("yes")).toBe("ATTENDING");
    expect(coerceRsvp("attending")).toBe("ATTENDING");
    expect(coerceRsvp("no")).toBe("DECLINED");
    expect(coerceRsvp("declined")).toBe("DECLINED");
    expect(coerceRsvp("maybe")).toBe("MAYBE");
  });

  it("defaults to PENDING for empty / unknown", () => {
    expect(coerceRsvp("")).toBe("PENDING");
    expect(coerceRsvp("???")).toBe("PENDING");
  });
});

describe("coerceSide", () => {
  it("maps bride/groom/both with case insensitivity", () => {
    expect(coerceSide("bride")).toBe("BRIDE");
    expect(coerceSide("Bride")).toBe("BRIDE");
    expect(coerceSide("groom")).toBe("GROOM");
    expect(coerceSide("Both")).toBe("BOTH");
  });

  it("defaults to BOTH for empty / unknown", () => {
    expect(coerceSide("")).toBe("BOTH");
    expect(coerceSide("xyz")).toBe("BOTH");
  });
});

describe("coerceChild", () => {
  it("treats child markers as true", () => {
    expect(coerceChild("child")).toBe(true);
    expect(coerceChild("Child")).toBe(true);
    expect(coerceChild("kid")).toBe(true);
    expect(coerceChild("infant")).toBe(true);
  });

  it("treats adult markers as false", () => {
    expect(coerceChild("adult")).toBe(false);
    expect(coerceChild("Adult")).toBe(false);
    expect(coerceChild("grown")).toBe(false);
  });

  it("treats Say I Do '-' placeholder as false (v0.10.0 fix)", () => {
    expect(coerceChild("-")).toBe(false);
    expect(coerceChild("")).toBe(false);
  });

  it("returns null for genuinely ambiguous", () => {
    expect(coerceChild("xyz")).toBeNull();
    expect(coerceChild("a")).toBeNull(); // single-letter shorthand not in map
  });
});

describe("coerceDietary / coerceTags", () => {
  it("splits on commas and semicolons", () => {
    expect(coerceDietary("Vegetarian, GF; Nut allergy")).toEqual([
      "Vegetarian",
      "GF",
      "Nut allergy",
    ]);
  });

  it("coerceTags splits on commas / semicolons / pipes (no dedupe)", () => {
    expect(coerceTags("VIP, family")).toEqual(["VIP", "family"]);
    expect(coerceTags("a|b;c")).toEqual(["a", "b", "c"]);
  });

  it("coerceDietary strips negative placeholders", () => {
    expect(coerceDietary("")).toEqual([]);
    expect(coerceDietary("none")).toEqual([]);
    expect(coerceDietary("None")).toEqual([]);
    expect(coerceDietary("-")).toEqual([]);
    expect(coerceDietary("n/a")).toEqual([]);
  });

  it("coerceDietary keeps real entries alongside placeholders", () => {
    expect(coerceDietary("Vegetarian, none, GF")).toEqual(["Vegetarian", "GF"]);
  });
});

describe("isEmptyValue / nonEmptyOrNull", () => {
  it("treats common placeholders as empty", () => {
    expect(isEmptyValue("")).toBe(true);
    expect(isEmptyValue("-")).toBe(true);
    expect(isEmptyValue("n/a")).toBe(true);
    expect(isEmptyValue("none")).toBe(true);
  });

  it("nonEmptyOrNull returns null for empties, trimmed value otherwise", () => {
    expect(nonEmptyOrNull("")).toBeNull();
    expect(nonEmptyOrNull("  ")).toBeNull();
    expect(nonEmptyOrNull(null)).toBeNull();
    expect(nonEmptyOrNull("Sarah")).toBe("Sarah");
    expect(nonEmptyOrNull("  Sarah  ")).toBe("Sarah");
  });
});

describe("splitFullName", () => {
  it("splits on first whitespace", () => {
    expect(splitFullName("Sarah Loughran")).toEqual({
      firstName: "Sarah",
      lastName: "Loughran",
    });
    expect(splitFullName("Mary Anne Smith")).toEqual({
      firstName: "Mary",
      lastName: "Anne Smith",
    });
  });

  it("handles single-word input as firstName only", () => {
    expect(splitFullName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
  });

  it("trims whitespace", () => {
    expect(splitFullName("  Sarah  Loughran  ")).toEqual({
      firstName: "Sarah",
      lastName: "Loughran",
    });
  });
});

describe("detectSeparator", () => {
  it("detects tab when present in headers", () => {
    expect(detectSeparator("First\tLast\tEmail\nAnna\tSmith\ta@x.com")).toBe("\t");
  });

  it("defaults to comma", () => {
    expect(detectSeparator("First,Last,Email")).toBe(",");
  });
});

describe("inferField", () => {
  it("recognises common header names", () => {
    expect(inferField("First Name")).toBe("firstName");
    expect(inferField("Last Name")).toBe("lastName");
    expect(inferField("Email")).toBe("email");
    expect(inferField("Household")).toBe("household");
    expect(inferField("RSVP")).toBe("rsvp");
  });

  it("falls back to ignore for unknown headers", () => {
    expect(inferField("Some Random Column")).toBe("ignore");
  });
});
