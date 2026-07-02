import { z } from "zod";
import { db } from "@/lib/db";
import { eventCreateSchema } from "@/lib/ai/proposals/schemas";
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

    const payloadResult = eventCreateSchema.safeParse({
      title: input.title,
      startTime: input.startTime,
      endTime: input.endTime ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
      allDay: input.allDay ?? false,
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
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "event.create",
        title: input.title,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
