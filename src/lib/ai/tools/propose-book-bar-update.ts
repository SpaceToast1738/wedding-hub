import { z } from "zod";
import { db } from "@/lib/db";
import { bookBarUpdateSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookBarUpdateSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change helps. Shown to the couple."),
});

// Item ids are deliberately NOT validated here — the apply bridge
// re-checks them against the live rows, so a stale id fails the apply
// cleanly instead of blocking an otherwise-valid proposal.
export const proposeBookBarUpdate: AiTool<typeof inputSchema> = {
  name: "propose_book_bar_update",
  description:
    "Propose changes to a BAR Wedding Book card — bar type, toast drink, notes, and drink-item deltas (add/update/remove). Writes a proposal — does NOT change the card. Express only what changes; anything you don't name is preserved; you cannot see or change money, photos, or layout (costs, tab limits, corkage and budget links are carried through untouched). Item ids come from read_book_card — call it in the SAME turn.",
  inputSchema,
  progressLabel: "Proposing bar update…",
  definition: {
    name: "propose_book_bar_update",
    description:
      "Propose an update to a BAR card. Writes a proposal — does not change the card directly. Express only what changes; omitted fields and unnamed items are preserved. Costs and budget links are not visible or writable. itemId values come from read_book_card in this same turn.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "BAR card id from read_book / read_book_card — never invented.",
        },
        barType: {
          type: ["string", "null"],
          description: "e.g. 'Open bar', 'Cash bar', 'Limited tab'. null clears.",
        },
        toastDrink: {
          type: ["string", "null"],
          description: "What's poured for the toasts. null clears.",
        },
        notes: { type: ["string", "null"], description: "Card notes. null clears." },
        addItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string", description: "e.g. 'Beer', 'Wine', 'Soft drinks'." },
              name: { type: "string", description: "The drink, e.g. 'Prosecco'." },
              quantityPlanned: { type: ["number", "null"] },
              unit: { type: ["string", "null"], description: "e.g. 'bottles', 'cases'." },
              supplier: { type: ["string", "null"], description: "Free-text supplier name." },
              website: { type: ["string", "null"] },
              timing: {
                type: ["string", "null"],
                description: "When it's served, e.g. 'Reception drinks'.",
              },
              notes: { type: ["string", "null"] },
            },
            required: ["category", "name"],
          },
          description: "New drink items.",
        },
        updateItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemId: { type: "string", description: "From read_book_card, this same turn." },
              category: { type: "string" },
              name: { type: "string" },
              quantityPlanned: { type: ["number", "null"] },
              unit: { type: ["string", "null"] },
              supplier: { type: ["string", "null"] },
              website: { type: ["string", "null"] },
              timing: { type: ["string", "null"] },
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
    if (card.kind !== "BAR") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not BAR — propose_book_bar_update only works on BAR cards.`,
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

    const payloadResult = bookBarUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.bar.update",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.bar.update",
        title: `Update bar "${card.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
