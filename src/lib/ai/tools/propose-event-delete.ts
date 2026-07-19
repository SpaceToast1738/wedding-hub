import { z } from "zod";
import { db } from "@/lib/db";
import { eventDeleteSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import {
  clipDisplay,
  DELETE_PROPOSED_MESSAGE,
  reasonFromRationale,
} from "./propose-delete-common";
import type { AiTool } from "./types";

// v2.8.0: destructive kind. Bridges to the event.delete apply handler
// (src/lib/ai/apply/deletes.ts) — a PERMANENT db delete with a
// recovery snapshot.
const inputSchema = z.object({
  eventId: z
    .string()
    .min(1)
    .describe("The id of the schedule event to delete — get this from a prior read_events call."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this event should be permanently deleted. Shown to the couple.",
    ),
});

export const proposeEventDelete: AiTool<typeof inputSchema> = {
  name: "propose_event_delete",
  description:
    "Propose PERMANENTLY deleting a schedule event. This is destructive: applying removes the event for good (a JSON snapshot is kept on the proposal for manual recovery, but there is no undo button). For an event that merely moved or changed, propose_event_update is the right tool — reserve deletion for events that are genuinely wrong (duplicates, cancelled plans that should vanish from the schedule). You MUST call read_events first so you have a valid eventId.",
  inputSchema,
  progressLabel: "Proposing event delete…",
  definition: {
    name: "propose_event_delete",
    description:
      "Propose permanently deleting a schedule event (snapshot-backed, no undo). Prefer propose_event_update for changes. Requires eventId from a prior read_events call.",
    input_schema: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "From read_events output." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this event should be deleted.",
        },
      },
      required: ["eventId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const event = await db.scheduleEvent.findUnique({
      where: { id: input.eventId },
      select: { title: true, startTime: true, allDay: true },
    });
    if (!event) {
      return { ok: false, error: unknownIdsError([`event:${input.eventId}`]) };
    }

    const payloadResult = eventDeleteSchema.safeParse({
      eventId: input.eventId,
      targetLabel: clipDisplay(event.title, 200),
      reason: reasonFromRationale(input.rationale),
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
        kind: "event.delete",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const when = event.allDay
      ? event.startTime.toISOString().slice(0, 10)
      : event.startTime.toISOString().slice(0, 16).replace("T", " ");

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "event.delete",
        title: `Delete "${event.title}"`,
        detail: `${when} · permanent — snapshot kept`,
        message: DELETE_PROPOSED_MESSAGE,
      },
    };
  },
};
