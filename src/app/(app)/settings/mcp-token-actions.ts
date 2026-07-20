"use server";

// v2.7.0: MCP token management — server actions for the couple-only
// Settings panel (McpTokensPanel). Per-feature sibling actions file,
// same pattern as invite-actions.ts.
//
// Tokens are per-user bearer credentials for the LAN MCP server
// (src/app/api/mcp/route.ts). Only the SHA-256 hash lands in the DB;
// the raw token is returned exactly once from createMcpToken and is
// never retrievable again. Audit rows carry the label + target user —
// NEVER the token or its hash.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireCouple } from "@/lib/actions";
import { generateMcpToken } from "@/lib/mcp/auth";

const createTokenSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Label required")
    .max(64, "Label must be 64 characters or fewer"),
  userId: z.string().min(1, "Pick a member"),
});

export type CreateMcpTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

export type McpTokenResult = { ok: true } | { ok: false; error: string };

export type McpTokenRow = {
  id: string;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  // v2.8.0: whether this token may call the apply/dismiss MCP tools.
  canApply: boolean;
  // v2.9.0: narrower — dismiss_proposals only, restricted to the
  // token user's own proposals. Independent of canApply.
  canDismissOwn: boolean;
  user: { email: string; name: string | null };
};

export type TokenEligibleUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function createMcpToken(input: {
  label: string;
  userId: string;
}): Promise<CreateMcpTokenResult> {
  const actor = await requireCouple();
  const parsed = createTokenSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { label, userId } = parsed.data;

  // Only members who have actually signed in may hold a token — the
  // seed's placeholder rows (emailVerified null) must never be
  // token-eligible.
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  if (!target) return { ok: false, error: "That member no longer exists" };
  if (!target.emailVerified) {
    return {
      ok: false,
      error: "That member has never signed in — tokens can only be issued to members who have signed in at least once.",
    };
  }

  const { token, tokenHash } = generateMcpToken();
  const row = await db.mcpToken.create({ data: { tokenHash, label, userId } });

  await audit(actor, {
    action: "mcp_token.created",
    entity: "McpToken",
    entityId: row.id,
    metadata: {
      label,
      targetUserId: userId,
      summary: `MCP token "${label}" created for ${target.email}`,
    },
  });

  revalidatePath("/settings");
  // The raw token — shown once in the panel's copy box, then gone.
  return { ok: true, token };
}

export async function revokeMcpToken(id: string): Promise<McpTokenResult> {
  const actor = await requireCouple();
  const row = await db.mcpToken.findUnique({
    where: { id },
    select: {
      label: true,
      revokedAt: true,
      userId: true,
      user: { select: { email: true } },
    },
  });
  if (!row) return { ok: false, error: "Token not found" };
  // Already revoked — idempotent no-op, nothing new to audit.
  if (row.revokedAt) return { ok: true };

  await db.mcpToken.update({ where: { id }, data: { revokedAt: new Date() } });

  await audit(actor, {
    action: "mcp_token.revoked",
    entity: "McpToken",
    entityId: id,
    metadata: {
      label: row.label,
      targetUserId: row.userId,
      summary: `MCP token "${row.label}" revoked for ${row.user.email}`,
    },
  });

  revalidatePath("/settings");
  return { ok: true };
}

// v2.8.0: per-token opt-in to the apply/dismiss MCP tools. Off by
// default so a freshly minted token can only read + propose; flipping
// it on lets the connected agent write without human review, which is
// why the panel shows an explicit warning next to the toggle. Takes
// effect on the token's next request (verifyMcpToken reads the row
// fresh every call). Revoked tokens are refused — the flag would be
// dead weight and re-enabling a dead credential is confusing.
export async function setMcpTokenCanApply(
  id: string,
  canApply: boolean,
): Promise<McpTokenResult> {
  const actor = await requireCouple();
  const row = await db.mcpToken.findUnique({
    where: { id },
    select: {
      label: true,
      revokedAt: true,
      canApply: true,
      userId: true,
      user: { select: { email: true } },
    },
  });
  if (!row) return { ok: false, error: "Token not found" };
  if (row.revokedAt) return { ok: false, error: "Token is revoked" };
  // Already in the requested state — idempotent no-op, nothing new to audit.
  if (row.canApply === canApply) return { ok: true };

  await db.mcpToken.update({ where: { id }, data: { canApply } });

  await audit(actor, {
    action: canApply ? "mcp_token.can_apply_enabled" : "mcp_token.can_apply_disabled",
    entity: "McpToken",
    entityId: id,
    metadata: {
      label: row.label,
      targetUserId: row.userId,
      summary: canApply
        ? `MCP token "${row.label}" (${row.user.email}) may now apply changes without review`
        : `MCP token "${row.label}" (${row.user.email}) set back to propose-only`,
    },
  });

  revalidatePath("/settings");
  return { ok: true };
}

// v2.9.0: per-token opt-in to dismiss_proposals restricted to the
// token user's own proposals — a smaller step than canApply for a
// propose-only agent that wants to withdraw its own mistakes. Same
// contract as setMcpTokenCanApply: couple-only, refuses revoked
// tokens, idempotent, takes effect on the token's next request.
export async function setMcpTokenCanDismissOwn(
  id: string,
  canDismissOwn: boolean,
): Promise<McpTokenResult> {
  const actor = await requireCouple();
  const row = await db.mcpToken.findUnique({
    where: { id },
    select: {
      label: true,
      revokedAt: true,
      canDismissOwn: true,
      userId: true,
      user: { select: { email: true } },
    },
  });
  if (!row) return { ok: false, error: "Token not found" };
  if (row.revokedAt) return { ok: false, error: "Token is revoked" };
  // Already in the requested state — idempotent no-op, nothing new to audit.
  if (row.canDismissOwn === canDismissOwn) return { ok: true };

  await db.mcpToken.update({ where: { id }, data: { canDismissOwn } });

  await audit(actor, {
    action: canDismissOwn
      ? "mcp_token.can_dismiss_own_enabled"
      : "mcp_token.can_dismiss_own_disabled",
    entity: "McpToken",
    entityId: id,
    metadata: {
      label: row.label,
      targetUserId: row.userId,
      summary: canDismissOwn
        ? `MCP token "${row.label}" (${row.user.email}) may now dismiss its own proposals`
        : `MCP token "${row.label}" (${row.user.email}) can no longer dismiss its own proposals`,
    },
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function listMcpTokens(): Promise<McpTokenRow[]> {
  await requireCouple();
  return db.mcpToken.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
      canApply: true,
      canDismissOwn: true,
      user: { select: { email: true, name: true } },
    },
  });
}

export async function listTokenEligibleUsers(): Promise<TokenEligibleUser[]> {
  await requireCouple();
  return db.user.findMany({
    where: { emailVerified: { not: null } },
    orderBy: [{ isCouple: "desc" }, { name: "asc" }],
    select: { id: true, email: true, name: true },
  });
}
