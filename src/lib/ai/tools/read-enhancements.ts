// v2.8.0 (§C2): read side of the enhancement-suggestion channel.
// Lists filed product-improvement ideas so the agent can (a) avoid
// duplicating something already suggested before calling
// suggest_enhancement, and (b) let dev sessions pull the PLANNED
// list as an input backlog.
//
// Same minimal gating as suggest_enhancement: reaching the registry
// means the caller passed ai_chat, and these rows are meta-feedback
// about the product — no wedding data, no money — so nothing more is
// checked.

import { z } from "zod";
import { db } from "@/lib/db";
import type { AiTool } from "./types";
import { ENHANCEMENT_AREAS, ENHANCEMENT_STATUSES } from "./suggest-enhancement";

const DEFAULT_LIMIT = 25;
const DETAIL_CLIP = 300;

const inputSchema = z.object({
  status: z
    .enum(ENHANCEMENT_STATUSES)
    .optional()
    .describe("Only rows in this status. Omit for all statuses."),
  area: z
    .enum(ENHANCEMENT_AREAS)
    .optional()
    .describe("Only rows for this product area. Omit for all areas."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe(`Max rows to return (default ${DEFAULT_LIMIT}).`),
});

export const readEnhancements: AiTool<typeof inputSchema> = {
  name: "read_enhancements",
  description:
    "List the enhancement suggestions already filed against Wedding Hub itself (website / MCP / AI dev backlog): id, area, title, detail (clipped), status (NEW | PLANNED | DONE | DECLINED), created date — newest first. Call this BEFORE suggest_enhancement so you never file a duplicate, and to answer 'what's on the product backlog?'.",
  inputSchema,
  progressLabel: "Reading enhancement suggestions…",
  definition: {
    name: "read_enhancements",
    description:
      "List filed product-enhancement suggestions (dev backlog), newest first. Call before suggest_enhancement to avoid duplicates.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [...ENHANCEMENT_STATUSES],
          description: "Only rows in this status.",
        },
        area: {
          type: "string",
          enum: [...ENHANCEMENT_AREAS],
          description: "Only rows for this product area.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          description: `Max rows to return (default ${DEFAULT_LIMIT}).`,
        },
      },
    },
  },
  // ctx unused on purpose — no extra gating beyond reaching the
  // registry (see module comment), so the param is omitted.
  async handler(input) {
    const take = input.limit ?? DEFAULT_LIMIT;
    const rows = await db.enhancementSuggestion.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.area ? { area: input.area } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        area: true,
        title: true,
        detail: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      ok: true,
      data: {
        count: rows.length,
        // Flag truncation so the model doesn't treat a full page as
        // the whole backlog when checking for duplicates.
        truncated: rows.length === take,
        suggestions: rows.map((r) => ({
          id: r.id,
          area: r.area,
          title: r.title,
          detail:
            r.detail.length > DETAIL_CLIP
              ? `${r.detail.slice(0, DETAIL_CLIP)}…`
              : r.detail,
          status: r.status,
          createdAt: r.createdAt.toISOString().slice(0, 10),
        })),
      },
    };
  },
};
