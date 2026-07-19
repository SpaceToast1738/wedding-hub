import { beforeEach, describe, expect, it, vi } from "vitest";

// v2.7.0: DB-aware bucket wrappers in src/lib/rate-limit.ts. The pure
// decision math is covered in rate-limit.test.ts (no mocks there);
// these tests mock the Prisma client to pin down the v2.7.0 changes:
//
// 1. The opportunistic prune in readBucket must be SCOPED to the
//    calling bucket. Buckets share MagicLinkAttempt but have different
//    windows (send 60min, guess 15min, mcp 5min) — before the fix, a
//    5-minute mcp check's `createdAt < windowStart` deleteMany would
//    wipe verify:/send rows still inside their longer windows.
// 2. The mcp bucket is guess-pattern: checkMcpAuthLimit is read-only
//    (a legitimate client's calls never burn budget); only
//    recordFailedMcpAuth writes, under the "mcp:" identifier prefix.
//
// Mock style mirrors permissions.test.ts: module-level fixtures read
// lazily by the vi.fn callbacks, plus capture arrays for asserting the
// exact where-clauses the module sends to the DB.

let attemptCount = 0;
let oldestAttempt: { createdAt: Date } | null = null;
let countCalls: Array<{ where: { identifier: string; createdAt: { gte: Date } } }> = [];
let deleteManyCalls: Array<{ where: Record<string, unknown> }> = [];
let createCalls: Array<{ data: { identifier: string; ip: string | null } }> = [];

vi.mock("@/lib/db", () => ({
  db: {
    magicLinkAttempt: {
      count: vi.fn(
        async (args: { where: { identifier: string; createdAt: { gte: Date } } }) => {
          countCalls.push(args);
          return attemptCount;
        },
      ),
      findFirst: vi.fn(async (_args: unknown) => oldestAttempt),
      deleteMany: vi.fn(async (args: { where: Record<string, unknown> }) => {
        deleteManyCalls.push(args);
        return { count: 0 };
      }),
      create: vi.fn(async (args: { data: { identifier: string; ip: string | null } }) => {
        createCalls.push(args);
        return {};
      }),
    },
  },
}));

import {
  checkAndRecordAttempt,
  checkGuessLimit,
  checkMcpAuthLimit,
  MCP_AUTH_LIMIT_MAX_PER_IP,
  MCP_AUTH_LIMIT_WINDOW_MS,
  RATE_LIMIT_WINDOW_MS,
  recordFailedMcpAuth,
  VERIFY_LIMIT_WINDOW_MS,
} from "@/lib/rate-limit";

const NOW = new Date("2026-07-19T10:00:00.000Z");

beforeEach(() => {
  attemptCount = 0;
  oldestAttempt = null;
  countCalls = [];
  deleteManyCalls = [];
  createCalls = [];
});

describe("checkMcpAuthLimit — mcp bucket", () => {
  it("prunes ONLY mcp: rows (scoped to its own 5-min window)", async () => {
    await checkMcpAuthLimit("1.2.3.4", NOW);
    expect(deleteManyCalls).toHaveLength(1);
    expect(deleteManyCalls[0]?.where).toEqual({
      identifier: { startsWith: "mcp:" },
      createdAt: { lt: new Date(NOW.getTime() - MCP_AUTH_LIMIT_WINDOW_MS) },
    });
  });

  it("counts under the mcp:-prefixed identifier", async () => {
    await checkMcpAuthLimit("1.2.3.4", NOW);
    expect(countCalls[0]?.where.identifier).toBe("mcp:1.2.3.4");
  });

  it("never creates rows — the pre-check is read-only", async () => {
    // Guess pattern: a legitimate client making many authenticated
    // calls must never touch the failure budget.
    attemptCount = 3;
    await checkMcpAuthLimit("1.2.3.4", NOW);
    expect(createCalls).toHaveLength(0);
  });

  it("blocks at the failure threshold", async () => {
    attemptCount = MCP_AUTH_LIMIT_MAX_PER_IP;
    oldestAttempt = { createdAt: new Date(NOW.getTime() - 60 * 1000) };
    const decision = await checkMcpAuthLimit("1.2.3.4", NOW);
    expect(decision.ok).toBe(false);
  });
});

describe("recordFailedMcpAuth", () => {
  it('writes the failure under identifier "mcp:<ip>"', async () => {
    await recordFailedMcpAuth("1.2.3.4");
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]?.data).toEqual({ identifier: "mcp:1.2.3.4", ip: "1.2.3.4" });
  });
});

describe("checkGuessLimit — verify bucket prune scope", () => {
  it("prunes ONLY verify: rows (scoped to its own 15-min window)", async () => {
    await checkGuessLimit("jamie@example.com", NOW);
    expect(deleteManyCalls).toHaveLength(1);
    expect(deleteManyCalls[0]?.where).toEqual({
      identifier: { startsWith: "verify:" },
      createdAt: { lt: new Date(NOW.getTime() - VERIFY_LIMIT_WINDOW_MS) },
    });
  });
});

describe("checkAndRecordAttempt — send bucket prune scope", () => {
  it("prunes only UNprefixed rows: the NOT clause excludes both prefixed buckets", async () => {
    // The send bucket has no identifier prefix, so its prune scope is
    // "not any prefixed bucket" — a startsWith match doesn't exist for
    // it. Without the NOT clause, the hour-window send prune would
    // still be safe for verify:/mcp: rows (their windows are shorter),
    // but the scoping keeps every bucket strictly self-contained.
    await checkAndRecordAttempt({ identifier: "jamie@example.com", now: NOW });
    expect(deleteManyCalls).toHaveLength(1);
    expect(deleteManyCalls[0]?.where).toEqual({
      NOT: [
        { identifier: { startsWith: "verify:" } },
        { identifier: { startsWith: "mcp:" } },
      ],
      createdAt: { lt: new Date(NOW.getTime() - RATE_LIMIT_WINDOW_MS) },
    });
  });

  it("still records the allowed send attempt (unprefixed, lowercased)", async () => {
    await checkAndRecordAttempt({ identifier: "Jamie@Example.com ", now: NOW });
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]?.data.identifier).toBe("jamie@example.com");
  });
});
