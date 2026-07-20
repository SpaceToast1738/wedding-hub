// v2.9.2: proposal-gated send of the RSVP / overdue-task nudge digest —
// the single most side-effectful propose kind, because Apply actually
// EMAILS the couple + planners (read_nudge_preview only previews it).
//
// THREE gates stack, most-specific first:
//   1. canWrite (ai_write EDIT) — every propose tool.
//   2. ctx.canProposeSend — a per-token capability flag (default off).
//      The tool is only LISTED when the flag is set (registry), so this
//      handler check is belt-and-braces, mirroring apply-proposals.ts's
//      canApply hard-refusal.
//   3. isCouple — the digest is couple-tier (same wall as
//      read_nudge_preview and the /settings send button).
//
// The payload is a PROPOSE-TIME SNAPSHOT so the /ai reviewer sees exactly
// who gets emailed (recipients) and how many items are in the digest
// (count + a small preview). The apply path re-derives eligibility from
// live data at send time — see nudge.send in execute.ts + sendDigestCore.

import { z } from "zod";
import { db } from "@/lib/db";
import { nudgeSendSchema, NUDGE_DIGEST_KINDS } from "@/lib/ai/proposals/schemas";
import { getDigestPreviewCore, getDigestRecipientsCore } from "@/lib/core/nudge";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = z.object({
  digestKind: z
    .enum(NUDGE_DIGEST_KINDS)
    .describe(
      "Which digest to send: 'rsvp' (guests still to chase) or 'tasks' (overdue tasks).",
    ),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY it's worth sending now. Shown to the couple."),
});

export const proposeNudgeSend: AiTool<typeof inputSchema> = {
  name: "propose_nudge_send",
  description:
    "Propose SENDING the nudge digest (the same one read_nudge_preview shows) — an RSVP-chase list or an overdue-task list — by email to the couple + planners (never guests). This is the most side-effectful action available: Applying it actually sends email. It creates a proposal a human Applies on /ai (or a token with apply rights self-applies). The recipient list and item count are snapshotted for the reviewer; the actual send recomputes eligibility so nobody who has since responded gets chased, and the 7-day cooldown is always respected. Couple-only, and requires the 'can propose sends' token capability. Preview with read_nudge_preview first, and don't queue a send when nothing is eligible.",
  inputSchema,
  progressLabel: "Proposing to send the nudge digest…",
  definition: {
    name: "propose_nudge_send",
    description:
      "Propose sending the RSVP-chase or overdue-task nudge digest by email to the couple + planners. Apply actually sends. Couple-only; requires the 'can propose sends' token capability. Preview with read_nudge_preview first.",
    input_schema: {
      type: "object",
      properties: {
        digestKind: {
          type: "string",
          enum: [...NUDGE_DIGEST_KINDS],
          description: "'rsvp' (guests to chase) or 'tasks' (overdue tasks).",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why it's worth sending now.",
        },
      },
      required: ["digestKind", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    // Belt-and-braces (the registry already hides this tool without the
    // flag) — mirrors apply-proposals.ts refusing without canApply.
    if (!ctx.canProposeSend) {
      return {
        ok: false,
        error:
          "This token can't propose sends. Ask the couple to enable 'Can propose sends' for it in Settings → MCP tokens.",
      };
    }
    if (!ctx.user.isCouple) {
      return { ok: false, error: "The nudge digest is couple-only." };
    }

    const [preview, recipients] = await Promise.all([
      getDigestPreviewCore(),
      getDigestRecipientsCore(),
    ]);

    const side = input.digestKind === "rsvp" ? preview.rsvp : preview.tasks;
    const count = side.count;
    const previewList =
      input.digestKind === "rsvp"
        ? preview.rsvp.firstFew.map((g) => g.name)
        : preview.tasks.firstFew.map((t) => t.title);

    if (count === 0) {
      return {
        ok: false,
        error:
          input.digestKind === "rsvp"
            ? "Nothing to send — no guests are eligible for an RSVP chase right now (all confirmed, or nudged within the last 7 days)."
            : "Nothing to send — no overdue tasks are eligible for a reminder right now.",
      };
    }
    if (recipients.length === 0) {
      return {
        ok: false,
        error:
          "No couple/planner accounts have an email address on file — there's nobody to send the digest to.",
      };
    }

    const payloadResult = nudgeSendSchema.safeParse({
      digestKind: input.digestKind,
      recipients,
      count,
      preview: previewList.slice(0, 10),
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "nudge.send",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const label = input.digestKind === "rsvp" ? "RSVP chase" : "overdue-task reminder";
    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "nudge.send",
        title: `Send the ${label} digest`,
        detail: `Emails ${recipients.length} recipient${recipients.length === 1 ? "" : "s"} (${recipients.join(", ")}); ${count} item${count === 1 ? "" : "s"} at propose time`,
        message:
          "Proposal queued. Applying it SENDS the email — the couple review who gets it on /ai first (the send recomputes eligibility at that point).",
      },
    };
  },
};
