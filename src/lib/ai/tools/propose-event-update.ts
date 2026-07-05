import { z } from "zod";
import { db } from "@/lib/db";
import { eventUpdateSchema } from "@/lib/ai/proposals/schemas";
import { BUILTIN_GROUP_SLUGS } from "@/lib/group-members";
import { buildDetailLine, resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// Attendees are ADD/REMOVE deltas because updateScheduleEvent replaces
// the whole attendeeRefs array as a unit — the apply bridge merges the
// deltas against the live row (including the legacy attendeeIds
// expansion), so refs the AI never named always survive. Additions are
// restricted to the two shapes the AI can validate ("user:<id>" /
// "builtin:<slug>", same as propose_event); removals are free strings
// matched against the live array at apply — unknown ones no-op, and
// this is how human-only "group:<slug>" refs stay removable.
const inputSchema = z.object({
  eventId: z
    .string()
    .min(1)
    .describe("The id of the event to update — get this from a prior read_events call."),
  title: z.string().min(1).max(200).optional(),
  startTime: z
    .string()
    .min(1)
    .optional()
    .describe("ISO datetime (YYYY-MM-DDTHH:MM)."),
  endTime: z
    .string()
    .optional()
    .nullable()
    .describe("ISO datetime (YYYY-MM-DDTHH:MM); null clears the end time."),
  location: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  allDay: z.boolean().optional(),
  addAttendeeRefs: z.array(z.string().min(1).max(120)).max(15).optional(),
  removeAttendeeRefs: z.array(z.string().min(1).max(120)).max(15).optional(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this update makes sense. Shown to the couple."),
});

export const proposeEventUpdate: AiTool<typeof inputSchema> = {
  name: "propose_event_update",
  description:
    "Propose an update to an existing schedule event. Only include what you want changed. Attendees are ADD/REMOVE deltas merged against the event's current attendees at apply time — echo removal strings exactly as read_events returned them; endTime:null clears the end time; times are ISO (YYYY-MM-DDTHH:MM). You MUST call read_events first so you have a valid eventId.",
  inputSchema,
  progressLabel: "Proposing event update…",
  definition: {
    name: "propose_event_update",
    description:
      "Propose a partial update to a schedule event. Only include fields you want changed; attendee changes are add/remove deltas. Requires eventId from a prior read_events call.",
    input_schema: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "From read_events output." },
        title: { type: "string" },
        startTime: { type: "string", description: "ISO datetime (YYYY-MM-DDTHH:MM)." },
        endTime: {
          type: ["string", "null"],
          description: "ISO datetime (YYYY-MM-DDTHH:MM). Pass null to clear the end time.",
        },
        location: { type: ["string", "null"], description: "Pass null to clear." },
        notes: { type: ["string", "null"], description: "Pass null to clear." },
        allDay: { type: "boolean" },
        addAttendeeRefs: {
          type: "array",
          items: { type: "string" },
          description:
            'Attendees to ADD. Each entry is "user:<id>" (ids from the reference directory) or a builtin group like "builtin:couple".',
        },
        removeAttendeeRefs: {
          type: "array",
          items: { type: "string" },
          description:
            "Attendees to REMOVE — echo the exact ref strings read_events returned. Unknown refs no-op at apply.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this update makes sense.",
        },
      },
      required: ["eventId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    // Additions get the same shape validation as propose_event —
    // user:<id> against real users, builtin:<slug> against the builtin
    // registry; anything else (including group:) is rejected.
    const adds = input.addAttendeeRefs ?? [];
    const addUserIds = adds
      .filter((r) => r.startsWith("user:"))
      .map((r) => r.slice("user:".length));
    const badShape = adds.filter(
      (r) => !r.startsWith("user:") && !r.startsWith("builtin:"),
    );
    const badBuiltin = adds
      .filter((r) => r.startsWith("builtin:"))
      .filter((r) => !BUILTIN_GROUP_SLUGS.has(r.slice("builtin:".length)));
    if (badShape.length || badBuiltin.length) {
      return {
        ok: false,
        error: `Invalid addAttendeeRefs: ${[...badShape, ...badBuiltin].join(", ")}. Use "user:<id>" with ids from the reference directory, or one of the builtin groups listed there.`,
      };
    }

    const { invalid, names } = await resolveRefs({
      eventIds: [input.eventId],
      userIds: addUserIds,
    });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    const patch: Record<string, unknown> = { eventId: input.eventId };
    if (input.title !== undefined) patch.title = input.title;
    if (input.startTime !== undefined) patch.startTime = input.startTime;
    if (input.endTime !== undefined) patch.endTime = input.endTime;
    if (input.location !== undefined) patch.location = input.location;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.allDay !== undefined) patch.allDay = input.allDay;
    if (adds.length) patch.addAttendeeRefs = adds;
    if (input.removeAttendeeRefs?.length) patch.removeAttendeeRefs = input.removeAttendeeRefs;

    if (Object.keys(patch).length === 1) {
      return {
        ok: false,
        error:
          "The update contains no changes. Include at least one field to change (title, times, location, notes, allDay, or an attendee delta).",
      };
    }

    const payloadResult = eventUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return {
        ok: false,
        error: `Payload validation failed: ${payloadResult.error.message}`,
      };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "event.update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detail = buildDetailLine({
      attendees: [
        ...adds.map((r) =>
          r.startsWith("user:")
            ? `+${names.users.get(r.slice("user:".length))!}`
            : `+${r.slice("builtin:".length)}`,
        ),
        ...(input.removeAttendeeRefs ?? []).map((r) => `−${r}`),
      ],
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "event.update",
        title: `Update "${names.events.get(input.eventId)}"`,
        detail,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
