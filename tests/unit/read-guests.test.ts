// v2.13.4: read_guests pagination. The bug: `offset` and `query` were
// accepted and silently stripped (zod's default drops unknown keys), so
// the full guest list could never be paged past the 24k result cap —
// the tail of the alphabet was unreachable. Now: real offset paging on
// the read_tasks contract, `query` as an alias of nameContains, and a
// strict schema so an unknown key is an error that names it.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/actions";

const guestFindMany = vi.fn<(args: FindManyArgs) => Promise<unknown[]>>(async () => []);
const guestCount = vi.fn<(args: { where: Record<string, unknown> }) => Promise<number>>(async () => 48);
const guestGroupBy = vi.fn(async () => [{ rsvp: "ATTENDING", _count: { _all: 48 } }]);
const fieldFindMany = vi.fn(async () => []);

vi.mock("@/lib/db", () => ({
  db: {
    guest: { findMany: guestFindMany, count: guestCount, groupBy: guestGroupBy },
    customField: { findMany: fieldFindMany },
  },
}));
// React.cache shim — permissions helpers ride the registry import graph.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

const { readGuests } = await import("@/lib/ai/tools/read-guests");

const COUPLE: SessionUser = {
  id: "u_couple",
  email: "u@example.com",
  name: null,
  isCouple: true,
  role: "COUPLE",
};
// Only `user` is read by this tool; the rest of ToolContext is irrelevant here.
const ctx = { user: COUPLE } as unknown as Parameters<typeof readGuests.handler>[1];

type FindManyArgs = {
  where: Record<string, unknown>;
  skip: number;
  take: number;
  orderBy: Array<Record<string, string>>;
};

beforeEach(() => vi.clearAllMocks());

describe("read_guests input", () => {
  it("accepts offset and query", () => {
    expect(readGuests.inputSchema.safeParse({ offset: 27, query: "Spencer" }).success).toBe(true);
  });

  it("rejects an unknown key and names it", () => {
    const r = readGuests.inputSchema.safeParse({ page: 2 });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.message).toContain("page");
  });
});

describe("read_guests paging", () => {
  it("passes offset/limit through as skip/take with a stable id tiebreaker", async () => {
    await readGuests.handler({ offset: 20, limit: 10 }, ctx);
    const args = guestFindMany.mock.calls[0]![0] as FindManyArgs;
    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
    expect(args.orderBy.at(-1)).toEqual({ id: "asc" });
  });

  it("reports page.total from a count on the SAME filter and computes nextOffset", async () => {
    const result = await readGuests.handler({ offset: 20, limit: 10, side: "GROOM" }, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const countArgs = guestCount.mock.calls[0]![0] as { where: Record<string, unknown> };
    const findArgs = guestFindMany.mock.calls[0]![0] as FindManyArgs;
    expect(countArgs.where).toEqual(findArgs.where);
    expect(countArgs.where.side).toBe("GROOM");
    expect((result.data as { page: unknown }).page).toEqual({
      offset: 20,
      limit: 10,
      total: 48,
      nextOffset: 30,
    });
  });

  it("ends the chain with nextOffset null on the last page", async () => {
    const result = await readGuests.handler({ offset: 40, limit: 10 }, ctx);
    if (!result.ok) throw new Error("expected ok");
    expect((result.data as { page: { nextOffset: number | null } }).page.nextOffset).toBeNull();
  });

  it("defaults to the first 20", async () => {
    await readGuests.handler({}, ctx);
    const args = guestFindMany.mock.calls[0]![0] as FindManyArgs;
    expect(args.skip).toBe(0);
    expect(args.take).toBe(20);
  });
});

describe("read_guests query alias", () => {
  it("`query` filters by first OR last name, like nameContains", async () => {
    await readGuests.handler({ query: "Spencer" }, ctx);
    const args = guestFindMany.mock.calls[0]![0] as FindManyArgs;
    expect(args.where.OR).toEqual([
      { firstName: { contains: "Spencer", mode: "insensitive" } },
      { lastName: { contains: "Spencer", mode: "insensitive" } },
    ]);
  });

  it("nameContains wins when both are given", async () => {
    await readGuests.handler({ query: "Spencer", nameContains: "Scott" }, ctx);
    const args = guestFindMany.mock.calls[0]![0] as FindManyArgs;
    expect(JSON.stringify(args.where.OR)).toContain("Scott");
    expect(JSON.stringify(args.where.OR)).not.toContain("Spencer");
  });
});
