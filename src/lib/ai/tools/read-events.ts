import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import { BUILTIN_GROUPS, displayName } from "@/lib/group-members";
import type { AiTool } from "./types";

const inputSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const BUILTIN_NAMES: Record<string, string> = Object.fromEntries(
  BUILTIN_GROUPS.map((g) => [g.slug, g.name]),
);

/** "wedding-party-role" → "Wedding party role" — display fallback for
 *  builtin/group slugs the name maps don't cover. */
function prettifySlug(slug: string): string {
  const spaced = slug.replace(/-/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : slug;
}

export const readEvents: AiTool<typeof inputSchema> = {
  name: "read_events",
  description:
    "Read schedule events (both planning-timeline events and day-of ceremony events) between two dates. Use this before proposing new timeline entries so you don't duplicate. Each event includes its canonical `attendeeRefs` strings (user:<id> / builtin:<slug> / group:<slug>) plus resolved display names — echo attendeeRefs strings EXACTLY into propose_event_update removeAttendeeRefs.",
  inputSchema,
  progressLabel: "Reading schedule…",
  definition: {
    name: "read_events",
    description:
      "Read schedule events (both planning-timeline events and day-of ceremony events) between two dates. Use this before proposing new timeline entries so you don't duplicate. Each event includes its canonical `attendeeRefs` strings plus resolved display names — echo attendeeRefs strings EXACTLY into propose_event_update removeAttendeeRefs.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "ISO datetime lower bound (inclusive)." },
        to: { type: "string", description: "ISO datetime upper bound (inclusive)." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Default 20." },
      },
    },
  },
  async handler(input, ctx) {
    // v2.4.0 review fix: the section gate — ai_chat access alone must
    // not bypass a NONE permission on the underlying section.
    if (!(await canView(ctx.user, "schedule"))) {
      return { ok: false, error: "The schedule isn't visible to this user." };
    }
    const where: Record<string, unknown> = {};
    if (input.from || input.to) {
      const range: Record<string, Date> = {};
      // Validate before Prisma sees them — an Invalid Date makes
      // findMany throw a raw engine error the model can't act on.
      if (input.from) {
        const d = new Date(input.from);
        if (isNaN(d.getTime())) {
          return { ok: false, error: `Invalid \"from\" date: ${input.from}. Use ISO format.` };
        }
        range.gte = d;
      }
      if (input.to) {
        const d = new Date(input.to);
        if (isNaN(d.getTime())) {
          return { ok: false, error: `Invalid \"to\" date: ${input.to}. Use ISO format.` };
        }
        range.lte = d;
      }
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
        attendeeIds: true,
        attendeeRefs: true,
      },
    });

    // Legacy expansion is MANDATORY (v1.41.0 contract, mirrors
    // resolveAttendeeRefs in group-members.ts): pre-refs rows only
    // have attendeeIds, and propose_event_update's removeAttendeeRefs
    // matches against canonical "user:<id>" strings.
    const refsByEvent = events.map((e) =>
      e.attendeeRefs.length
        ? e.attendeeRefs
        : e.attendeeIds.map((id) => `user:${id}`),
    );

    const userIds = new Set<string>();
    for (const refs of refsByEvent) {
      for (const ref of refs) {
        if (ref.startsWith("user:")) userIds.add(ref.slice("user:".length));
      }
    }
    const users = userIds.size
      ? await db.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, firstName: true, lastName: true, name: true, email: true },
        })
      : [];
    const userNames = new Map(users.map((u) => [u.id, displayName(u)]));

    const nameForRef = (ref: string): string => {
      if (ref.startsWith("user:")) {
        return userNames.get(ref.slice("user:".length)) ?? "(unknown user)";
      }
      if (ref.startsWith("builtin:")) {
        const slug = ref.slice("builtin:".length);
        return BUILTIN_NAMES[slug] ?? prettifySlug(slug);
      }
      if (ref.startsWith("group:")) {
        return prettifySlug(ref.slice("group:".length));
      }
      return ref;
    };

    return {
      ok: true,
      data: {
        count: events.length,
        events: events.map((e, i) => ({
          id: e.id,
          title: e.title,
          startTime: e.allDay
            ? e.startTime.toISOString().slice(0, 10)
            : e.startTime.toISOString(),
          endTime: e.endTime?.toISOString() ?? null,
          location: e.location,
          allDay: e.allDay,
          notes: e.notes ? e.notes.slice(0, 200) : null,
          attendeeRefs: refsByEvent[i] ?? [],
          attendeeNames: (refsByEvent[i] ?? []).map(nameForRef),
        })),
      },
    };
  },
};
