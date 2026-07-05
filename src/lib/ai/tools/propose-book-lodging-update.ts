import { z } from "zod";
import { db } from "@/lib/db";
import { bookLodgingUpdateSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookLodgingUpdateSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change helps. Shown to the couple."),
});

// Item ids are deliberately NOT validated here — the apply bridge
// re-checks them against the live rows, so a stale id fails the apply
// cleanly instead of blocking an otherwise-valid proposal.
export const proposeBookLodgingUpdate: AiTool<typeof inputSchema> = {
  name: "propose_book_lodging_update",
  description:
    "Propose changes to a LODGING_GUIDE Wedding Book card (nearby hotels/B&Bs recommended to guests) — notes plus option deltas (add/update/remove). Writes a proposal — does NOT change the card. Express only what changes; anything you don't name is preserved; you cannot see or change money, photos, or layout. priceRangeLabel is a coarse band like '£', '££' or '£££' — not an amount. Item ids come from read_book_card — call it in the SAME turn.",
  inputSchema,
  progressLabel: "Proposing lodging update…",
  definition: {
    name: "propose_book_lodging_update",
    description:
      "Propose an update to a LODGING_GUIDE card (guest accommodation options). Writes a proposal — does not change the card directly. Express only what changes; omitted fields and unnamed options are preserved. itemId values come from read_book_card in this same turn.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "LODGING_GUIDE card id from read_book / read_book_card — never invented.",
        },
        notes: { type: ["string", "null"], description: "Card notes. null clears." },
        addItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Hotel/B&B name." },
              distanceFromVenue: {
                type: ["string", "null"],
                description: "e.g. '10 min drive from Alveston Manor'.",
              },
              priceRangeLabel: {
                type: ["string", "null"],
                description: "Coarse band: '£', '££' or '£££'.",
              },
              phone: { type: ["string", "null"] },
              website: { type: ["string", "null"] },
              groupRateCode: {
                type: ["string", "null"],
                description: "Booking code for the wedding block, if any.",
              },
              notes: { type: ["string", "null"] },
            },
            required: ["name"],
          },
          description: "New accommodation options.",
        },
        updateItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemId: { type: "string", description: "From read_book_card, this same turn." },
              name: { type: "string" },
              distanceFromVenue: { type: ["string", "null"] },
              priceRangeLabel: { type: ["string", "null"] },
              phone: { type: ["string", "null"] },
              website: { type: ["string", "null"] },
              groupRateCode: { type: ["string", "null"] },
              notes: { type: ["string", "null"] },
            },
            required: ["itemId"],
          },
          description: "Patches to existing options — only the fields you set change.",
        },
        removeItemIds: {
          type: "array",
          items: { type: "string" },
          description: "Options to delete, by itemId from read_book_card.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this change helps.",
        },
      },
      required: ["subsectionId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const { rationale, ...patch } = input;
    // Structural no-op guard: ids alone (or empty delta arrays) propose
    // nothing — refuse instead of queueing review noise.
    const hasChange = Object.entries(patch).some(
      ([key, value]) =>
        key !== "subsectionId" &&
        value !== undefined &&
        !(Array.isArray(value) && value.length === 0),
    );
    if (!hasChange) {
      return {
        ok: false,
        error:
          "The update contains no changes. Include at least one field or option delta to change.",
      };
    }

    const card = await db.bookSubsection.findUnique({
      where: { id: input.subsectionId },
      select: {
        title: true,
        kind: true,
        visibility: true,
        section: { select: { visibility: true } },
      },
    });
    if (!card) {
      return { ok: false, error: unknownIdsError([`bookSubsection:${input.subsectionId}`]) };
    }
    if (card.kind !== "LODGING_GUIDE") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not LODGING_GUIDE — propose_book_lodging_update only works on LODGING_GUIDE cards.`,
      };
    }
    // Mirrors assertBookCardWritable in @/lib/ai/apply/common — checked at
    // propose time too so a non-couple user can't queue changes against
    // cards they can't see.
    if (
      !ctx.user.isCouple &&
      (card.visibility === "COUPLE_ONLY" || card.section.visibility === "COUPLE_ONLY")
    ) {
      return {
        ok: false,
        error: "This card is couple-only — only the couple can propose changes to it.",
      };
    }

    const payloadResult = bookLodgingUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.lodging.update",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.lodging.update",
        title: `Update lodging guide "${card.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
