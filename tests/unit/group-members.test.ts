import { describe, expect, it } from "vitest";
import {
  BUILTIN_GROUPS,
  BUILTIN_GROUP_SLUGS,
  displayName,
  groupsForUser,
  resolveBuiltinGroup,
  resolveGroupMembers,
  resolveGroupMembersUnion,
} from "@/lib/group-members";

const USERS = [
  { id: "u1", email: "bryony@example.com", firstName: "Bryony", lastName: "Olwyn-Davis", role: "COUPLE", isCouple: true },
  { id: "u2", email: "jamie@example.com", firstName: "Jamie", lastName: "Spencer", role: "COUPLE", isCouple: true },
  { id: "u3", email: "aimee@example.com", firstName: "Aimee", lastName: "Hollingsworth", role: "WEDDING_PARTY", isCouple: false },
  { id: "u4", email: "josh@example.com", firstName: "Joshua", lastName: "Dickson", role: "WEDDING_PARTY", isCouple: false },
  { id: "u5", email: "planner@example.com", firstName: "P", lastName: "Lanner", role: "PLANNER", isCouple: false },
  { id: "u6", email: "viewer@example.com", role: "VIEWER", isCouple: false },
];

const CUSTOM_GROUPS = [
  {
    id: "g1",
    slug: "bryonys-bridesmaids",
    name: "Bryony's bridesmaids",
    members: [{ id: "u3" }],
  },
  {
    id: "g2",
    slug: "after-party",
    name: "After-party",
    members: [{ id: "u1" }, { id: "u2" }, { id: "u3" }, { id: "u4" }],
  },
];

describe("displayName", () => {
  it("prefers firstName + lastName", () => {
    expect(displayName(USERS[0]!)).toBe("Bryony Olwyn-Davis");
  });

  it("falls back to .name", () => {
    expect(displayName({ id: "x", email: "x@y", name: "Solo" })).toBe("Solo");
  });

  it("falls back to email", () => {
    expect(displayName(USERS[5]!)).toBe("viewer@example.com");
  });
});

describe("BUILTIN_GROUPS", () => {
  it("lists exactly four entries", () => {
    expect(BUILTIN_GROUPS).toHaveLength(4);
  });

  it("has unique slugs", () => {
    const slugs = BUILTIN_GROUPS.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("BUILTIN_GROUP_SLUGS contains all the slug strings", () => {
    for (const g of BUILTIN_GROUPS) {
      expect(BUILTIN_GROUP_SLUGS.has(g.slug)).toBe(true);
    }
  });
});

describe("resolveBuiltinGroup", () => {
  it("everyone returns all users", () => {
    expect(resolveBuiltinGroup("everyone", USERS)).toHaveLength(USERS.length);
  });

  it("couple returns only isCouple=true", () => {
    const r = resolveBuiltinGroup("couple", USERS);
    expect(r.map((u) => u.id).sort()).toEqual(["u1", "u2"]);
  });

  it("wedding-party-role returns only role=WEDDING_PARTY", () => {
    const r = resolveBuiltinGroup("wedding-party-role", USERS);
    expect(r.map((u) => u.id).sort()).toEqual(["u3", "u4"]);
  });

  it("planners-role returns only role=PLANNER", () => {
    const r = resolveBuiltinGroup("planners-role", USERS);
    expect(r.map((u) => u.id)).toEqual(["u5"]);
  });

  it("throws on unknown slug", () => {
    expect(() => resolveBuiltinGroup("nonsense", USERS)).toThrow(/Unknown built-in/);
  });
});

describe("resolveGroupMembers", () => {
  it("resolves builtin:* references", () => {
    expect(resolveGroupMembers("builtin:couple", USERS, CUSTOM_GROUPS).map((u) => u.id).sort()).toEqual(["u1", "u2"]);
  });

  it("returns empty for unknown builtin slug", () => {
    expect(resolveGroupMembers("builtin:bogus", USERS, CUSTOM_GROUPS)).toEqual([]);
  });

  it("resolves group:<slug> references", () => {
    expect(resolveGroupMembers("group:bryonys-bridesmaids", USERS, CUSTOM_GROUPS).map((u) => u.id)).toEqual(["u3"]);
  });

  it("returns empty for unknown custom group slug", () => {
    expect(resolveGroupMembers("group:no-such", USERS, CUSTOM_GROUPS)).toEqual([]);
  });

  it("returns empty for malformed reference", () => {
    expect(resolveGroupMembers("u3", USERS, CUSTOM_GROUPS)).toEqual([]);
  });

  it("filters custom group members against the user list", () => {
    // Only USERS contains u1..u6; if custom group references a user
    // not in the user list (e.g. archived), they're skipped.
    const customWithMissing = [
      {
        id: "g3",
        slug: "missing",
        name: "Has missing user",
        members: [{ id: "u1" }, { id: "u-archived" }],
      },
    ];
    expect(resolveGroupMembers("group:missing", USERS, customWithMissing).map((u) => u.id)).toEqual(["u1"]);
  });
});

describe("resolveGroupMembersUnion", () => {
  it("deduplicates across multiple group refs", () => {
    const refs = ["builtin:couple", "group:after-party"];
    const r = resolveGroupMembersUnion(refs, USERS, CUSTOM_GROUPS);
    expect(r.map((u) => u.id)).toEqual(["u1", "u2", "u3", "u4"]);
  });

  it("preserves first-seen order across refs", () => {
    const refs = ["builtin:planners-role", "builtin:couple"];
    const r = resolveGroupMembersUnion(refs, USERS, CUSTOM_GROUPS);
    expect(r.map((u) => u.id)).toEqual(["u5", "u1", "u2"]);
  });

  it("returns empty for empty refs", () => {
    expect(resolveGroupMembersUnion([], USERS, CUSTOM_GROUPS)).toEqual([]);
  });
});

describe("groupsForUser", () => {
  it("returns built-ins + custom for a couple member", () => {
    const r = groupsForUser("u1", USERS, CUSTOM_GROUPS);
    expect(r).toContain("builtin:everyone");
    expect(r).toContain("builtin:couple");
    expect(r).toContain("group:after-party");
    expect(r).not.toContain("builtin:wedding-party-role");
    expect(r).not.toContain("builtin:planners-role");
  });

  it("returns only everyone + custom for a non-role / non-couple user", () => {
    const r = groupsForUser("u6", USERS, CUSTOM_GROUPS);
    expect(r).toEqual(["builtin:everyone"]);
  });

  it("returns empty for an unknown user id", () => {
    expect(groupsForUser("u-nope", USERS, CUSTOM_GROUPS)).toEqual([]);
  });

  it("returns custom-group memberships in declaration order", () => {
    const r = groupsForUser("u3", USERS, CUSTOM_GROUPS);
    const customRefs = r.filter((s) => s.startsWith("group:"));
    expect(customRefs).toEqual(["group:bryonys-bridesmaids", "group:after-party"]);
  });
});
