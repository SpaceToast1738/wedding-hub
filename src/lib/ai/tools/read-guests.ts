import { z } from "zod";
import { db } from "@/lib/db";
import type { AiTool } from "./types";

const RSVP = ["PENDING", "ATTENDING", "DECLINED", "MAYBE"] as const;

const inputSchema = z.object({
  rsvp: z.enum(RSVP).optional(),
  side: z.enum(["BRIDE", "GROOM", "BOTH"]).optional(),
  hasDietary: z.boolean().optional(),
  isChild: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const readGuests: AiTool<typeof inputSchema> = {
  name: "read_guests",
  description:
    "Read guests matching the given filters. Also returns aggregate counts so you can answer 'how many are attending?' without listing everyone. Excludes archived guests.",
  inputSchema,
  progressLabel: "Reading guests…",
  definition: {
    name: "read_guests",
    description:
      "Read guests matching the given filters. Also returns aggregate counts so you can answer 'how many are attending?' without listing everyone. Excludes archived guests.",
    input_schema: {
      type: "object",
      properties: {
        rsvp: { type: "string", enum: [...RSVP] },
        side: { type: "string", enum: ["BRIDE", "GROOM", "BOTH"] },
        hasDietary: { type: "boolean", description: "Only guests with at least one dietary tag." },
        isChild: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Default 20." },
      },
    },
  },
  async handler(input) {
    const where: Record<string, unknown> = { archived: false };
    if (input.rsvp) where.rsvp = input.rsvp;
    if (input.side) where.side = input.side;
    if (input.isChild != null) where.isChild = input.isChild;
    if (input.hasDietary) where.dietary = { isEmpty: false };

    const [guests, aggregate] = await Promise.all([
      db.guest.findMany({
        where,
        take: input.limit ?? 20,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          rsvp: true,
          side: true,
          isChild: true,
          dietary: true,
          plusOneAllowed: true,
          plusOneName: true,
          role: true,
        },
      }),
      db.guest.groupBy({
        by: ["rsvp"],
        where: { archived: false },
        _count: { _all: true },
      }),
    ]);

    const counts = Object.fromEntries(
      aggregate.map((r) => [r.rsvp, r._count._all]),
    ) as Record<string, number>;

    return {
      ok: true,
      data: {
        aggregate: {
          total: aggregate.reduce((s, r) => s + r._count._all, 0),
          attending: counts.ATTENDING ?? 0,
          pending: counts.PENDING ?? 0,
          declined: counts.DECLINED ?? 0,
          maybe: counts.MAYBE ?? 0,
        },
        count: guests.length,
        guests: guests.map((g) => ({
          id: g.id,
          name: `${g.firstName} ${g.lastName}`.trim(),
          rsvp: g.rsvp,
          side: g.side,
          isChild: g.isChild,
          dietary: g.dietary,
          plusOne: g.plusOneAllowed
            ? g.plusOneName ?? "(name pending)"
            : null,
          role: g.role,
        })),
      },
    };
  },
};
