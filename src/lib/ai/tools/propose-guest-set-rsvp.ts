import { z } from "zod";
import { db } from "@/lib/db";
import { guestSetRsvpSchema, RSVP_STATUSES } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// The ONLY AI path for RSVP changes. The apply bridge calls
// setGuestRsvp, which keeps the `attending` boolean in sync and
// cascades to the +1 via syncPlusOne — routing RSVP through
// guest.update would leave `attending` stale.
const inputSchema = z.object({
  guestId: z
    .string()
    .min(1)
    .describe("The id of the guest — get this from a prior read_guests call."),
  rsvp: z.enum(RSVP_STATUSES),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY, e.g. what the guest said. Shown to the couple."),
});

export const proposeGuestSetRsvp: AiTool<typeof inputSchema> = {
  name: "propose_guest_set_rsvp",
  description:
    "Propose an RSVP change for a guest (PENDING / ATTENDING / DECLINED / MAYBE). This is the only correct way to change an RSVP — it keeps the attending flag in sync and cascades the host's RSVP to their +1. You MUST call read_guests first so you have a valid guestId.",
  inputSchema,
  progressLabel: "Proposing RSVP change…",
  definition: {
    name: "propose_guest_set_rsvp",
    description:
      "Propose setting a guest's RSVP status. A host's RSVP cascades to their +1. Requires guestId from a prior read_guests call.",
    input_schema: {
      type: "object",
      properties: {
        guestId: { type: "string", description: "From read_guests output." },
        rsvp: { type: "string", enum: [...RSVP_STATUSES] },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why — e.g. what the guest told the couple.",
        },
      },
      required: ["guestId", "rsvp", "rationale"],
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
        rsvp: true,
        parentGuestId: true,
      },
    });
    if (!guest) {
      return {
        ok: false,
        error: `No guest with id '${input.guestId}'. Call read_guests to get the correct id.`,
      };
    }
    const guestName = `${guest.firstName} ${guest.lastName}`.trim();

    if (guest.archived) {
      return {
        ok: false,
        error: `"${guestName}" is archived — archived guests don't RSVP. The couple can restore them from the guest list first.`,
      };
    }
    if (guest.rsvp === input.rsvp) {
      return {
        ok: false,
        error: `"${guestName}" is already ${input.rsvp} — proposing the same status again would be a no-op.`,
      };
    }

    const payloadResult = guestSetRsvpSchema.safeParse({
      guestId: input.guestId,
      rsvp: input.rsvp,
    });
    if (!payloadResult.success) {
      return {
        ok: false,
        error: `Payload validation failed: ${payloadResult.error.message}`,
      };
    }

    // Surface the +1 cascade on the card: the host's RSVP is the
    // source of truth for the +1's RSVP (syncPlusOne overwrites it).
    const plusOne = await db.guest.findFirst({
      where: { parentGuestId: input.guestId, archived: false },
      select: { firstName: true, lastName: true },
    });

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "guest.set_rsvp",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detailBits = [`${guest.rsvp} → ${input.rsvp}`];
    if (plusOne) {
      detailBits.push(
        `host RSVP cascades to their +1 ${`${plusOne.firstName} ${plusOne.lastName}`.trim()}`,
      );
    }
    if (guest.parentGuestId) {
      detailBits.push("this guest is a +1 — the host's next RSVP change will overwrite it");
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "guest.set_rsvp",
        title: `Set RSVP for "${guestName}" → ${input.rsvp}`,
        detail: detailBits.join(" · "),
        message: "RSVP change proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
