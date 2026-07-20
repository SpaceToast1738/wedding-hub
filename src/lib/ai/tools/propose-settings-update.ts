// v2.9.2: tightly-scoped wedding-settings patch. ONLY the wedding date
// and the AI monthly cap are AI-writable — venue / couple / names stay
// a human-only whole-record form edit. Couple-only (the apply path
// re-checks isCouple). A date change ripples into the schedule, stays
// and payment due dates; the description tells the agent to batch those
// consistency fixes in the same batchKey (the MCP route's shared-batch
// mechanism), or say what was left stale.

import { z } from "zod";
import { db } from "@/lib/db";
import { settingsUpdateSchema } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = z.object({
  weddingDate: z
    .string()
    .min(1)
    .max(40)
    .optional()
    .describe(
      "New wedding date — an ISO date (YYYY-MM-DD) or full ISO timestamp. A change here RIPPLES into the schedule, stays and payment due dates; propose those fixes in the same batch.",
    ),
  aiMonthlyCapPence: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullable()
    .optional()
    .describe(
      "AI monthly spend cap in integer pence (£30 = 3000). null clears the override so it falls back to the env default. Omit to leave it unchanged.",
    ),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change makes sense. Shown to the couple."),
});

export const proposeSettingsUpdate: AiTool<typeof inputSchema> = {
  name: "propose_settings_update",
  description:
    "Propose a change to the wedding settings — ONLY the wedding date and/or the AI monthly spend cap (venue, couple names and the API key are not editable here). Couple-only. Changing the wedding date ripples into the schedule, stays and payment due dates — propose those consistency fixes in the same batch (shared batchKey), or say what you left stale. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing settings change…",
  definition: {
    name: "propose_settings_update",
    description:
      "Propose a wedding-settings change — wedding date and/or AI monthly cap only. Couple-only. A date change ripples into schedule/stays/payments; batch those fixes. Include a rationale.",
    input_schema: {
      type: "object",
      properties: {
        weddingDate: {
          type: "string",
          description: "New wedding date (ISO date or timestamp). Ripples into schedule/stays/payments.",
        },
        aiMonthlyCapPence: {
          type: ["integer", "null"],
          description: "AI monthly cap in integer pence (£30 = 3000). null clears the override; omit to keep.",
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

    // Couple-only: wedding settings are a couple-tier surface. Refuse
    // early (the apply path re-checks isCouple as belt-and-braces).
    if (!ctx.user.isCouple) {
      return { ok: false, error: "Wedding settings are couple-only." };
    }

    if (input.weddingDate === undefined && input.aiMonthlyCapPence === undefined) {
      return {
        ok: false,
        error: "Nothing to change — set weddingDate and/or aiMonthlyCapPence.",
      };
    }

    // Validate the date at propose time so the reviewer never sees a
    // proposal that can't apply.
    if (input.weddingDate !== undefined) {
      const d = new Date(input.weddingDate);
      if (Number.isNaN(d.getTime())) {
        return {
          ok: false,
          error: `Invalid wedding date: ${input.weddingDate}. Use YYYY-MM-DD or an ISO timestamp.`,
        };
      }
    }

    const payload: Record<string, unknown> = {};
    if (input.weddingDate !== undefined) payload.weddingDate = input.weddingDate;
    if (input.aiMonthlyCapPence !== undefined) payload.aiMonthlyCapPence = input.aiMonthlyCapPence;

    const payloadResult = settingsUpdateSchema.safeParse(payload);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "settings.update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const bits: string[] = [];
    if (input.weddingDate !== undefined) bits.push(`wedding date → ${input.weddingDate}`);
    if (typeof input.aiMonthlyCapPence === "number") {
      bits.push(`AI cap → £${(input.aiMonthlyCapPence / 100).toFixed(2)}`);
    } else if (input.aiMonthlyCapPence === null) {
      bits.push("clears the AI cap override");
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "settings.update",
        title: "Update wedding settings",
        detail: bits.join(" · "),
        message:
          input.weddingDate !== undefined
            ? "Proposal queued. A date change ripples into the schedule, stays and payment due dates — propose those fixes too. The couple will Apply or Dismiss."
            : "Proposal queued. The couple will Apply or Dismiss it.",
      },
    };
  },
};
