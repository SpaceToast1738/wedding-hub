import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, PermissionLevel } from "@prisma/client";
import { canEdit, canView } from "@/lib/permissions";

// Integration tests for the permission resolver against a real Postgres.
// These complement the unit tests at tests/unit/permissions.test.ts
// (which mock Prisma) by exercising the full path: real Permission
// rows, real findMany, real React.cache wrapper. The unit tests catch
// logic bugs; these catch integration bugs (e.g. enum drift between
// schema and code, query semantics, cache staleness).
//
// Self-skips when DATABASE_URL isn't set so it's safe to run on a
// dev machine without a test DB. CI runs against a Postgres service
// container — see .github/workflows/build.yml (T2 in REMEDIATION-PLAN).
//
// Each test seeds + tears down its own data. We never `db.user.deleteMany({})`
// without a where-clause filter — that would nuke real data if someone
// accidentally pointed DATABASE_URL at production.

const TEST_DB_AVAILABLE =
  !!process.env.DATABASE_URL &&
  // Soft check: refuse to run against a DB whose URL doesn't look "test"-y.
  // The CI workflow uses ...wedding_hub_test; document this in TESTING.md.
  /test|local/i.test(process.env.DATABASE_URL ?? "");

// describe.skipIf is the right Vitest pattern for "skip the whole block".
describe.skipIf(!TEST_DB_AVAILABLE)("permissions (integration)", () => {
  const db = new PrismaClient();
  const TEST_USER_PREFIX = "wh_test_user_";

  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any leftover test users from prior runs. Filter by the
    // prefix to avoid touching real data.
    await db.permission.deleteMany({
      where: { userId: { startsWith: TEST_USER_PREFIX } },
    });
    await db.user.deleteMany({
      where: { id: { startsWith: TEST_USER_PREFIX } },
    });
  });

  it("non-couple user with EDIT permission gets canView=true and canEdit=true", async () => {
    const user = await db.user.create({
      data: {
        id: `${TEST_USER_PREFIX}edit_${Date.now()}`,
        email: `${TEST_USER_PREFIX}edit_${Date.now()}@example.com`,
        isCouple: false,
        role: "WEDDING_PARTY",
      },
    });
    await db.permission.create({
      data: { userId: user.id, section: "tasks", level: PermissionLevel.EDIT },
    });

    expect(await canView({ id: user.id, isCouple: false }, "tasks")).toBe(true);
    expect(await canEdit({ id: user.id, isCouple: false }, "tasks")).toBe(true);
  });

  it("non-couple user with NONE permission gets canView=false (F1 substrate)", async () => {
    const user = await db.user.create({
      data: {
        id: `${TEST_USER_PREFIX}none_${Date.now()}`,
        email: `${TEST_USER_PREFIX}none_${Date.now()}@example.com`,
        isCouple: false,
        role: "VIEWER",
      },
    });
    await db.permission.create({
      data: { userId: user.id, section: "guests", level: PermissionLevel.NONE },
    });

    expect(await canView({ id: user.id, isCouple: false }, "guests")).toBe(false);
    expect(await canEdit({ id: user.id, isCouple: false }, "guests")).toBe(false);
  });

  it("non-couple user without any Permission row defaults to NONE", async () => {
    const user = await db.user.create({
      data: {
        id: `${TEST_USER_PREFIX}orphan_${Date.now()}`,
        email: `${TEST_USER_PREFIX}orphan_${Date.now()}@example.com`,
        isCouple: false,
        role: "VIEWER",
      },
    });
    // Deliberately no Permission rows.
    expect(await canView({ id: user.id, isCouple: false }, "tasks")).toBe(false);
  });

  it("non-couple is denied couple-only sections regardless of Permission row", async () => {
    const user = await db.user.create({
      data: {
        id: `${TEST_USER_PREFIX}fakecouple_${Date.now()}`,
        email: `${TEST_USER_PREFIX}fakecouple_${Date.now()}@example.com`,
        isCouple: false,
        role: "WEDDING_PARTY",
      },
    });
    await db.permission.create({
      data: { userId: user.id, section: "budget", level: PermissionLevel.EDIT },
    });

    expect(await canView({ id: user.id, isCouple: false }, "budget")).toBe(false);
    expect(await canEdit({ id: user.id, isCouple: false }, "budget")).toBe(false);
    expect(await canView({ id: user.id, isCouple: false }, "payments")).toBe(false);
  });

  it("couple-tier user passes everywhere without any Permission row", async () => {
    const user = await db.user.create({
      data: {
        id: `${TEST_USER_PREFIX}couple_${Date.now()}`,
        email: `${TEST_USER_PREFIX}couple_${Date.now()}@example.com`,
        isCouple: true,
        role: "COUPLE",
      },
    });

    for (const section of [
      "tasks",
      "questions",
      "schedule",
      "suppliers",
      "guests",
      "seating",
      "songs",
      "files",
      "book",
      "budget",
      "payments",
      "settings",
    ] as const) {
      expect(await canView({ id: user.id, isCouple: true }, section)).toBe(true);
      expect(await canEdit({ id: user.id, isCouple: true }, section)).toBe(true);
    }
  });
});
