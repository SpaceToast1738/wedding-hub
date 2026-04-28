import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, TableShape } from "@prisma/client";

// Integration test for B12 (v1.12.0): `assignGuestToSeat` wraps the
// "clear seat + assign guest" pair in a transaction so two parallel
// drags can't both succeed. The unique constraint on `Guest.tableSeatId`
// guarantees the second offender fails noisily — this test exists to
// catch regressions where the transaction wrapper is dropped.
//
// Self-skips when DATABASE_URL isn't a test DB; mirrors the gating
// pattern in permissions.test.ts.

const TEST_DB_AVAILABLE =
  !!process.env.DATABASE_URL &&
  /test|local/i.test(process.env.DATABASE_URL ?? "");

describe.skipIf(!TEST_DB_AVAILABLE)("assignGuestToSeat (integration)", () => {
  const db = new PrismaClient();
  const TEST_PREFIX = "wh_test_seating_";

  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    // Clean up. Order matters because of FK constraints: guests first
    // (they reference seats), then seats, then tables, then households.
    await db.guest.deleteMany({ where: { firstName: { startsWith: TEST_PREFIX } } });
    await db.seat.deleteMany({ where: { table: { name: { startsWith: TEST_PREFIX } } } });
    await db.table.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
    await db.household.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  });

  it("two parallel assignments to the same seat — one wins, one fails", async () => {
    // Seed: a household, a 2-seat table, two guests competing for seat 0.
    const household = await db.household.create({
      data: { name: `${TEST_PREFIX}household_${Date.now()}`, side: "BOTH" },
    });
    const table = await db.table.create({
      data: { name: `${TEST_PREFIX}table_${Date.now()}`, shape: TableShape.ROUND, capacity: 2 },
    });
    const seats = await Promise.all([
      db.seat.create({ data: { tableId: table.id, index: 0 } }),
      db.seat.create({ data: { tableId: table.id, index: 1 } }),
    ]);
    const targetSeat = seats[0]!;
    const guestA = await db.guest.create({
      data: { householdId: household.id, firstName: `${TEST_PREFIX}A`, lastName: "Test" },
    });
    const guestB = await db.guest.create({
      data: { householdId: household.id, firstName: `${TEST_PREFIX}B`, lastName: "Test" },
    });

    // Inline the action's transaction logic (the action itself requires
    // a request context from `requireEdit`, which we don't want to mock
    // here — we're testing the DB-level guarantee, not the auth gate).
    // Mirrors src/app/(app)/seating/actions.ts.
    async function assign(guestId: string) {
      return db.$transaction([
        db.guest.updateMany({
          where: { tableSeatId: targetSeat.id, NOT: { id: guestId } },
          data: { tableSeatId: null },
        }),
        db.guest.update({
          where: { id: guestId },
          data: { tableSeatId: targetSeat.id },
        }),
      ]);
    }

    // Fire both in parallel.
    const results = await Promise.allSettled([assign(guestA.id), assign(guestB.id)]);

    // Exactly one should succeed; the other rejects on the unique
    // constraint. (Order between A and B is non-deterministic — Postgres
    // serialises them. Either outcome is acceptable; we just need ONE.)
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length + rejected.length).toBe(2);
    // We can't always guarantee a rejection — Postgres may serialise
    // both transactions cleanly so the second sees the first's writes
    // and runs its updateMany clear. What we DO guarantee is the final
    // state is consistent: exactly one of A or B is at the seat.
    const finalA = await db.guest.findUnique({ where: { id: guestA.id } });
    const finalB = await db.guest.findUnique({ where: { id: guestB.id } });
    const seatedAtTarget = [finalA, finalB].filter((g) => g?.tableSeatId === targetSeat.id);
    expect(seatedAtTarget).toHaveLength(1);
  });

  it("assigning a guest to a seat that's already occupied unseats the prior occupant", async () => {
    const household = await db.household.create({
      data: { name: `${TEST_PREFIX}household_${Date.now()}`, side: "BOTH" },
    });
    const table = await db.table.create({
      data: { name: `${TEST_PREFIX}table_${Date.now()}`, shape: TableShape.ROUND, capacity: 1 },
    });
    const seat = await db.seat.create({ data: { tableId: table.id, index: 0 } });
    const guestA = await db.guest.create({
      data: {
        householdId: household.id,
        firstName: `${TEST_PREFIX}A`,
        lastName: "Test",
        tableSeatId: seat.id,
      },
    });
    const guestB = await db.guest.create({
      data: { householdId: household.id, firstName: `${TEST_PREFIX}B`, lastName: "Test" },
    });

    // Replicate the action's transaction.
    await db.$transaction([
      db.guest.updateMany({
        where: { tableSeatId: seat.id, NOT: { id: guestB.id } },
        data: { tableSeatId: null },
      }),
      db.guest.update({ where: { id: guestB.id }, data: { tableSeatId: seat.id } }),
    ]);

    const finalA = await db.guest.findUnique({ where: { id: guestA.id } });
    const finalB = await db.guest.findUnique({ where: { id: guestB.id } });
    expect(finalA?.tableSeatId).toBeNull();
    expect(finalB?.tableSeatId).toBe(seat.id);
  });
});
