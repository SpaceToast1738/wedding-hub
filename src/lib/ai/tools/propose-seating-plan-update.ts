// v2.9.2: plan-level seating write — the wedding-wide seating notes and
// the day-of checklist that render at the top of /seating (stored on the
// WeddingSettings singleton). Bridges to seating.plan.update
// (src/lib/ai/apply/misc.ts). Gated on the seating section (couple +
// planner) at apply. The checklist is a WHOLE-LIST replacement — read the
// current list from read_seating's plan.checklist and send it back with
// your edits, or the existing items are dropped.

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { seatingPlanUpdateSchema } from "@/lib/ai/proposals/schemas";
import { canView } from "@/lib/permissions";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = z.object({
  notes: z
    .string()
    .max(5000)
    .nullable()
    .optional()
    .describe("Plan-level seating notes (table-size rules, staffing reminders). null clears; omit to keep."),
  checklist: z
    .array(
      z.object({
        id: z
          .string()
          .min(1)
          .max(50)
          .optional()
          .describe("Reuse the id from read_seating to keep an existing item; omit for a new one."),
        label: z.string().min(1).max(200),
        done: z.boolean().optional(),
      }),
    )
    .max(100)
    .nullable()
    .optional()
    .describe(
      "The WHOLE day-of checklist (a replacement — read the current list first and send it back with edits). null or [] clears; omit to keep.",
    ),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change makes sense. Shown to the couple."),
});

export const proposeSeatingPlanUpdate: AiTool<typeof inputSchema> = {
  name: "propose_seating_plan_update",
  description:
    "Propose an update to the PLAN-LEVEL seating notes and/or the day-of checklist (the ones at the top of /seating, not a single table's notes). The checklist is a whole-list replacement: read read_seating's plan.checklist first and send the full list back with your edits, reusing each item's id to preserve it. Set notes/checklist to null to clear. At least one of notes or checklist must be provided. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing seating plan update…",
  definition: {
    name: "propose_seating_plan_update",
    description:
      "Propose plan-level seating notes and/or the day-of checklist (whole-list replacement). null clears a field; omit to keep. Read read_seating's plan first to preserve existing checklist items. Include a rationale.",
    input_schema: {
      type: "object",
      properties: {
        notes: {
          type: ["string", "null"],
          description: "Plan-level seating notes. null clears; omit to keep.",
        },
        checklist: {
          type: ["array", "null"],
          description:
            "The whole day-of checklist (replacement). Each item: { id?, label, done? }. Reuse ids from read_seating to keep items. null/[] clears; omit to keep.",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Existing item id (omit for a new item)." },
              label: { type: "string" },
              done: { type: "boolean" },
            },
            required: ["label"],
          },
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this change makes sense.",
        },
      },
      required: ["rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    if (!(await canView(ctx.user, "seating"))) {
      return { ok: false, error: "The seating plan isn't visible to this user." };
    }

    if (input.notes === undefined && input.checklist === undefined) {
      return {
        ok: false,
        error: "Nothing to change — set notes and/or checklist (null to clear either).",
      };
    }

    const payload: Record<string, unknown> = {};
    if (input.notes !== undefined) payload.notes = input.notes;
    if (input.checklist !== undefined) {
      // Normalise to the stored {id, label, done} shape: keep the AI's id
      // when it round-tripped one from read_seating, else mint a fresh id;
      // default done:false. null stays null (clear).
      payload.checklist =
        input.checklist === null
          ? null
          : input.checklist.map((item) => ({
              id: item.id ?? randomUUID(),
              label: item.label,
              done: item.done ?? false,
            }));
    }

    const payloadResult = seatingPlanUpdateSchema.safeParse(payload);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "seating.plan.update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const bits: string[] = [];
    if (input.notes !== undefined) bits.push(input.notes === null ? "clears notes" : "sets notes");
    if (input.checklist !== undefined) {
      bits.push(
        input.checklist === null || input.checklist.length === 0
          ? "clears checklist"
          : `checklist (${input.checklist.length} items)`,
      );
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "seating.plan.update",
        title: "Update seating plan",
        detail: bits.join(" · "),
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
