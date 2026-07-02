import { z } from "zod";
import { db } from "@/lib/db";
import { eventCreateSchema } from "@/lib/ai/proposals/schemas";
import { BUILTIN_GROUP_SLUGS } from "@/lib/group-members";
import { buildDetailLine, resolveRefs, unknownIdsError } from "./validate-refs";
import type { AiTool } from "./types";

const inputSchema = z.object({
  title: z.string().min(1).max(200),
  startTime: z
    .string()
    .describe("ISO 8601 datetime, e.g. 2026-09-15T10:00:00Z. Required."),
  endTime: z.string().optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  allDay: z.boolean().optional(),
  // v2.2.0: attendees — "user:<id>" (reference directory) or
  // "builtin:<slug>" (couple / everyone / wedding-party-role /
  // planners-role). Custom "group:<slug>" refs are human-picker
  // territory; the AI sticks to the two validated shapes.
  attendeeRefs: z.array(z.string()).max(15).optional(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining why this event belongs on the schedule.",
    ),
});

export const proposeEvent: AiTool<typeof inputSchema> = {
  name: "propose_event",
  description:
    "Propose a schedule event (a milestone, appointment, or day-of moment). Does NOT create the event directly — writes a proposal. Use ISO datetime for startTime; set allDay:true and the time will be normalised away.",
  inputSchema,
  progressLabel: "Proposing event…",
  definition: {
    name: "propose_event",
    description:
      "Propose a schedule event. Writes a proposal — does not create the event directly.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        startTime: {
          type: "string",
          description: "ISO 8601 datetime, e.g. 2026-09-15T10:00:00Z.",
        },
        endTime: { type: "string", description: "Optional ISO 8601 datetime." },
        location: { type: "string" },
        notes: { type: "string" },
        allDay: { type: "boolean" },
        attendeeRefs: {
          type: "array",
          items: { type: "string" },
          description:
            'Who attends. Each entry is "user:<id>" (ids from the reference directory) or a builtin group like "builtin:couple". Optional.',
        },
        rationale: {
          type: "string",
          description:
            "One or two sentences explaining why this event belongs on the schedule.",
        },
      },
      required: ["title", "startTime", "rationale"],
    },
  },
  async handler(input, ctx) {
    if (!ctx.canWrite) {
      return {
        ok: false,
        error:
          "You don't have permission to write proposals. Ask the couple for ai_write access.",
      };
    }

    // Validate attendee refs: user:<id> against real users,
    // builtin:<slug> against the builtin group registry. Anything
    // else (including group:<slug>) is rejected with guidance.
    const refs = input.attendeeRefs ?? [];
    const userRefIds = refs
      .filter((r) => r.startsWith("user:"))
      .map((r) => r.slice("user:".length));
    const badShape = refs.filter(
      (r) => !r.startsWith("user:") && !r.startsWith("builtin:"),
    );
    const badBuiltin = refs
      .filter((r) => r.startsWith("builtin:"))
      .filter((r) => !BUILTIN_GROUP_SLUGS.has(r.slice("builtin:".length)));
    if (badShape.length || badBuiltin.length) {
      return {
        ok: false,
        error: `Invalid attendeeRefs: ${[...badShape, ...badBuiltin].join(", ")}. Use "user:<id>" with ids from the reference directory, or one of the builtin groups listed there.`,
      };
    }
    const { invalid, names } = await resolveRefs({ userIds: userRefIds });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    const payloadResult = eventCreateSchema.safeParse({
      title: input.title,
      startTime: input.startTime,
      endTime: input.endTime ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
      allDay: input.allDay ?? false,
      attendeeRefs: refs,
    });
    if (!payloadResult.success) {
      return {
        ok: false,
        error: `Payload validation failed: ${payloadResult.error.message}`,
      };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "event.create",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detail = buildDetailLine({
      attendees: refs.map((r) =>
        r.startsWith("user:")
          ? names.users.get(r.slice("user:".length))!
          : r.slice("builtin:".length),
      ),
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "event.create",
        title: input.title,
        detail,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
