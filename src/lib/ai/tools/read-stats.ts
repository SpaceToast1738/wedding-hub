import { z } from "zod";
import { buildWeddingContext, renderWeddingContext } from "@/lib/ai/context";
import type { AiTool } from "./types";

const inputSchema = z.object({});

export const readStats: AiTool<typeof inputSchema> = {
  name: "read_stats",
  description:
    "Return a compact snapshot of the wedding: date, weeks/days remaining, venue, task counts by status (including overdue), and guest RSVP counts. Use this at the start of any planning conversation.",
  inputSchema,
  progressLabel: "Reading wedding stats…",
  definition: {
    name: "read_stats",
    description:
      "Return a compact snapshot of the wedding: date, weeks/days remaining, venue, task counts by status (including overdue), and guest RSVP counts. Use this at the start of any planning conversation.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  async handler() {
    const ctx = await buildWeddingContext();
    return {
      ok: true,
      data: {
        summary: renderWeddingContext(ctx),
        ...ctx,
      },
    };
  },
};
