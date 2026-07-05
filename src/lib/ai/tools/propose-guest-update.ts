import { z } from "zod";
import { db } from "@/lib/db";
import { guestUpdateSchema, SIDES } from "@/lib/ai/proposals/schemas";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// `rsvp` and `householdId` are deliberately absent. RSVP through
// updateGuest would desync the `attending` boolean (only setGuestRsvp
// writes both), so RSVP changes go through propose_guest_set_rsvp.
// updateGuest never writes householdId at all — household moves are
// human-only, and pretending otherwise here would produce proposals
// that silently don't move anyone.
const inputSchema = z.object({
  guestId: z
    .string()
    .min(1)
    .describe("The id of the guest to update — get this from a prior read_guests call."),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  side: z.enum(SIDES).optional(),
  isChild: z.boolean().optional(),
  needsHighchair: z.boolean().optional(),
  plusOneAllowed: z.boolean().optional(),
  plusOneName: z.string().max(200).optional().nullable(),
  role: z.string().max(80).optional().nullable(),
  dietary: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .describe("Comma-separated dietary requirements, e.g. 'vegetarian, nut allergy'."),
  notes: z.string().max(2000).optional().nullable(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this update makes sense. Shown to the couple."),
});

export const proposeGuestUpdate: AiTool<typeof inputSchema> = {
  name: "propose_guest_update",
  description:
    "Propose an update to an existing guest — name, contact details, side, child/highchair flags, +1 settings, role, dietary, or notes. Only include what you want changed; null clears a nullable field. RSVP changes go through propose_guest_set_rsvp, never here; household moves are human-only. Turning off plusOneAllowed (or clearing plusOneName) archives their materialised +1 and frees that seat. You MUST call read_guests first so you have a valid guestId.",
  inputSchema,
  progressLabel: "Proposing guest update…",
  definition: {
    name: "propose_guest_update",
    description:
      "Propose a partial update to an existing guest. Only include fields you want changed (null clears). RSVP changes use propose_guest_set_rsvp instead; households can't be changed here. Requires guestId from a prior read_guests call.",
    input_schema: {
      type: "object",
      properties: {
        guestId: { type: "string", description: "From read_guests output." },
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: ["string", "null"], description: "Pass null to clear." },
        phone: { type: ["string", "null"], description: "Pass null to clear." },
        side: { type: "string", enum: [...SIDES] },
        isChild: { type: "boolean" },
        needsHighchair: { type: "boolean" },
        plusOneAllowed: {
          type: "boolean",
          description:
            "Setting false archives any materialised +1 guest and frees their seat — say so in the rationale.",
        },
        plusOneName: {
          type: ["string", "null"],
          description: "Pass null to clear — clearing archives the materialised +1.",
        },
        role: {
          type: ["string", "null"],
          description: "e.g. 'Best Man', 'Maid of Honour'. Pass null to clear.",
        },
        dietary: {
          type: ["string", "null"],
          description: "Comma-separated requirements. Pass null to clear all of them.",
        },
        notes: { type: ["string", "null"], description: "Pass null to clear." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this update makes sense.",
        },
      },
      required: ["guestId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const { invalid, names } = await resolveRefs({ guestIds: [input.guestId] });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    // resolveRefs proved the row exists; this load is for the fields
    // the refusal rules below need.
    const guest = await db.guest.findUnique({
      where: { id: input.guestId },
      select: {
        firstName: true,
        lastName: true,
        archived: true,
        parentGuestId: true,
        plusOneAllowed: true,
        plusOneName: true,
      },
    });
    if (!guest) {
      return {
        ok: false,
        error: `No guest with id '${input.guestId}'. Call read_guests to get the correct id.`,
      };
    }
    const guestName = names.guests.get(input.guestId) ?? `${guest.firstName} ${guest.lastName}`;

    if (guest.archived) {
      return {
        ok: false,
        error: `"${guestName}" is archived. Archived guests can't be updated — the couple can restore them from the guest list first.`,
      };
    }

    // updateGuest silently force-clears +1 fields on a guest that IS a
    // +1 (parentGuestId set) — refuse loudly instead of proposing an
    // edit that would be discarded.
    if (
      guest.parentGuestId &&
      (input.plusOneAllowed !== undefined || input.plusOneName !== undefined)
    ) {
      return {
        ok: false,
        error: `"${guestName}" is themselves a plus-one — +1 settings live on the host guest. Edit the host guest instead.`,
      };
    }

    // Only fields the AI actually populated go in the patch — the
    // apply bridge merges against the live row, so `undefined` means
    // "keep the current value" and null means "clear".
    const patch: Record<string, unknown> = { guestId: input.guestId };
    if (input.firstName !== undefined) patch.firstName = input.firstName;
    if (input.lastName !== undefined) patch.lastName = input.lastName;
    if (input.email !== undefined) patch.email = input.email;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.side !== undefined) patch.side = input.side;
    if (input.isChild !== undefined) patch.isChild = input.isChild;
    if (input.needsHighchair !== undefined) patch.needsHighchair = input.needsHighchair;
    if (input.plusOneAllowed !== undefined) patch.plusOneAllowed = input.plusOneAllowed;
    if (input.plusOneName !== undefined) patch.plusOneName = input.plusOneName;
    if (input.role !== undefined) patch.role = input.role;
    if (input.dietary !== undefined) patch.dietary = input.dietary;
    if (input.notes !== undefined) patch.notes = input.notes;

    if (Object.keys(patch).length === 1) {
      return {
        ok: false,
        error:
          "The update contains no changes. Include at least one field to change (name, contact, side, flags, +1 settings, role, dietary, or notes).",
      };
    }

    const payloadResult = guestUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return {
        ok: false,
        error: `Payload validation failed: ${payloadResult.error.message}`,
      };
    }

    // Flipping plusOneAllowed off (or clearing the name) archives the
    // materialised +1 row and frees their seat via syncPlusOne — the
    // reviewer must see that consequence on the card, not discover it
    // after Apply.
    let plusOneWarning: string | null = null;
    if (input.plusOneAllowed === false || input.plusOneName === null) {
      const plusOne = await db.guest.findFirst({
        where: { parentGuestId: input.guestId, archived: false },
        select: { firstName: true, lastName: true },
      });
      if (plusOne) {
        plusOneWarning = `this will archive their plus-one ${`${plusOne.firstName} ${plusOne.lastName}`.trim()} and free that seat`;
      }
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "guest.update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const touched = Object.keys(patch).filter((k) => k !== "guestId");
    const detail = `sets ${touched.join(", ")}${plusOneWarning ? ` · ${plusOneWarning}` : ""}`;

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "guest.update",
        title: `Update "${guestName}"`,
        detail,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
