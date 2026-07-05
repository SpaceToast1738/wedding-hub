import { z } from "zod";
import { db } from "@/lib/db";
import { bookWpAddItemSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookWpAddItemSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this item belongs on the card. Shown to the couple."),
});

export const proposeBookWpAddItem: AiTool<typeof inputSchema> = {
  name: "propose_book_weddingparty_add_item",
  description:
    "Propose adding an item (column) to a WEDDING_PARTY Wedding Book card — e.g. 'Cufflinks' or 'Hair trial'. Writes a proposal — does NOT change the card; the couple will Apply or Dismiss it. Every member gets an empty status cell for the new item; set them afterwards with propose_book_weddingparty_set_cell once read_book_card shows the new item's id.",
  inputSchema,
  progressLabel: "Proposing wedding-party item…",
  definition: {
    name: "propose_book_weddingparty_add_item",
    description:
      "Propose a new item column on a WEDDING_PARTY card. Writes a proposal — does not change the card directly. The item starts with no status cells filled in.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "WEDDING_PARTY card id from read_book / read_book_card — never invented.",
        },
        label: { type: "string", description: "The item, e.g. 'Cufflinks'." },
        notes: {
          type: ["string", "null"],
          description: "Optional item note, e.g. where it's being bought.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this item belongs on the card.",
        },
      },
      required: ["subsectionId", "label", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

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
    if (card.kind !== "WEDDING_PARTY") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not WEDDING_PARTY — propose_book_weddingparty_add_item only works on WEDDING_PARTY cards.`,
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

    const { rationale, ...patch } = input;
    const payloadResult = bookWpAddItemSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.weddingparty.add_item",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.weddingparty.add_item",
        title: `Add "${input.label}"`,
        detail: `to "${card.title}"`,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
