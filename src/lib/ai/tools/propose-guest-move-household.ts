import { z } from "zod";
import { db } from "@/lib/db";
import { guestMoveHouseholdSchema } from "@/lib/ai/proposals/schemas";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// Genuinely new capability — no human mutator moves a guest between
// households (the guest form has no household picker). Both the guest
// and the destination household are validated by resolveRefs before a
// proposal is written. A materialised +1 follows its host, so we refuse
// to move a +1 directly (edit the host instead) and note when a +1 will
// travel along.
const inputSchema = z.object({
  guestId: z
    .string()
    .min(1)
    .describe("The id of the guest to move — get this from a prior read_guests call."),
  householdId: z
    .string()
    .min(1)
    .describe("The id of the destination household — get this from a prior read_guests call."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this guest should move households. Shown to the couple.",
    ),
});

export const proposeGuestMoveHousehold: AiTool<typeof inputSchema> = {
  name: "propose_guest_move_household",
  description:
    "Propose moving a guest into a different household. Moving a host guest also moves their materialised +1. You cannot move a +1 directly — move the host instead. **This does NOT move anyone** — it writes a proposal the couple will Apply or Dismiss. You MUST call read_guests first so you have a valid guestId and householdId.",
  inputSchema,
  progressLabel: "Proposing household move…",
  definition: {
    name: "propose_guest_move_household",
    description:
      "Propose moving a guest into a different household (a host's +1 travels with them). Writes a proposal — does not move anyone directly. Requires guestId + householdId from a prior read_guests call.",
    input_schema: {
      type: "object",
      properties: {
        guestId: { type: "string", description: "From read_guests output." },
        householdId: {
          type: "string",
          description: "The destination household's id, from read_guests output.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this guest should move households.",
        },
      },
      required: ["guestId", "householdId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const { invalid, names } = await resolveRefs({
      guestIds: [input.guestId],
      householdIds: [input.householdId],
    });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    const guest = await db.guest.findUnique({
      where: { id: input.guestId },
      select: {
        firstName: true,
        lastName: true,
        archived: true,
        parentGuestId: true,
        householdId: true,
      },
    });
    if (!guest) {
      return {
        ok: false,
        error: `No guest with id '${input.guestId}'. Call read_guests to get the correct id.`,
      };
    }
    const guestName = names.guests.get(input.guestId) ?? `${guest.firstName} ${guest.lastName}`.trim();
    const targetLabel = names.households.get(input.householdId);

    if (guest.archived) {
      return {
        ok: false,
        error: `"${guestName}" is archived. Archived guests can't be moved — the couple can restore them from the guest list first.`,
      };
    }
    // A +1 follows its host's household automatically; moving one
    // directly would be silently undone by syncPlusOne on the next host
    // edit. Refuse and point at the host.
    if (guest.parentGuestId) {
      return {
        ok: false,
        error: `"${guestName}" is themselves a plus-one — they follow their host's household. Move the host guest instead.`,
      };
    }
    if (guest.householdId === input.householdId) {
      return {
        ok: false,
        error: `"${guestName}" is already in the "${targetLabel ?? "target"}" household — nothing to move.`,
      };
    }

    const payloadResult = guestMoveHouseholdSchema.safeParse({
      guestId: input.guestId,
      householdId: input.householdId,
      targetLabel,
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
        kind: "guest.move_household",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    // Flag a +1 that will travel with the host so the reviewer sees it
    // on the card.
    const plusOne = await db.guest.findFirst({
      where: { parentGuestId: input.guestId, archived: false },
      select: { firstName: true, lastName: true },
    });
    const detailBits = [`→ "${targetLabel ?? "another household"}"`];
    if (plusOne) {
      detailBits.push(
        `also moves their +1 ${`${plusOne.firstName} ${plusOne.lastName}`.trim()}`,
      );
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "guest.move_household",
        title: `Move "${guestName}"`,
        detail: detailBits.join(" · "),
        message: "Move proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
