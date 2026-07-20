import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// v2.7.0: MCP bearer-token auth. The module is deliberately react-free
// (permission gates live in the route), so — unlike permissions.test.ts —
// only the Prisma client needs mocking here.
//
// Mock style mirrors permissions.test.ts: module-level fixture data that
// the vi.fn callbacks read lazily (the hoisted factory must not touch
// the fixtures at import time), plus capture arrays so tests can assert
// what the module actually asked the DB for.

type McpTokenRow = {
  id: string;
  tokenHash: string;
  label: string;
  userId: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  // v2.8.0: per-token apply rights, passed through to the caller.
  canApply: boolean;
  // v2.9.0: per-token dismiss-own rights, likewise passed through.
  canDismissOwn: boolean;
  // v2.9.2: per-token "may propose a nudge send" rights.
  canProposeSend: boolean;
  user: {
    id: string;
    email: string;
    name: string | null;
    isCouple: boolean;
    role: string;
  };
};

let tokenRows: McpTokenRow[] = [];
let findUniqueCalls: Array<{ where: { tokenHash: string } }> = [];
let updateCalls: Array<{ where: { id: string }; data: { lastUsedAt: Date } }> = [];

vi.mock("@/lib/db", () => ({
  db: {
    mcpToken: {
      findUnique: vi.fn(async (args: { where: { tokenHash: string } }) => {
        findUniqueCalls.push(args);
        return tokenRows.find((r) => r.tokenHash === args.where.tokenHash) ?? null;
      }),
      update: vi.fn(async (args: { where: { id: string }; data: { lastUsedAt: Date } }) => {
        updateCalls.push(args);
        return {};
      }),
    },
  },
}));

import {
  generateMcpToken,
  hashMcpToken,
  LAST_USED_REFRESH_MS,
  MCP_TOKEN_PREFIX,
  verifyMcpToken,
} from "@/lib/mcp/auth";

const NOW = new Date("2026-07-19T12:00:00.000Z");

function baseRow(overrides: Partial<McpTokenRow> = {}): McpTokenRow {
  return {
    id: "tok_1",
    tokenHash: "replaced-per-test",
    label: "Jamie's desktop",
    userId: "u_jamie",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    lastUsedAt: null,
    revokedAt: null,
    canApply: false,
    canDismissOwn: false,
    canProposeSend: false,
    user: {
      id: "u_jamie",
      email: "jamie@example.com",
      name: "Jamie",
      isCouple: true,
      role: "COUPLE",
    },
    ...overrides,
  };
}

beforeEach(() => {
  tokenRows = [];
  findUniqueCalls = [];
  updateCalls = [];
  // The module reads Date.now() for the lastUsedAt row-compare — pin it.
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("generateMcpToken", () => {
  it("produces a whmcp_-prefixed token with a 43-char base64url payload", () => {
    const { token } = generateMcpToken();
    // 32 random bytes → exactly 43 base64url chars (no padding).
    expect(token).toMatch(/^whmcp_[A-Za-z0-9_-]{43}$/);
    expect(token.startsWith(MCP_TOKEN_PREFIX)).toBe(true);
  });

  it("returns the SHA-256 hex of the full token as tokenHash", () => {
    const { token, tokenHash } = generateMcpToken();
    expect(tokenHash).toBe(hashMcpToken(token));
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a distinct token every call", () => {
    const a = generateMcpToken();
    const b = generateMcpToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe("verifyMcpToken", () => {
  it("returns null for a token without the whmcp_ prefix — and never hits the DB", async () => {
    const result = await verifyMcpToken("mcp_notourprefix1234567890");
    expect(result).toBeNull();
    expect(findUniqueCalls).toHaveLength(0);
  });

  it("looks up by the SHA-256 of the presented token", async () => {
    const { token } = generateMcpToken();
    await verifyMcpToken(token);
    expect(findUniqueCalls).toHaveLength(1);
    expect(findUniqueCalls[0]?.where.tokenHash).toBe(hashMcpToken(token));
  });

  it("returns null when no row matches the hash", async () => {
    const { token } = generateMcpToken();
    tokenRows = []; // nothing in the table
    expect(await verifyMcpToken(token)).toBeNull();
  });

  it("returns null for a revoked token and does not touch lastUsedAt", async () => {
    const { token, tokenHash } = generateMcpToken();
    tokenRows = [baseRow({ tokenHash, revokedAt: new Date("2026-07-10T00:00:00.000Z") })];
    expect(await verifyMcpToken(token)).toBeNull();
    expect(updateCalls).toHaveLength(0);
  });

  // v2.8.0: the return shape is { user, canApply } — canApply is a
  // property of the presented TOKEN, so the route can gate the
  // apply/dismiss tools per-token, not per-user.
  it("maps a valid token to the SessionUser fields of its owner", async () => {
    const { token, tokenHash } = generateMcpToken();
    tokenRows = [baseRow({ tokenHash })];
    expect(await verifyMcpToken(token)).toEqual({
      user: {
        id: "u_jamie",
        email: "jamie@example.com",
        name: "Jamie",
        isCouple: true,
        role: "COUPLE",
      },
      canApply: false,
      canDismissOwn: false,
      canProposeSend: false,
    });
  });

  it("passes the row's canApply flag through when set", async () => {
    const { token, tokenHash } = generateMcpToken();
    tokenRows = [baseRow({ tokenHash, canApply: true })];
    const verified = await verifyMcpToken(token);
    expect(verified?.canApply).toBe(true);
    expect(verified?.user.id).toBe("u_jamie");
  });

  // v2.9.0: same passthrough for the narrower dismiss-own flag.
  it("passes the row's canDismissOwn flag through when set", async () => {
    const { token, tokenHash } = generateMcpToken();
    tokenRows = [baseRow({ tokenHash, canDismissOwn: true })];
    const verified = await verifyMcpToken(token);
    expect(verified?.canDismissOwn).toBe(true);
    expect(verified?.canApply).toBe(false);
  });

  // v2.9.2: same passthrough for the nudge-send flag, independent of the
  // other two.
  it("passes the row's canProposeSend flag through when set", async () => {
    const { token, tokenHash } = generateMcpToken();
    tokenRows = [baseRow({ tokenHash, canProposeSend: true })];
    const verified = await verifyMcpToken(token);
    expect(verified?.canProposeSend).toBe(true);
    expect(verified?.canApply).toBe(false);
    expect(verified?.canDismissOwn).toBe(false);
  });
});

describe("verifyMcpToken — lastUsedAt touch (stateless row-compare)", () => {
  it("touches lastUsedAt when it is null", async () => {
    const { token, tokenHash } = generateMcpToken();
    tokenRows = [baseRow({ tokenHash, lastUsedAt: null })];
    await verifyMcpToken(token);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.where.id).toBe("tok_1");
    expect(updateCalls[0]?.data.lastUsedAt).toEqual(NOW);
  });

  it("touches lastUsedAt when older than LAST_USED_REFRESH_MS", async () => {
    const { token, tokenHash } = generateMcpToken();
    tokenRows = [
      baseRow({
        tokenHash,
        lastUsedAt: new Date(NOW.getTime() - LAST_USED_REFRESH_MS - 1),
      }),
    ];
    await verifyMcpToken(token);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.data.lastUsedAt).toEqual(NOW);
  });

  it("does NOT touch lastUsedAt when it is recent", async () => {
    const { token, tokenHash } = generateMcpToken();
    tokenRows = [
      baseRow({ tokenHash, lastUsedAt: new Date(NOW.getTime() - 5 * 60 * 1000) }),
    ];
    const verified = await verifyMcpToken(token);
    expect(verified).not.toBeNull(); // auth still succeeds, just no write
    expect(updateCalls).toHaveLength(0);
  });

  it("does NOT touch at exactly the refresh boundary (strictly-older-than)", async () => {
    const { token, tokenHash } = generateMcpToken();
    tokenRows = [
      baseRow({ tokenHash, lastUsedAt: new Date(NOW.getTime() - LAST_USED_REFRESH_MS) }),
    ];
    await verifyMcpToken(token);
    expect(updateCalls).toHaveLength(0);
  });
});
