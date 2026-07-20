// v2.7.0: MCP bearer-token auth.
//
// Tokens are `whmcp_` + 32 random bytes (base64url). Only the SHA-256
// hex lands in the DB (McpToken.tokenHash, unique) — verification is
// hash-then-lookup, so no raw-secret comparison exists anywhere and a
// DB leak reveals nothing usable. The raw token is shown exactly once,
// from the create action's return value.
//
// This module stays free of React/Next request APIs on purpose: the
// permission gates (canView/canEdit) live in the route, so unit tests
// here need only vi.mock("@/lib/db").

import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/actions";

export const MCP_TOKEN_PREFIX = "whmcp_";

// Refresh lastUsedAt at most this often — a busy MCP client makes many
// calls per minute and the column only needs to answer "is this token
// alive, roughly when was it last seen".
export const LAST_USED_REFRESH_MS = 60 * 60 * 1000; // 1 hour

export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateMcpToken(): { token: string; tokenHash: string } {
  const token = `${MCP_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashMcpToken(token) };
}

/** Resolve a presented bearer token to the user it belongs to, plus
 *  the token's own capability flags. Returns null for unknown,
 *  revoked, or malformed tokens. The user row is fetched fresh on
 *  every call, so permission or role changes (and user deletion, via
 *  the FK cascade) apply immediately — and so does flipping canApply
 *  in Settings, since it rides the same lookup (v2.8.0: canApply
 *  gates the apply/dismiss MCP tools; it is per-token, not per-user,
 *  so the same member can hold one self-applying token and one
 *  propose-only token). */
export async function verifyMcpToken(
  token: string,
): Promise<{
  user: SessionUser;
  canApply: boolean;
  canDismissOwn: boolean;
  canProposeSend: boolean;
} | null> {
  if (!token.startsWith(MCP_TOKEN_PREFIX)) return null;
  const row = await db.mcpToken.findUnique({
    where: { tokenHash: hashMcpToken(token) },
    include: { user: true },
  });
  if (!row || row.revokedAt) return null;

  // Stateless row-compare: write only when the fetched row says the
  // last touch is old (or absent). No cache — the row we just read is
  // the state. Fire-and-forget; a failed touch must not fail auth.
  const now = Date.now();
  if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > LAST_USED_REFRESH_MS) {
    void db.mcpToken
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date(now) } })
      .catch(() => undefined);
  }

  return {
    user: {
      id: row.user.id,
      email: row.user.email,
      name: row.user.name,
      isCouple: row.user.isCouple,
      role: row.user.role,
    },
    canApply: row.canApply,
    // v2.9.0: narrower flag — dismiss_proposals only, own rows only.
    canDismissOwn: row.canDismissOwn,
    // v2.9.2: gates propose_nudge_send (the digest-send propose tool).
    canProposeSend: row.canProposeSend,
  };
}
