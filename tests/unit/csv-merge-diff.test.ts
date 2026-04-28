import { describe, expect, it } from "vitest";
import {
  decideGuestMerge,
  type GuestSnapshot,
  type IncomingRow,
  type MergeableField,
} from "@/lib/csv-merge";

// Default-empty snapshot: a freshly-created guest with no overrides.
// Tests build on top of this and override only the fields they care about.
function snapshot(overrides: Partial<GuestSnapshot> = {}): GuestSnapshot {
  return {
    email: null,
    phone: null,
    plusOneName: null,
    role: null,
    side: "BOTH",
    rsvp: "PENDING",
    isChild: false,
    needsHighchair: false,
    childrenMeal: false,
    plusOneAllowed: false,
    dietary: [],
    tags: [],
    mealStarter: null,
    mealMain: null,
    mealDessert: null,
    rsvpUniqueLink: null,
    notes: null,
    songTitles: [],
    ...overrides,
  };
}

function incoming(overrides: Partial<IncomingRow> = {}): IncomingRow {
  return {
    email: null,
    phone: null,
    plusOneName: null,
    role: null,
    side: "BOTH",
    rsvp: "PENDING",
    isChild: false,
    needsHighchair: false,
    childrenMeal: false,
    plusOneAllowed: false,
    dietary: [],
    tags: [],
    mealStarter: null,
    mealMain: null,
    mealDessert: null,
    rsvpLink: null,
    notes: null,
    songs: [],
    ...overrides,
  };
}

describe("decideGuestMerge — strings (overwrite-if-new)", () => {
  it("overwrites email when existing is empty and incoming is non-empty", () => {
    const result = decideGuestMerge(
      snapshot({ email: null }),
      incoming({ email: "robert@example.com" }),
    );
    expect(result.data.email).toBe("robert@example.com");
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]).toEqual({
      field: "email",
      label: "Email",
      oldValue: "—",
      newValue: "robert@example.com",
    });
  });

  it("overwrites email when incoming differs from existing", () => {
    const result = decideGuestMerge(
      snapshot({ email: "old@example.com" }),
      incoming({ email: "new@example.com" }),
    );
    expect(result.data.email).toBe("new@example.com");
    expect(result.diffs[0]?.newValue).toBe("new@example.com");
  });

  it("does NOT overwrite email when incoming is empty (no blanking)", () => {
    const result = decideGuestMerge(
      snapshot({ email: "keep@example.com" }),
      incoming({ email: null }),
    );
    expect(result.data).toEqual({});
    expect(result.diffs).toHaveLength(0);
  });

  it("does NOT diff when incoming equals existing", () => {
    const result = decideGuestMerge(
      snapshot({ email: "same@example.com" }),
      incoming({ email: "same@example.com" }),
    );
    expect(result.data).toEqual({});
    expect(result.diffs).toHaveLength(0);
  });

  it("rsvpLink writes to rsvpUniqueLink in the data payload", () => {
    const result = decideGuestMerge(
      snapshot({ rsvpUniqueLink: null }),
      incoming({ rsvpLink: "abc123" }),
    );
    expect(result.data.rsvpUniqueLink).toBe("abc123");
    expect(result.diffs[0]?.field).toBe("rsvpLink");
  });
});

describe("decideGuestMerge — booleans (OR semantics)", () => {
  it("upgrades isChild false → true", () => {
    const result = decideGuestMerge(
      snapshot({ isChild: false }),
      incoming({ isChild: true }),
    );
    expect(result.data.isChild).toBe(true);
    expect(result.diffs[0]?.field).toBe("isChild");
  });

  it("never downgrades true → false", () => {
    const result = decideGuestMerge(
      snapshot({ isChild: true }),
      incoming({ isChild: false }),
    );
    expect(result.data).toEqual({});
    expect(result.diffs).toHaveLength(0);
  });
});

describe("decideGuestMerge — RSVP (don't reset confirmed)", () => {
  it("does not overwrite ATTENDING with PENDING", () => {
    const result = decideGuestMerge(
      snapshot({ rsvp: "ATTENDING" }),
      incoming({ rsvp: "PENDING" }),
    );
    expect(result.data).toEqual({});
    expect(result.diffs).toHaveLength(0);
  });

  it("does overwrite PENDING with ATTENDING", () => {
    const result = decideGuestMerge(
      snapshot({ rsvp: "PENDING" }),
      incoming({ rsvp: "ATTENDING" }),
    );
    expect(result.data.rsvp).toBe("ATTENDING");
    expect(result.diffs[0]?.field).toBe("rsvp");
  });
});

describe("decideGuestMerge — side (don't blank to BOTH)", () => {
  it("does not overwrite BRIDE with BOTH", () => {
    const result = decideGuestMerge(
      snapshot({ side: "BRIDE" }),
      incoming({ side: "BOTH" }),
    );
    expect(result.data).toEqual({});
  });

  it("does overwrite BOTH with GROOM", () => {
    const result = decideGuestMerge(
      snapshot({ side: "BOTH" }),
      incoming({ side: "GROOM" }),
    );
    expect(result.data.side).toBe("GROOM");
  });
});

describe("decideGuestMerge — arrays (case-insensitive union)", () => {
  it("unions dietary additions", () => {
    const result = decideGuestMerge(
      snapshot({ dietary: ["Vegetarian"] }),
      incoming({ dietary: ["Gluten-free"] }),
    );
    expect(result.data.dietary).toEqual(["Vegetarian", "Gluten-free"]);
    expect(result.diffs[0]).toEqual({
      field: "dietary",
      label: "Dietary",
      oldValue: "Vegetarian",
      newValue: "Vegetarian, Gluten-free",
    });
  });

  it("dedupes case-insensitively (no diff when only ci-duplicate)", () => {
    const result = decideGuestMerge(
      snapshot({ dietary: ["Vegetarian"] }),
      incoming({ dietary: ["VEGETARIAN"] }),
    );
    expect(result.data).toEqual({});
    expect(result.diffs).toHaveLength(0);
  });
});

describe("decideGuestMerge — songs", () => {
  it("returns new song titles via songsToAdd", () => {
    const result = decideGuestMerge(
      snapshot({ songTitles: ["Yellow"] }),
      incoming({ songs: ["Don't Stop Me Now", "yellow"] }),
    );
    expect(result.songsToAdd).toEqual(["Don't Stop Me Now"]);
    expect(result.diffs[0]?.field).toBe("songs");
  });

  it("opt-out skips adding songs but still reports the diff", () => {
    const result = decideGuestMerge(
      snapshot({ songTitles: [] }),
      incoming({ songs: ["Mr. Brightside"] }),
      new Set<MergeableField>(["songs"]),
    );
    expect(result.songsToAdd).toEqual([]);
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]?.field).toBe("songs");
  });
});

describe("decideGuestMerge — opt-out suppresses overwrites but keeps diffs", () => {
  it("opting out of dietary skips data.dietary but still reports the diff", () => {
    const result = decideGuestMerge(
      snapshot({ dietary: ["Vegetarian"] }),
      incoming({ dietary: ["Gluten-free"] }),
      new Set<MergeableField>(["dietary"]),
    );
    expect(result.data).toEqual({});
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]?.field).toBe("dietary");
  });

  it("opting out of one field doesn't suppress others", () => {
    const result = decideGuestMerge(
      snapshot({ email: null, phone: null }),
      incoming({ email: "new@example.com", phone: "+44 7700 900000" }),
      new Set<MergeableField>(["email"]),
    );
    expect(result.data.email).toBeUndefined();
    expect(result.data.phone).toBe("+44 7700 900000");
    // Both diffs still surface so the user can confirm what was opted out.
    expect(result.diffs.map((d) => d.field).sort()).toEqual(["email", "phone"]);
  });
});

describe("decideGuestMerge — notes (append, don't dupe)", () => {
  it("appends incoming notes when existing is empty", () => {
    const result = decideGuestMerge(
      snapshot({ notes: null }),
      incoming({ notes: "Allergic to nuts" }),
    );
    expect(result.data.notes).toBe("Allergic to nuts");
  });

  it("appends with newline when existing has different content", () => {
    const result = decideGuestMerge(
      snapshot({ notes: "First note" }),
      incoming({ notes: "Second note" }),
    );
    expect(result.data.notes).toBe("First note\nSecond note");
  });

  it("does not duplicate when incoming is already a substring of existing", () => {
    const result = decideGuestMerge(
      snapshot({ notes: "Allergic to nuts and shellfish" }),
      incoming({ notes: "nuts" }),
    );
    expect(result.data).toEqual({});
  });
});

describe("decideGuestMerge — empty diffs (no-op merge)", () => {
  it("returns no diffs and no data when nothing differs", () => {
    const same = {
      email: "a@b.com",
      side: "BRIDE" as const,
      rsvp: "ATTENDING" as const,
      dietary: ["Vegetarian"],
    };
    const result = decideGuestMerge(snapshot(same), incoming(same));
    expect(result.data).toEqual({});
    expect(result.diffs).toHaveLength(0);
    expect(result.songsToAdd).toEqual([]);
  });
});
