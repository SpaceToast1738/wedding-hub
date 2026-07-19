// v2.8.0 (§C2): enhancement-suggestion channel — the agent files
// improvement ideas for the product itself (website / MCP surface /
// AI features). Unlike every propose_* tool this INSERTS DIRECTLY:
// suggestions are meta-feedback about the app, not wedding data, so
// there is nothing to "apply" and the proposal machinery would only
// add a review queue nobody needs. The write is audited, and a
// per-area cap on NEW rows stops idea-flooding.
//
// Gating is deliberately minimal: any caller who reached the tool
// registry already passed the ai_chat gate, and that's enough here.

import { z } from "zod";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AiTool } from "./types";

export const ENHANCEMENT_AREAS = ["WEBSITE", "MCP", "AI"] as const;
export const ENHANCEMENT_STATUSES = ["NEW", "PLANNED", "DONE", "DECLINED"] as const;

export type EnhancementArea = (typeof ENHANCEMENT_AREAS)[number];
export type EnhancementStatus = (typeof ENHANCEMENT_STATUSES)[number];

/** Refuse new suggestions for an area once this many are sitting in
 *  NEW — the backlog needs triage, not more volume. */
export const MAX_NEW_PER_AREA = 10;

const inputSchema = z.object({
  area: z
    .enum(ENHANCEMENT_AREAS)
    .describe(
      "Which part of the product the idea is about: WEBSITE (pages/UI), MCP (the MCP tool surface), or AI (chat/proposals/one-shots).",
    ),
  title: z
    .string()
    .min(1)
    .max(120)
    .describe("Short imperative headline for the idea, e.g. 'Add a seat.swap tool'."),
  detail: z
    .string()
    .min(1)
    .max(2000)
    .describe(
      "What's missing, why it matters, and (if known) a sketch of the fix. Enough context for a dev session to act without this conversation.",
    ),
});

export const suggestEnhancement: AiTool<typeof inputSchema> = {
  name: "suggest_enhancement",
  description:
    "File an improvement idea for Wedding Hub itself — the website, the MCP tool surface, or the AI features. Use this when you hit a capability wall (a tool you needed doesn't exist, a read is missing data, a workflow is blocked) or when you notice a product improvement worth making. This is dev-backlog feedback, NOT wedding data — it inserts directly, no proposal review. Check read_enhancements FIRST so you don't file a duplicate of something already suggested.",
  inputSchema,
  progressLabel: "Filing enhancement suggestion…",
  definition: {
    name: "suggest_enhancement",
    description:
      "File a product-improvement idea (dev backlog) for the WEBSITE, MCP surface, or AI features. Direct insert, no proposal. Check read_enhancements first to avoid duplicates.",
    input_schema: {
      type: "object",
      properties: {
        area: {
          type: "string",
          enum: [...ENHANCEMENT_AREAS],
          description:
            "WEBSITE (pages/UI), MCP (the MCP tool surface), or AI (chat/proposals/one-shots).",
        },
        title: {
          type: "string",
          maxLength: 120,
          description: "Short imperative headline for the idea.",
        },
        detail: {
          type: "string",
          maxLength: 2000,
          description:
            "What's missing, why it matters, and a sketch of the fix — self-contained.",
        },
      },
      required: ["area", "title", "detail"],
    },
  },
  async handler(input, ctx) {
    // Anti-flood: once an area has MAX_NEW_PER_AREA suggestions still
    // in NEW, the useful move is triage, not an 11th idea.
    const newCount = await db.enhancementSuggestion.count({
      where: { area: input.area, status: "NEW" },
    });
    if (newCount >= MAX_NEW_PER_AREA) {
      return {
        ok: false,
        error: `The ${input.area} area already has ${newCount} suggestions in NEW — review the existing suggestions first (read_enhancements) before filing more.`,
      };
    }

    const suggestion = await db.enhancementSuggestion.create({
      data: {
        createdById: ctx.user.id,
        area: input.area,
        title: input.title,
        detail: input.detail,
      },
    });

    await logAudit({
      userId: ctx.user.id,
      action: "enhancement.suggested",
      entity: "EnhancementSuggestion",
      entityId: suggestion.id,
      metadata: {
        area: input.area,
        title: input.title,
        summary: `Enhancement suggested (${input.area}): "${input.title}"`,
      },
    });

    return {
      ok: true,
      data: {
        id: suggestion.id,
        area: suggestion.area,
        title: suggestion.title,
      },
    };
  },
};
