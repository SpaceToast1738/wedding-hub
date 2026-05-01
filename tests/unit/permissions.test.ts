import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Prisma client BEFORE importing the module under test so the
// effective-permissions resolver reads from our stubbed methods.
//
// v1.43.0 widened the surface: the resolver now also fans out to
// `db.user.findUnique` (to hydrate role/isCouple for built-in group
// matching), `db.permissionGroup.findMany` (for custom groups), and
// `db.groupPermission.findMany` (for group-level rules). Tests that
// only touched per-user permissions still set permissionRows; tests
// for group-driven access additionally override groupPermissionRows
// or customGroups.
let permissionRows: Array<{ userId: string; section: string; level: string }> = [];
let groupPermissionRows: Array<{ groupKey: string; section: string; level: string }> = [];
let customGroups: Array<{ slug: string; members: { id: string }[] }> = [];
let userRows: Record<string, { id: string; role: string | null; isCouple: boolean; email: string; firstName: string | null; lastName: string | null; name: string | null }> = {};

vi.mock("@/lib/db", () => ({
  db: {
    permission: {
      findMany: vi.fn(async (_args: unknown) => permissionRows),
    },
    groupPermission: {
      findMany: vi.fn(async (_args: unknown) => groupPermissionRows),
    },
    permissionGroup: {
      findMany: vi.fn(async (_args: unknown) => customGroups),
    },
    user: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => userRows[args.where.id] ?? null),
    },
  },
}));

// React.cache is a request-scoped memoiser. In tests we want each call to
// re-read permissionRows, so we replace it with the identity function.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: <T>(fn: T) => fn };
});

import { canEdit, canView, COUPLE_ONLY_SECTIONS, SECTIONS } from "@/lib/permissions";

const couple = { id: "u_couple", isCouple: true };
const member = { id: "u_member", isCouple: false };

// Stable user-row fixtures so the resolver's findUnique succeeds.
// Role is set to a non-matching string so the WEDDING_PARTY /
// PLANNER built-in groups don't auto-include the member — every
// test that needs a different role calls setMemberRole below.
type UserRowShape = {
  id: string;
  role: string | null;
  isCouple: boolean;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
};
function baseUserRows(): Record<string, UserRowShape> {
  return {
    [couple.id]: {
      id: couple.id,
      role: "COUPLE",
      isCouple: true,
      email: "couple@example.com",
      firstName: null,
      lastName: null,
      name: "Couple",
    },
    [member.id]: {
      id: member.id,
      role: "VIEWER",
      isCouple: false,
      email: "member@example.com",
      firstName: null,
      lastName: null,
      name: "Member",
    },
  };
}
// Replace the member's row with one carrying a different role.
// Constructed fully (no spread of an `unknown | undefined` index
// access) to keep `noUncheckedIndexedAccess` happy.
function setMemberRole(role: string): void {
  userRows[member.id] = {
    id: member.id,
    role,
    isCouple: false,
    email: "member@example.com",
    firstName: null,
    lastName: null,
    name: "Member",
  };
}

beforeEach(() => {
  permissionRows = [];
  groupPermissionRows = [];
  customGroups = [];
  userRows = baseUserRows();
});

describe("canView", () => {
  it("returns true for couple-tier on every section", async () => {
    for (const section of SECTIONS) {
      expect(await canView(couple, section)).toBe(true);
    }
  });

  it("returns false for non-couple on couple-only sections regardless of Permission row", async () => {
    permissionRows = COUPLE_ONLY_SECTIONS.map((s) => ({
      userId: member.id,
      section: s,
      level: "EDIT",
    }));
    for (const section of COUPLE_ONLY_SECTIONS) {
      expect(await canView(member, section)).toBe(false);
    }
  });

  it("returns false for non-couple with NONE permission", async () => {
    permissionRows = [{ userId: member.id, section: "tasks", level: "NONE" }];
    expect(await canView(member, "tasks")).toBe(false);
  });

  it("returns true for non-couple with VIEW permission", async () => {
    permissionRows = [{ userId: member.id, section: "guests", level: "VIEW" }];
    expect(await canView(member, "guests")).toBe(true);
  });

  it("returns true for non-couple with EDIT permission", async () => {
    permissionRows = [{ userId: member.id, section: "guests", level: "EDIT" }];
    expect(await canView(member, "guests")).toBe(true);
  });

  it("defaults to NONE (deny) when no Permission row exists", async () => {
    permissionRows = [];
    expect(await canView(member, "tasks")).toBe(false);
  });
});

describe("canEdit", () => {
  it("returns true for couple-tier on every section", async () => {
    for (const section of SECTIONS) {
      expect(await canEdit(couple, section)).toBe(true);
    }
  });

  it("returns false for non-couple on couple-only sections", async () => {
    permissionRows = [{ userId: member.id, section: "budget", level: "EDIT" }];
    expect(await canEdit(member, "budget")).toBe(false);
    expect(await canEdit(member, "payments")).toBe(false);
  });

  it("returns false for non-couple with VIEW (not EDIT) permission", async () => {
    permissionRows = [{ userId: member.id, section: "guests", level: "VIEW" }];
    expect(await canEdit(member, "guests")).toBe(false);
  });

  it("returns true for non-couple with EDIT permission", async () => {
    permissionRows = [{ userId: member.id, section: "guests", level: "EDIT" }];
    expect(await canEdit(member, "guests")).toBe(true);
  });

  it("returns false for non-couple with NONE permission", async () => {
    permissionRows = [{ userId: member.id, section: "tasks", level: "NONE" }];
    expect(await canEdit(member, "tasks")).toBe(false);
  });

  it("defaults to NONE (deny) when no Permission row exists", async () => {
    permissionRows = [];
    expect(await canEdit(member, "tasks")).toBe(false);
  });
});

// These tests reproduce the audit's F1 escalation vector — a non-couple
// user with NONE on a section should NOT be able to read its list. Page-
// level redirects added in v1.2.0 enforce this; the unit tests here cover
// the underlying canView contract that those page redirects rely on.
describe("F1 — list-page canView gate substrate", () => {
  it("non-couple + NONE on tasks → canView(tasks) is false", async () => {
    permissionRows = [{ userId: member.id, section: "tasks", level: "NONE" }];
    expect(await canView(member, "tasks")).toBe(false);
  });

  it("non-couple + NONE on questions → canView(questions) is false", async () => {
    permissionRows = [{ userId: member.id, section: "questions", level: "NONE" }];
    expect(await canView(member, "questions")).toBe(false);
  });

  it("non-couple + NONE on book → canView(book) is false", async () => {
    permissionRows = [{ userId: member.id, section: "book", level: "NONE" }];
    expect(await canView(member, "book")).toBe(false);
  });

  it("non-couple + NONE on guests → canView(guests) is false", async () => {
    permissionRows = [{ userId: member.id, section: "guests", level: "NONE" }];
    expect(await canView(member, "guests")).toBe(false);
  });
});

// v1.43.0: group-driven inheritance. A user with no per-user override
// but membership in a group that has a permission row should resolve
// to the group's level. Override + group should resolve to max.
describe("v1.43.0 — group-driven inheritance", () => {
  it("inherits VIEW from a built-in group when no override exists", async () => {
    // Member is WEDDING_PARTY → in builtin:wedding-party-role.
    userRows = baseUserRows();
    setMemberRole("WEDDING_PARTY");
    groupPermissionRows = [
      { groupKey: "builtin:wedding-party-role", section: "schedule", level: "VIEW" },
    ];
    expect(await canView(member, "schedule")).toBe(true);
    expect(await canEdit(member, "schedule")).toBe(false);
  });

  it("inherits EDIT from a custom group the user belongs to", async () => {
    customGroups = [
      { slug: "after-party", members: [{ id: member.id }] },
    ];
    groupPermissionRows = [
      { groupKey: "group:after-party", section: "songs", level: "EDIT" },
    ];
    expect(await canEdit(member, "songs")).toBe(true);
  });

  it("does not leak permissions from groups the user isn't in", async () => {
    customGroups = [
      { slug: "after-party", members: [{ id: "someone-else" }] },
    ];
    groupPermissionRows = [
      { groupKey: "group:after-party", section: "songs", level: "EDIT" },
    ];
    expect(await canView(member, "songs")).toBe(false);
  });

  it("override stronger than group wins (max)", async () => {
    userRows = baseUserRows();
    setMemberRole("WEDDING_PARTY");
    groupPermissionRows = [
      { groupKey: "builtin:wedding-party-role", section: "tasks", level: "VIEW" },
    ];
    permissionRows = [{ userId: member.id, section: "tasks", level: "EDIT" }];
    expect(await canEdit(member, "tasks")).toBe(true);
  });

  it("override of NONE never lowers a stronger inherited group level", async () => {
    userRows = baseUserRows();
    setMemberRole("WEDDING_PARTY");
    groupPermissionRows = [
      { groupKey: "builtin:wedding-party-role", section: "tasks", level: "VIEW" },
    ];
    permissionRows = [{ userId: member.id, section: "tasks", level: "NONE" }];
    // Group grants VIEW, override of NONE shouldn't strip it.
    expect(await canView(member, "tasks")).toBe(true);
  });

  it("couple-only sections deny non-couple even with group EDIT", async () => {
    userRows = baseUserRows();
    setMemberRole("PLANNER");
    groupPermissionRows = [
      { groupKey: "builtin:planners-role", section: "budget", level: "EDIT" },
    ];
    expect(await canView(member, "budget")).toBe(false);
    expect(await canEdit(member, "budget")).toBe(false);
  });

  it("max across multiple groups — user in two groups picks the strongest", async () => {
    userRows = baseUserRows();
    setMemberRole("WEDDING_PARTY");
    customGroups = [
      { slug: "vip", members: [{ id: member.id }] },
    ];
    groupPermissionRows = [
      { groupKey: "builtin:wedding-party-role", section: "book", level: "VIEW" },
      { groupKey: "group:vip", section: "book", level: "EDIT" },
    ];
    expect(await canEdit(member, "book")).toBe(true);
  });
});
