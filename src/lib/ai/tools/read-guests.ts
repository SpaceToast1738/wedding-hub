import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import type { AiTool } from "./types";

const RSVP = ["PENDING", "ATTENDING", "DECLINED", "MAYBE"] as const;

const inputSchema = z.object({
  rsvp: z.enum(RSVP).optional(),
  side: z.enum(["BRIDE", "GROOM", "BOTH"]).optional(),
  hasDietary: z.boolean().optional(),
  isChild: z.boolean().optional(),
  nameContains: z.string().max(120).optional(),
  householdId: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  // v2.13.4: offset pagination, same contract as read_tasks — follow
  // page.nextOffset until null. Pre-fix `offset` (and `query`) were
  // accepted and silently STRIPPED, so with 48 attending guests the
  // response hit the 24k cap around 28 guests and the tail of the
  // alphabet was unreachable by the obvious route.
  offset: z.number().int().min(0).optional(),
  // Alias of nameContains — the name callers reach for first.
  query: z.string().max(120).optional(),
})
  // Unknown keys are an error that names the key, not a silent drop.
  .strict();

function trimNotes(notes: string | null): string | null {
  if (!notes) return null;
  return notes.length > 300 ? notes.slice(0, 300) + "…" : notes;
}

/** Same shape as read_tasks' resolver — see the comment there. */
function resolveCustomFields(
  defs: { id: string; name: string }[],
  values: unknown,
): Record<string, string | number> | undefined {
  if (!values || typeof values !== "object") return undefined;
  const bag = values as Record<string, unknown>;
  const out: Record<string, string | number> = {};
  for (const def of defs) {
    const v = bag[def.id];
    if (typeof v === "string" && v.trim() !== "") out[def.name] = v;
    else if (typeof v === "number") out[def.name] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export const readGuests: AiTool<typeof inputSchema> = {
  name: "read_guests",
  description:
    "Read guests matching the given filters. Also returns aggregate counts so you can answer 'how many are attending?' without listing everyone. Excludes archived guests. Returns 20 by default; `limit` up to 50. To enumerate EVERY match (the full list overflows the 24k result cap), page with `offset` — follow the returned page.nextOffset until it's null. Each guest includes household (with id), contact details, group memberships, resolved custom fields, and — when populated — their meal choices (starter/main/dessert), reception seat (table + index), song requests, and lastNudgedAt. Use `nameContains` (alias `query`) to find one guest, or `householdId` to list a whole household. Unknown parameters are rejected.",
  inputSchema,
  progressLabel: "Reading guests…",
  definition: {
    name: "read_guests",
    description:
      "Read guests matching the given filters, with aggregate RSVP counts. Excludes archived guests. 20 by default, `limit` up to 50; page with `offset` and follow page.nextOffset until null to enumerate everyone. Each guest includes household (with id), contact details, groups, custom fields, and — when set — meal choices, reception seat, song requests, and lastNudgedAt. `nameContains` (alias `query`) finds one guest. Unknown parameters are rejected.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        rsvp: { type: "string", enum: [...RSVP] },
        side: { type: "string", enum: ["BRIDE", "GROOM", "BOTH"] },
        hasDietary: { type: "boolean", description: "Only guests with at least one dietary tag." },
        isChild: { type: "boolean" },
        nameContains: {
          type: "string",
          description: "Case-insensitive substring match on first OR last name.",
        },
        householdId: { type: "string", description: "Only guests in this household." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Default 20." },
        offset: {
          type: "integer",
          minimum: 0,
          description: "Skip this many matches (default 0). Follow page.nextOffset to paginate.",
        },
        query: {
          type: "string",
          description: "Alias of nameContains — case-insensitive substring on first OR last name.",
        },
      },
    },
  },
  async handler(input, ctx) {
    // v2.4.0 review fix: the section gate — ai_chat access alone must
    // not bypass a NONE permission on the underlying section.
    if (!(await canView(ctx.user, "guests"))) {
      return { ok: false, error: "Guests aren't visible to this user." };
    }
    const where: Record<string, unknown> = { archived: false };
    if (input.rsvp) where.rsvp = input.rsvp;
    if (input.side) where.side = input.side;
    if (input.isChild != null) where.isChild = input.isChild;
    if (input.hasDietary) where.dietary = { isEmpty: false };
    if (input.householdId) where.householdId = input.householdId;
    const needle = input.nameContains ?? input.query;
    if (needle) {
      where.OR = [
        { firstName: { contains: needle, mode: "insensitive" } },
        { lastName: { contains: needle, mode: "insensitive" } },
      ];
    }

    const offset = input.offset ?? 0;
    const limit = input.limit ?? 20;

    const [guests, aggregate, fieldDefs, total] = await Promise.all([
      db.guest.findMany({
        where,
        skip: offset,
        take: limit,
        // id is the final tiebreaker so offset pagination is stable
        // across pages (two guests can share a full name).
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          rsvp: true,
          side: true,
          isChild: true,
          needsHighchair: true,
          dietary: true,
          plusOneAllowed: true,
          plusOneName: true,
          parentGuestId: true,
          role: true,
          email: true,
          phone: true,
          notes: true,
          customFieldValues: true,
          // v2.8.1: parity with the /guests detail page.
          mealStarter: true,
          mealMain: true,
          mealDessert: true,
          lastNudgedAt: true,
          tableSeat: {
            select: { index: true, table: { select: { id: true, name: true } } },
          },
          songRequests: { select: { title: true, artist: true } },
          household: { select: { id: true, name: true, side: true } },
          groups: { orderBy: { name: "asc" }, select: { id: true, name: true } },
        },
      }),
      db.guest.groupBy({
        by: ["rsvp"],
        where: { archived: false },
        _count: { _all: true },
      }),
      db.customField.findMany({
        where: { entity: "guest" },
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      }),
      db.guest.count({ where }),
    ]);

    const nextOffset = offset + limit < total ? offset + limit : null;

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
        // v2.13.4: `total` is the filtered match count (the aggregate
        // above is always the whole list).
        page: { offset, limit, total, nextOffset },
        guests: guests.map((g) => ({
          id: g.id,
          name: `${g.firstName} ${g.lastName}`.trim(),
          firstName: g.firstName,
          lastName: g.lastName,
          household: g.household
            ? { id: g.household.id, name: g.household.name, side: g.household.side }
            : null,
          rsvp: g.rsvp,
          side: g.side,
          isChild: g.isChild,
          needsHighchair: g.needsHighchair,
          dietary: g.dietary,
          plusOneAllowed: g.plusOneAllowed,
          plusOne: g.plusOneAllowed
            ? g.plusOneName ?? "(name pending)"
            : null,
          // Materialised +1 rows point back at their host via
          // parentGuestId — they're real Guest rows, so flag them
          // rather than letting the AI double-count "invitations".
          isPlusOne: g.parentGuestId != null,
          role: g.role,
          email: g.email,
          phone: g.phone,
          notes: trimNotes(g.notes),
          // v2.8.1: parity fields — emit only when populated so the
          // 24k tool-result cap isn't burned on nulls across a full page.
          meal:
            g.mealStarter || g.mealMain || g.mealDessert
              ? { starter: g.mealStarter, main: g.mealMain, dessert: g.mealDessert }
              : undefined,
          seat: g.tableSeat
            ? {
                index: g.tableSeat.index,
                tableId: g.tableSeat.table.id,
                tableName: g.tableSeat.table.name,
              }
            : undefined,
          lastNudgedAt: g.lastNudgedAt ? g.lastNudgedAt.toISOString() : undefined,
          songRequests: g.songRequests.length ? g.songRequests : undefined,
          groups: g.groups.length ? g.groups : undefined,
          customFields: resolveCustomFields(fieldDefs, g.customFieldValues),
        })),
      },
    };
  },
};
