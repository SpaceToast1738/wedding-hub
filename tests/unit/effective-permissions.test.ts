// v1.43.0: pure-decision tests for the group-driven permissions
// resolver. Covers max-level reduction, override stacking, built-in
// vs custom group keying, and the couple short-circuit (verified at
// the SECTIONS-list level — the canView/canEdit DB callers wrap this
// with `if (user.isCouple) return true`).

import { describe, expect, it } from "vitest";
import {
  groupKeysForUser,
  maxLevel,
  mergeOverrides,
  reduceGroupPermissions,
} from "@/lib/permissions";
import { PermissionLevel } from "@prisma/client";

const NONE = PermissionLevel.NONE;
const VIEW = PermissionLevel.VIEW;
const EDIT = PermissionLevel.EDIT;

describe("maxLevel", () => {
  it("ranks NONE < VIEW < EDIT", () => {
    expect(maxLevel(NONE, VIEW)).toBe(VIEW);
    expect(maxLevel(VIEW, EDIT)).toBe(EDIT);
    expect(maxLevel(NONE, EDIT)).toBe(EDIT);
  });

  it("is symmetric", () => {
    expect(maxLevel(VIEW, NONE)).toBe(maxLevel(NONE, VIEW));
    expect(maxLevel(EDIT, VIEW)).toBe(maxLevel(VIEW, EDIT));
  });

  it("returns the same level when both equal", () => {
    expect(maxLevel(VIEW, VIEW)).toBe(VIEW);
    expect(maxLevel(EDIT, EDIT)).toBe(EDIT);
    expect(maxLevel(NONE, NONE)).toBe(NONE);
  });
});

describe("groupKeysForUser", () => {
  const baseUser = {
    id: "u1",
    email: "u1@example.com",
    role: "WEDDING_PARTY",
    isCouple: false,
  };

  it("includes built-in 'everyone' for any user", () => {
    const keys = groupKeysForUser(baseUser, []);
    expect(keys).toContain("builtin:everyone");
  });

  it("includes 'wedding-party-role' for WEDDING_PARTY users", () => {
    const keys = groupKeysForUser(baseUser, []);
    expect(keys).toContain("builtin:wedding-party-role");
    expect(keys).not.toContain("builtin:planners-role");
    expect(keys).not.toContain("builtin:couple");
  });

  it("includes 'planners-role' for PLANNER users", () => {
    const keys = groupKeysForUser(
      { ...baseUser, role: "PLANNER" },
      [],
    );
    expect(keys).toContain("builtin:planners-role");
    expect(keys).not.toContain("builtin:wedding-party-role");
  });

  it("includes 'couple' when isCouple === true", () => {
    const keys = groupKeysForUser(
      { ...baseUser, isCouple: true, role: "COUPLE" },
      [],
    );
    expect(keys).toContain("builtin:couple");
    expect(keys).toContain("builtin:everyone");
  });

  it("includes custom groups the user is a member of", () => {
    const keys = groupKeysForUser(baseUser, [
      { slug: "after-party", members: [{ id: "u1" }, { id: "u2" }] },
      { slug: "wine-tasting", members: [{ id: "u2" }] },
    ]);
    expect(keys).toContain("group:after-party");
    expect(keys).not.toContain("group:wine-tasting");
  });

  it("excludes custom groups the user is not in", () => {
    const keys = groupKeysForUser(baseUser, [
      { slug: "ceremony-only", members: [{ id: "u99" }] },
    ]);
    expect(keys).not.toContain("group:ceremony-only");
  });

  it("returns built-in keys in the canonical declaration order", () => {
    // Couple + everyone + wedding-party should appear in the order
    // they're declared in BUILTIN_GROUPS, not whatever Postgres
    // happens to return.
    const keys = groupKeysForUser(
      { ...baseUser, isCouple: true, role: "WEDDING_PARTY" },
      [],
    );
    const everyoneIdx = keys.indexOf("builtin:everyone");
    const coupleIdx = keys.indexOf("builtin:couple");
    const wpIdx = keys.indexOf("builtin:wedding-party-role");
    expect(everyoneIdx).toBeLessThan(coupleIdx);
    expect(coupleIdx).toBeLessThan(wpIdx);
  });
});

describe("reduceGroupPermissions", () => {
  it("returns empty map when no groupKeys", () => {
    const out = reduceGroupPermissions([], [
      { groupKey: "builtin:everyone", section: "tasks", level: VIEW },
    ]);
    expect(out.size).toBe(0);
  });

  it("returns empty map when no rows", () => {
    const out = reduceGroupPermissions(["builtin:everyone"], []);
    expect(out.size).toBe(0);
  });

  it("includes only rows whose groupKey is in the keep set", () => {
    const out = reduceGroupPermissions(
      ["builtin:everyone", "group:after-party"],
      [
        { groupKey: "builtin:everyone", section: "tasks", level: VIEW },
        { groupKey: "builtin:planners-role", section: "tasks", level: EDIT },
        { groupKey: "group:after-party", section: "songs", level: EDIT },
      ],
    );
    expect(out.get("tasks")).toBe(VIEW);
    expect(out.get("songs")).toBe(EDIT);
    expect(out.size).toBe(2);
  });

  it("takes max across multiple groups for the same section", () => {
    // User is in everyone (VIEW on tasks) AND planners (EDIT on tasks).
    // Effective: EDIT.
    const out = reduceGroupPermissions(
      ["builtin:everyone", "builtin:planners-role"],
      [
        { groupKey: "builtin:everyone", section: "tasks", level: VIEW },
        { groupKey: "builtin:planners-role", section: "tasks", level: EDIT },
      ],
    );
    expect(out.get("tasks")).toBe(EDIT);
  });

  it("never lowers a level — higher always wins regardless of order", () => {
    // Same scenario but rows reversed. Should still pick EDIT.
    const out = reduceGroupPermissions(
      ["builtin:everyone", "builtin:planners-role"],
      [
        { groupKey: "builtin:planners-role", section: "tasks", level: EDIT },
        { groupKey: "builtin:everyone", section: "tasks", level: VIEW },
      ],
    );
    expect(out.get("tasks")).toBe(EDIT);
  });

  it("treats NONE rows as literal NONE (not absent)", () => {
    // A group-permission row of NONE shouldn't override an existing
    // VIEW from a different group — and shouldn't get stored alone
    // as anything stronger than NONE.
    const out = reduceGroupPermissions(
      ["builtin:everyone", "builtin:planners-role"],
      [
        { groupKey: "builtin:everyone", section: "tasks", level: VIEW },
        { groupKey: "builtin:planners-role", section: "tasks", level: NONE },
      ],
    );
    expect(out.get("tasks")).toBe(VIEW);
  });
});

describe("mergeOverrides", () => {
  it("returns the group map unchanged when no overrides", () => {
    const groupMap = new Map([["tasks", VIEW], ["songs", EDIT]]);
    const out = mergeOverrides(groupMap, []);
    expect(out.get("tasks")).toBe(VIEW);
    expect(out.get("songs")).toBe(EDIT);
    expect(out.size).toBe(2);
  });

  it("adds override entries for sections the group map didn't cover", () => {
    const groupMap = new Map([["tasks", VIEW]]);
    const out = mergeOverrides(groupMap, [
      { section: "budget", level: EDIT },
    ]);
    expect(out.get("budget")).toBe(EDIT);
    expect(out.get("tasks")).toBe(VIEW);
  });

  it("takes max(group, override) — override stronger wins", () => {
    const groupMap = new Map([["tasks", VIEW]]);
    const out = mergeOverrides(groupMap, [
      { section: "tasks", level: EDIT },
    ]);
    expect(out.get("tasks")).toBe(EDIT);
  });

  it("takes max(group, override) — group stronger wins", () => {
    const groupMap = new Map([["tasks", EDIT]]);
    const out = mergeOverrides(groupMap, [
      { section: "tasks", level: VIEW },
    ]);
    // Override of VIEW shouldn't strip EDIT inherited from the group.
    expect(out.get("tasks")).toBe(EDIT);
  });

  it("override of NONE never lowers an inherited group level", () => {
    // Critical correctness: removing an override row should never
    // strip a permission the group actually grants.
    const groupMap = new Map([["tasks", EDIT]]);
    const out = mergeOverrides(groupMap, [
      { section: "tasks", level: NONE },
    ]);
    expect(out.get("tasks")).toBe(EDIT);
  });
});
