// v2.8.0: MCP self-apply — the planner agent can apply or dismiss its
// own proposals instead of waiting for a human sweep on /ai.
//
// Policy: Jamie's explicit 2026-07-19 decision was FULL self-apply.
// The gate is per-TOKEN (McpToken.canApply → ctx.canApply), so a
// propose-only token for another member stays propose-only. These
// tools are MCP-only: the in-app chat never sets ctx.canApply, and
// toolDefinitions() hides them unless it does, so the chat surface is
// unchanged. Every write still mints an AiProposal row first — the
// full history/audit surface on /ai keeps working; self-applied rows
// simply arrive already-APPLIED.
//
// runBulkCore deliberately carries NO permission gate (the /ai server
// actions gate before calling it) — so the handlers here MUST check
// canApply + canWrite before touching it.

import { z } from "zod";
import { db } from "@/lib/db";
import type { AiTool, ToolContext, ToolResult } from "./types";

// execute.ts transitively imports the app server-action graph (the not-
// yet-extracted book/guest/money apply modules reach into
// src/app/(app)/**/actions.ts → @/auth → next-auth). Static-importing it
// here would drag that whole graph into the tool registry's load-time
// closure — bundled fine in prod, but heavy for the MCP tool-listing
// path and it breaks the isolated registry-seam unit test. These tools
// only need the engine when actually CALLED, so it's a dynamic import
// inside the handlers; the tool DEFINITIONS stay dependency-free.
async function loadEngine() {
  return import("@/lib/ai/apply/execute");
}

const idsSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1)
    .max(50)
    .describe("Proposal ids from your own propose_* calls or read_proposals. Max 50 per call."),
});

const NO_APPLY_RIGHTS =
  "This token can propose but not apply — proposals stay PENDING for review on /ai. " +
  "The couple can enable 'Can apply changes' on the token in Settings → MCP tokens.";
const NO_WRITE_RIGHTS =
  "You don't have permission to modify proposals (ai_write EDIT required).";

function gate(ctx: ToolContext): ToolResult | null {
  if (!ctx.canApply) return { ok: false, error: NO_APPLY_RIGHTS };
  if (!ctx.canWrite) return { ok: false, error: NO_WRITE_RIGHTS };
  return null;
}

const IDS_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    ids: {
      type: "array",
      items: { type: "string" },
      description: "Proposal ids to act on (max 50).",
    },
  },
  required: ["ids"],
};

export const applyProposals: AiTool<typeof idsSchema> = {
  name: "apply_proposals",
  description:
    "Apply pending proposals you created, making their changes REAL immediately — no human review step. " +
    "Use after propose_* calls when the change is routine and clearly correct; leave a proposal PENDING " +
    "instead when it is destructive, ambiguous, or worth the couple's opinion (they review on /ai). " +
    "Per-item results: a failed item stays PENDING and the rest continue. Requires a token with apply rights.",
  inputSchema: idsSchema,
  progressLabel: "Applying proposals…",
  definition: {
    name: "apply_proposals",
    description:
      "Apply pending proposals by id — changes become real immediately (token needs apply rights). " +
      "Failed items stay PENDING; per-item results returned.",
    input_schema: IDS_JSON_SCHEMA,
  },
  async handler(input, ctx) {
    const refused = gate(ctx);
    if (refused) return refused;
    const { runBulkCore } = await loadEngine();
    const { results } = await runBulkCore(ctx.user, input.ids, "apply");
    const applied = results.filter((r) => r.ok).length;
    return { ok: true, data: { applied, failed: results.length - applied, results } };
  },
};

const NO_DISMISS_RIGHTS =
  "This token can propose but not dismiss — proposals stay PENDING for review on /ai. " +
  "The couple can enable 'Can apply changes' or 'Can dismiss its own proposals' on the token in Settings → MCP tokens.";

export const dismissProposals: AiTool<typeof idsSchema> = {
  name: "dismiss_proposals",
  description:
    "Dismiss pending proposals you created (e.g. superseded by a better plan or filed in error). " +
    "Dismissed proposals are kept for the record but never applied. Requires a token with apply rights, " +
    "or dismiss-own rights (in which case only proposals created by this token's user can be dismissed).",
  inputSchema: idsSchema,
  progressLabel: "Dismissing proposals…",
  definition: {
    name: "dismiss_proposals",
    description:
      "Dismiss pending proposals by id — kept for the record, never applied (token needs apply rights, " +
      "or dismiss-own rights limited to its own proposals).",
    input_schema: IDS_JSON_SCHEMA,
  },
  async handler(input, ctx) {
    // v2.9.0: two tiers. canApply keeps the v2.8.0 behaviour (dismiss
    // anything loadOwnedProposal grants — a couple token reaches every
    // row). canDismissOwn WITHOUT canApply is strictly narrower: only
    // rows created by the token's own user, even for a couple-tier
    // user (the point of the flag is a small blast radius).
    if (!ctx.canApply && !ctx.canDismissOwn) {
      return { ok: false, error: NO_DISMISS_RIGHTS };
    }
    if (!ctx.canWrite) return { ok: false, error: NO_WRITE_RIGHTS };
    const { runBulkCore } = await loadEngine();

    if (ctx.canApply) {
      const { results } = await runBulkCore(ctx.user, input.ids, "dismiss");
      const dismissed = results.filter((r) => r.ok).length;
      return { ok: true, data: { dismissed, failed: results.length - dismissed, results } };
    }

    // Own-only mode: pre-filter to rows this user created. Foreign or
    // missing ids get the same "Proposal not found." the ownership
    // check in loadOwnedProposal uses — existence is never leaked.
    const unique = [...new Set(input.ids)];
    const rows = await db.aiProposal.findMany({
      where: { id: { in: unique }, createdById: ctx.user.id },
      select: { id: true },
    });
    const own = new Set(rows.map((r) => r.id));
    const ownIds = unique.filter((id) => own.has(id));
    const byId = new Map<string, { id: string; ok: boolean; entityId: string | null; error: string | null }>();
    if (ownIds.length > 0) {
      const { results } = await runBulkCore(ctx.user, ownIds, "dismiss");
      for (const r of results) byId.set(r.id, r);
    }
    const results = unique.map(
      (id) =>
        byId.get(id) ?? {
          id,
          ok: false,
          entityId: null,
          error: "Proposal not found.",
        },
    );
    const dismissed = results.filter((r) => r.ok).length;
    return { ok: true, data: { dismissed, failed: results.length - dismissed, results } };
  },
};
