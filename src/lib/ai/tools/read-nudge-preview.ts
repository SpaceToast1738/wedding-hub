// v2.8.1 (Tier 2, Slice B): couple-only read of the nudge-digest
// preview. Answers "how many RSVPs still need chasing / how many tasks
// are overdue and eligible for a reminder?" — the same numbers the
// /settings Nudges panel shows before the couple clicks send.
//
// PREVIEW ONLY. This tool has ZERO side effects: it never sends the
// digest, never stamps lastNudgedAt, never audits. Sending stays a
// human action on /settings (v2.8.1 decision: no propose_nudge, no
// self-apply of outbound email). The digest recipients are the couple
// + planners, never guests.

import { z } from "zod";
import { getDigestPreviewCore } from "@/lib/core/nudge";
import type { AiTool } from "./types";

const inputSchema = z.object({});

export const readNudgePreview: AiTool<typeof inputSchema> = {
  name: "read_nudge_preview",
  description:
    "Preview the nudge digest without sending it: how many guests still need an RSVP chase (PENDING/MAYBE, not nudged in the last 7 days) and how many tasks are overdue and reminder-eligible, plus the first few of each. Read-only — it does NOT send any email or change anything; the couple sends the digest themselves from Settings. Couple-only. Use this to answer 'who still needs chasing?' or 'is it worth sending a reminder right now?'.",
  inputSchema,
  progressLabel: "Previewing the nudge digest…",
  definition: {
    name: "read_nudge_preview",
    description:
      "Preview the nudge digest (RSVPs still to chase + overdue tasks eligible for a reminder) WITHOUT sending it. Read-only, zero side effects. Couple-only.",
    input_schema: { type: "object", properties: {} },
  },
  async handler(_input, ctx) {
    // Couple-only: this surfaces an outbound-email preview across the
    // whole guest + task list, so it bypasses the section gate and
    // hard-checks isCouple (mirrors the action's own gate).
    if (!ctx.user.isCouple) {
      return { ok: false, error: "The nudge digest preview is couple-only." };
    }

    const preview = await getDigestPreviewCore();

    return {
      ok: true,
      data: {
        // Both counts are the eligible totals (after the 7-day cooldown
        // filter); firstFew is a small sample for context, not the full
        // list.
        rsvp: {
          count: preview.rsvp.count,
          firstFew: preview.rsvp.firstFew,
        },
        tasks: {
          count: preview.tasks.count,
          firstFew: preview.tasks.firstFew.map((t) => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
          })),
        },
      },
    };
  },
};
