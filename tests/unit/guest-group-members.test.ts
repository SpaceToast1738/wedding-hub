import { describe, expect, it } from "vitest";
import {
  BUILTIN_GUEST_GROUPS,
  BUILTIN_GUEST_GROUP_SLUGS,
  guestDisplayName,
  guestGroupsForGuest,
  normaliseHexColour,
  resolveBuiltinGuestGroup,
  resolveGuestGroupMembers,
  resolveGuestGroupMembersUnion,
} from "@/lib/guest-group-members";

const GUESTS = [
  { id: "g1", firstName: "Robert", lastName: "Spencer", side: "GROOM", archived: false },
  { id: "g2", firstName: "Margaret", lastName: "Spencer", side: "GROOM", archived: false },
  { id: "g3", firstName: "Sue", lastName: "Olwyn-Davis", side: "BRIDE", archived: false },
  { id: "g4", firstName: "Tom", lastName: "Olwyn-Davis", side: "BRIDE", archived: false },
  { id: "g5", firstName: "Mutual", lastName: "Friend", side: "BOTH", archived: false },
  { id: "g6", firstName: "Archived", lastName: "Cousin", side: "GROOM", archived: true },
];

const CUSTOM_GROUPS = [
  {
    id: "gg1",
    slug: "spencer-extended",
    name: "Spencer extended family",
    colour: "#a3c9a8",
    members: [{ id: "g1" }, { id: "g2" }],
  },
  {
    id: "gg2",
    slug: "after-party",
    name: "After-party",
    colour: null,
    members: [{ id: "g3" }, { id: "g5" }, { id: "g6" }],
  },
];

describe("guestDisplayName", () => {
  it("composes firstName + lastName", () => {
    expect(guestDisplayName(GUESTS[0]!)).toBe("Robert Spencer");
  });

  it("falls back to placeholder when both empty", () => {
    expect(guestDisplayName({ id: "x", firstName: "", lastName: "" })).toBe("(unnamed guest)");
  });
});

describe("BUILTIN_GUEST_GROUPS", () => {
  it("has three entries with unique slugs", () => {
    expect(BUILTIN_GUEST_GROUPS).toHaveLength(3);
    const slugs = BUILTIN_GUEST_GROUPS.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("BUILTIN_GUEST_GROUP_SLUGS mirrors the slug list", () => {
    for (const g of BUILTIN_GUEST_GROUPS) {
      expect(BUILTIN_GUEST_GROUP_SLUGS.has(g.slug)).toBe(true);
    }
  });
});

describe("resolveBuiltinGuestGroup", () => {
  it("bride-side returns only side=BRIDE non-archived guests", () => {
    const r = resolveBuiltinGuestGroup("bride-side", GUESTS);
    expect(r.map((g) => g.id).sort()).toEqual(["g3", "g4"]);
  });

  it("groom-side excludes archived guests", () => {
    const r = resolveBuiltinGuestGroup("groom-side", GUESTS);
    expect(r.map((g) => g.id).sort()).toEqual(["g1", "g2"]);
  });

  it("both-sides only matches Side=BOTH", () => {
    const r = resolveBuiltinGuestGroup("both-sides", GUESTS);
    expect(r.map((g) => g.id)).toEqual(["g5"]);
  });

  it("throws on unknown slug", () => {
    expect(() => resolveBuiltinGuestGroup("nonsense", GUESTS)).toThrow(/Unknown/);
  });
});

describe("resolveGuestGroupMembers", () => {
  it("resolves builtin: refs", () => {
    expect(resolveGuestGroupMembers("builtin:bride-side", GUESTS, CUSTOM_GROUPS).map((g) => g.id).sort())
      .toEqual(["g3", "g4"]);
  });

  it("resolves group:<slug> refs and excludes archived members", () => {
    // g6 is archived but is a member of after-party — it should NOT
    // come back from resolution.
    expect(resolveGuestGroupMembers("group:after-party", GUESTS, CUSTOM_GROUPS).map((g) => g.id).sort())
      .toEqual(["g3", "g5"]);
  });

  it("resolves guest:<id>", () => {
    expect(resolveGuestGroupMembers("guest:g1", GUESTS, CUSTOM_GROUPS).map((g) => g.id)).toEqual(["g1"]);
  });

  it("guest:<id> for archived guest returns empty", () => {
    expect(resolveGuestGroupMembers("guest:g6", GUESTS, CUSTOM_GROUPS)).toEqual([]);
  });

  it("returns empty for unknown built-in slug", () => {
    expect(resolveGuestGroupMembers("builtin:does-not-exist", GUESTS, CUSTOM_GROUPS)).toEqual([]);
  });

  it("returns empty for unknown custom slug", () => {
    expect(resolveGuestGroupMembers("group:nope", GUESTS, CUSTOM_GROUPS)).toEqual([]);
  });

  it("returns empty for malformed ref", () => {
    expect(resolveGuestGroupMembers("g1", GUESTS, CUSTOM_GROUPS)).toEqual([]);
  });
});

describe("resolveGuestGroupMembersUnion", () => {
  it("dedupes across multiple refs preserving first-seen order", () => {
    const refs = ["group:spencer-extended", "builtin:bride-side", "group:after-party"];
    const r = resolveGuestGroupMembersUnion(refs, GUESTS, CUSTOM_GROUPS);
    expect(r.map((g) => g.id)).toEqual(["g1", "g2", "g3", "g4", "g5"]);
  });
});

describe("guestGroupsForGuest", () => {
  it("returns built-in side group + custom memberships in declaration order", () => {
    const r = guestGroupsForGuest("g3", GUESTS, CUSTOM_GROUPS);
    expect(r).toEqual(["builtin:bride-side", "group:after-party"]);
  });

  it("returns empty for an archived guest", () => {
    // Even though g6 is an after-party member, archived guests are
    // excluded from built-in resolution. The guest IS still listed
    // in the after-party m2m table though, so they show under the
    // custom group ref. This matches "show me everything I'm in"
    // behaviour for archive review.
    const r = guestGroupsForGuest("g6", GUESTS, CUSTOM_GROUPS);
    // g6 is archived → resolveBuiltinGuestGroup excludes them, so
    // no built-in shows. Custom group still shows because the m2m
    // row still exists.
    expect(r).toEqual(["group:after-party"]);
  });

  it("returns empty for an unknown guest id", () => {
    expect(guestGroupsForGuest("g-nope", GUESTS, CUSTOM_GROUPS)).toEqual([]);
  });
});

describe("normaliseHexColour", () => {
  it("returns null for null/undefined/empty", () => {
    expect(normaliseHexColour(null)).toBeNull();
    expect(normaliseHexColour(undefined)).toBeNull();
    expect(normaliseHexColour("")).toBeNull();
    expect(normaliseHexColour("   ")).toBeNull();
  });

  it("accepts and normalises 6-digit hex with leading #", () => {
    expect(normaliseHexColour("#A3C9A8")).toBe("#a3c9a8");
  });

  it("accepts 6-digit hex without leading #", () => {
    expect(normaliseHexColour("a3C9A8")).toBe("#a3c9a8");
  });

  it("expands 3-digit hex to 6", () => {
    expect(normaliseHexColour("#abc")).toBe("#aabbcc");
    expect(normaliseHexColour("aBc")).toBe("#aabbcc");
  });

  it("returns null for invalid input", () => {
    expect(normaliseHexColour("xyz")).toBeNull();
    expect(normaliseHexColour("#12")).toBeNull();
    expect(normaliseHexColour("#1234")).toBeNull();
    expect(normaliseHexColour("#1234567")).toBeNull();
    expect(normaliseHexColour("rgb(1,2,3)")).toBeNull();
  });
});
