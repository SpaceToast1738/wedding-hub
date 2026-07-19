import { z } from "zod";
import { db } from "@/lib/db";
import { humanLabel, summariseProposal, type ProposalKind } from "@/lib/ai/proposals/schemas";
import type { AiTool } from "./types";

// v2.8.1 (Tier 2, Slice B): status filter. Defaults to PENDING so the
// pre-propose "is this already queued?" check is unchanged, but the
// model can now inspect APPLIED / DISMISSED / EDITED_AND_APPLIED history
// too ("did that guest-archive proposal get applied?").
const STATUSES = ["PENDING", "APPLIED", "DISMISSED", "EDITED_AND_APPLIED"] as const;

const inputSchema = z.object({
  status: z
    .enum(STATUSES)
    .optional()
    .describe(
      "Which proposals to list by review status. Defaults to PENDING (still awaiting review).",
    ),
});

export const readProposals: AiTool<typeof inputSchema> = {
  name: "read_proposals",
  description:
    "List AI proposals by review status (kind, summary, rationale, created time; for reviewed ones also status, when it was reviewed, and the id of the row it produced). Defaults to PENDING — call this BEFORE proposing anything so you never duplicate a proposal that's already queued, and to answer 'what's waiting for review?'. Pass status=APPLIED/DISMISSED/EDITED_AND_APPLIED to check what happened to an earlier proposal.",
  inputSchema,
  progressLabel: "Checking proposals…",
  definition: {
    name: "read_proposals",
    description:
      "List AI proposals by review status (default PENDING). Call before proposing to avoid duplicates; pass status to inspect APPLIED / DISMISSED / EDITED_AND_APPLIED history.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [...STATUSES],
          description: "Review status to list. Default PENDING.",
        },
      },
    },
  },
  async handler(input, ctx) {
    // Visibility mirrors listPendingProposals: authors see their own,
    // the couple sees everyone's. Read-only — no canWrite gate needed;
    // proposals carry no money data.
    const visibility = ctx.user.isCouple ? {} : { createdById: ctx.user.id };
    const status = input.status ?? "PENDING";
    const rows = await db.aiProposal.findMany({
      where: { ...visibility, status },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        kind: true,
        payload: true,
        rationale: true,
        createdAt: true,
        batchId: true,
        status: true,
        appliedEntityId: true,
        reviewedAt: true,
      },
    });

    return {
      ok: true,
      data: {
        status,
        count: rows.length,
        // Flag truncation so the model doesn't assume it saw the whole
        // queue when using this list for duplicate-avoidance.
        truncated: rows.length === 25,
        proposals: rows.map((r) => ({
          id: r.id,
          kind: r.kind,
          kindLabel: humanLabel(r.kind as ProposalKind),
          summary: summariseProposal(r.kind, r.payload),
          rationale: r.rationale,
          createdAt: r.createdAt.toISOString(),
          batchId: r.batchId,
          status: r.status,
          // Populated once reviewed: the row the proposal produced +
          // when the decision was made.
          appliedEntityId: r.appliedEntityId,
          reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        })),
      },
    };
  },
};
