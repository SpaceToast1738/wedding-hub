import { z } from "zod";
import { db } from "@/lib/db";
import { guestHardDeleteSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import {
  clipDisplay,
  DELETE_PROPOSED_MESSAGE,
  reasonFromRationale,
} from "./propose-delete-common";
import type { AiTool } from "./types";

// v2.8.0: destructive kind. Bridges to the guest.hard_delete apply
// handler (src/lib/ai/apply/deletes.ts). Distinct from
// propose_guest_archive (the reversible soft archive, which stays the
// default): this one WIPES the row. Both the propose gate here and
// the apply handler mirror hardDeleteGuest's rules — couple-only,
// archived rows only.
const inputSchema = z.object({
  guestId: z
    .string()
    .min(1)
    .describe("The id of the ARCHIVED guest to permanently delete — from a prior read_guests call."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this guest row should be permanently wiped. Shown to the couple.",
    ),
});

export const proposeGuestHardDelete: AiTool<typeof inputSchema> = {
  name: "propose_guest_hard_delete",
  description:
    "Propose PERMANENTLY deleting an ARCHIVED guest from the database — NOT the reversible archive (that's propose_guest_archive, which is almost always the right call). This is destructive: applying wipes the guest row plus their plus-one rows and song requests for good (a JSON snapshot is kept on the proposal for manual recovery). Couple-only, and refused unless the guest is already archived — the intended use is cleaning up typo'd or duplicate rows, never handling a 'can't come' answer. You MUST call read_guests first so you have a valid guestId.",
  inputSchema,
  progressLabel: "Proposing guest hard-delete…",
  definition: {
    name: "propose_guest_hard_delete",
    description:
      "Propose permanently wiping an ARCHIVED guest row (snapshot-backed, no undo; also removes their +1 rows and song requests). Couple-only. Prefer propose_guest_archive for anything reversible. Requires guestId from a prior read_guests call.",
    input_schema: {
      type: "object",
      properties: {
        guestId: { type: "string", description: "From read_guests output. Must be archived." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this row should be wiped.",
        },
      },
      required: ["guestId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    // Couple-only at propose time too — a non-couple caller's proposal
    // could never be applied (the apply handler mirrors
    // hardDeleteGuest's couple gate), so refuse before queueing it.
    if (!ctx.user.isCouple) {
      return {
        ok: false,
        error:
          "Hard-deleting a guest is couple-only — propose_guest_archive is the reversible alternative available to you.",
      };
    }

    const guest = await db.guest.findUnique({
      where: { id: input.guestId },
      select: {
        firstName: true,
        lastName: true,
        archived: true,
        _count: { select: { plusOnes: true, songRequests: true } },
      },
    });
    if (!guest) {
      return { ok: false, error: unknownIdsError([`guest:${input.guestId}`]) };
    }
    const guestName = `${guest.firstName} ${guest.lastName}`.trim();

    // Mirrors hardDeleteGuest: only archived rows can be wiped. Refuse
    // here rather than queue a proposal that can only fail at apply.
    if (!guest.archived) {
      return {
        ok: false,
        error: `"${guestName}" is not archived. Archive them first (propose_guest_archive) — only archived guests can be permanently deleted.`,
      };
    }

    const payloadResult = guestHardDeleteSchema.safeParse({
      guestId: input.guestId,
      targetLabel: clipDisplay(guestName, 200),
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
        kind: "guest.hard_delete",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detailBits = ["permanent — NOT the reversible archive", "snapshot kept"];
    if (guest._count.plusOnes) {
      detailBits.push(`${guest._count.plusOnes} plus-one row(s) deleted with them`);
    }
    if (guest._count.songRequests) {
      detailBits.push(`${guest._count.songRequests} song request(s) deleted with them`);
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "guest.hard_delete",
        title: `Hard-delete "${guestName}"`,
        detail: detailBits.join(" · "),
        message: DELETE_PROPOSED_MESSAGE,
      },
    };
  },
};
