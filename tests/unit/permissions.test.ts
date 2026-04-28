import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Prisma client BEFORE importing the module under test so that
// loadPermissions reads from our stubbed findMany. We control the rows it
// returns per-test via permissionRows.
let permissionRows: Array<{ userId: string; section: string; level: string }> = [];

vi.mock("@/lib/db", () => ({
  db: {
    permission: {
      findMany: vi.fn(async (_args: unknown) => permissionRows),
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

beforeEach(() => {
  permissionRows = [];
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
