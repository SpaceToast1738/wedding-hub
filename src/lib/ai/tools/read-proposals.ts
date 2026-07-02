import { z } from "zod";
import { db } from "@/lib/db";
import { humanLabel, summariseProposal, type ProposalKind } from "@/lib/ai/proposals/schemas";
import type { AiTool } from "./types";

const inputSchema = z.object({});

export const readProposals: AiTool<typeof inputSchema> = {
  name: "read_proposals",
  description:
    "List the PENDING AI proposals already waiting for human review (kind, summary, rationale, created time). Call this BEFORE proposing anything so you never duplicate a proposal that's already queued, and to answer questions like 'what's waiting for review?'.",
  inputSchema,
  progressLabel: "Checking pending proposals…",
  definition: {
    name: "read_proposals",
    description:
      "List the PENDING AI proposals waiting for human review. Call before proposing to avoid duplicates.",
    input_schema: { type: "object", properties: {} },
  },
  async handler(_input, ctx) {
    // Visibility mirrors listPendingProposals: authors see their own,
    // the couple sees everyone's. Read-only — no canWrite gate needed;
    // proposals carry no money data.
    const where = ctx.user.isCouple ? {} : { createdById: ctx.user.id };
    const rows = await db.aiProposal.findMany({
      where: { ...where, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        kind: true,
        payload: true,
        rationale: true,
        createdAt: true,
        batchId: true,
      },
    });

    return {
      ok: true,
      data: {
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
        })),
      },
    };
  },
};
