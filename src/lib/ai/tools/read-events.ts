import { z } from "zod";
import { db } from "@/lib/db";
import type { AiTool } from "./types";

const inputSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const readEvents: AiTool<typeof inputSchema> = {
  name: "read_events",
  description:
    "Read schedule events (both planning-timeline events and day-of ceremony events) between two dates. Use this before proposing new timeline entries so you don't duplicate.",
  inputSchema,
  progressLabel: "Reading schedule…",
  definition: {
    name: "read_events",
    description:
      "Read schedule events (both planning-timeline events and day-of ceremony events) between two dates. Use this before proposing new timeline entries so you don't duplicate.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "ISO datetime lower bound (inclusive)." },
        to: { type: "string", description: "ISO datetime upper bound (inclusive)." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Default 20." },
      },
    },
  },
  async handler(input) {
    const where: Record<string, unknown> = {};
    if (input.from || input.to) {
      const range: Record<string, Date> = {};
      if (input.from) range.gte = new Date(input.from);
      if (input.to) range.lte = new Date(input.to);
      where.startTime = range;
    }

    const events = await db.scheduleEvent.findMany({
      where,
      take: input.limit ?? 20,
      orderBy: [{ startTime: "asc" }],
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        location: true,
        allDay: true,
        notes: true,
      },
    });

    return {
      ok: true,
      data: {
        count: events.length,
        events: events.map((e) => ({
          id: e.id,
          title: e.title,
          startTime: e.allDay
            ? e.startTime.toISOString().slice(0, 10)
            : e.startTime.toISOString(),
          endTime: e.endTime?.toISOString() ?? null,
          location: e.location,
          allDay: e.allDay,
          notes: e.notes ? e.notes.slice(0, 200) : null,
        })),
      },
    };
  },
};
