import { z } from "zod";
import { db } from "@/lib/db";
import { guestArchiveSchema } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// Bridges to deleteGuest — a SOFT archive, reversible from the guest
// list. Hard deletion exists as propose_guest_hard_delete since
// v2.8.0 (couple-only, snapshot-backed) — but THIS tool stays the
// right default; the hard-delete description says so too.
const inputSchema = z.object({
  guestId: z
    .string()
    .min(1)
    .describe("The id of the guest to archive — get this from a prior read_guests call."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this guest should be archived. Shown to the couple.",
    ),
});

export const proposeGuestArchive: AiTool<typeof inputSchema> = {
  name: "propose_guest_archive",
  description:
    "Propose archiving a guest — a soft, reversible removal from the active list (the couple can restore them later). Archiving frees their seat and archives their +1 in the same step. Use when a guest can no longer come and should stop counting in totals; for a simple 'can't make it' answer, propose_guest_set_rsvp DECLINED is usually right instead. You MUST call read_guests first so you have a valid guestId.",
  inputSchema,
  progressLabel: "Proposing guest archive…",
  definition: {
    name: "propose_guest_archive",
    description:
      "Propose soft-archiving a guest (reversible; frees their seat and archives their +1). Requires guestId from a prior read_guests call.",
    input_schema: {
      type: "object",
      properties: {
        guestId: { type: "string", description: "From read_guests output." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this guest should be archived.",
        },
      },
      required: ["guestId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const guest = await db.guest.findUnique({
      where: { id: input.guestId },
      select: {
        firstName: true,
        lastName: true,
        archived: true,
        tableSeatId: true,
      },
    });
    if (!guest) {
      return {
        ok: false,
        error: `No guest with id '${input.guestId}'. Call read_guests to get the correct id.`,
      };
    }
    const guestName = `${guest.firstName} ${guest.lastName}`.trim();

    // Archiving an archived guest is a pure no-op — refuse rather than
    // queue a proposal the reviewer can't act on.
    if (guest.archived) {
      return {
        ok: false,
        error: `"${guestName}" is already archived — nothing to do.`,
      };
    }

    const payloadResult = guestArchiveSchema.safeParse({ guestId: input.guestId });
    if (!payloadResult.success) {
      return {
        ok: false,
        error: `Payload validation failed: ${payloadResult.error.message}`,
      };
    }

    const plusOne = await db.guest.findFirst({
      where: { parentGuestId: input.guestId, archived: false },
      select: { firstName: true, lastName: true },
    });

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "guest.archive",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detailBits = ["soft archive — reversible from the guest list"];
    if (guest.tableSeatId) detailBits.push("frees their seat");
    if (plusOne) {
      detailBits.push(
        `also archives their plus-one ${`${plusOne.firstName} ${plusOne.lastName}`.trim()}`,
      );
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "guest.archive",
        title: `Archive "${guestName}"`,
        detail: detailBits.join(" · "),
        message: "Archive proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
