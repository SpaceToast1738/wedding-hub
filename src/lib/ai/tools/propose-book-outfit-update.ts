import { z } from "zod";
import { db } from "@/lib/db";
import { bookOutfitUpdateSchema, OUTFIT_ITEM_STATUSES } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookOutfitUpdateSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change helps. Shown to the couple."),
});

// Item ids are deliberately NOT validated here — the apply bridge
// re-checks them against the live rows, so a stale id fails the apply
// cleanly instead of blocking an otherwise-valid proposal.
export const proposeBookOutfitUpdate: AiTool<typeof inputSchema> = {
  name: "propose_book_outfit_update",
  description:
    "Propose changes to an OUTFIT Wedding Book card — person, role, notes, and garment-item deltas (add/update/remove). Writes a proposal — does NOT change the card. Express only what changes; anything you don't name is preserved; you cannot see or change money, photos, or layout (costs and budget links are carried through untouched). Item ids come from read_book_card — call it in the SAME turn.",
  inputSchema,
  progressLabel: "Proposing outfit update…",
  definition: {
    name: "propose_book_outfit_update",
    description:
      "Propose an update to an OUTFIT card. Writes a proposal — does not change the card directly. Express only what changes; omitted fields and unnamed items are preserved. Costs and photos are not visible or writable. itemId values come from read_book_card in this same turn.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "OUTFIT card id from read_book / read_book_card — never invented.",
        },
        personName: {
          type: ["string", "null"],
          description: "Who the outfit is for. null clears.",
        },
        role: { type: ["string", "null"], description: "e.g. 'Bride', 'Best Man'. null clears." },
        notes: { type: ["string", "null"], description: "Card notes. null clears." },
        addItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemLabel: { type: "string", description: "e.g. 'Dress', 'Shoes', 'Veil'." },
              description: { type: ["string", "null"] },
              supplier: { type: ["string", "null"], description: "Free-text supplier name." },
              website: { type: ["string", "null"] },
              status: { type: ["string", "null"], enum: [...OUTFIT_ITEM_STATUSES, null] },
              notes: { type: ["string", "null"] },
            },
            required: ["itemLabel"],
          },
          description: "New garment items.",
        },
        updateItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemId: { type: "string", description: "From read_book_card, this same turn." },
              itemLabel: { type: "string" },
              description: { type: ["string", "null"] },
              supplier: { type: ["string", "null"] },
              website: { type: ["string", "null"] },
              status: { type: ["string", "null"], enum: [...OUTFIT_ITEM_STATUSES, null] },
              notes: { type: ["string", "null"] },
            },
            required: ["itemId"],
          },
          description: "Patches to existing items — only the fields you set change.",
        },
        removeItemIds: {
          type: "array",
          items: { type: "string" },
          description: "Items to delete, by itemId from read_book_card.",
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
          "The update contains no changes. Include at least one field or item delta to change.",
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
    if (card.kind !== "OUTFIT") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not OUTFIT — propose_book_outfit_update only works on OUTFIT cards.`,
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

    const payloadResult = bookOutfitUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.outfit.update",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.outfit.update",
        title: `Update outfit "${card.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
