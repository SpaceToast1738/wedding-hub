import { z } from "zod";
import { db } from "@/lib/db";
import { bookCardReplaceTextSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookCardReplaceTextSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY the rewrite is better. Shown to the couple."),
});

export const proposeBookCardReplaceText: AiTool<typeof inputSchema> = {
  name: "propose_book_card_replace_text",
  description:
    "Propose rewriting the ENTIRE body of a TEXT Wedding Book card. Writes a proposal — does NOT change the card; the couple sees a before/after and will Apply or Dismiss it. baseBodyHash MUST be the bodyHtmlHash returned by read_book_card in this SAME turn — never invented or reused from an earlier turn; if the card changed since that read, the apply refuses and you must re-read and re-propose. Prefer this over append only when the existing text genuinely needs restructuring. Photos and layout are untouched.",
  inputSchema,
  progressLabel: "Proposing card rewrite…",
  definition: {
    name: "propose_book_card_replace_text",
    description:
      "Propose a full rewrite of a TEXT card's body. Writes a proposal — does not change the card directly. baseBodyHash must be the bodyHtmlHash from a read_book_card call in this same turn — never invent it. The apply refuses if the card changed since that read.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "TEXT card id from read_book / read_book_card — never invented.",
        },
        text: {
          type: "string",
          description:
            "The complete replacement body. REPLACES everything currently on the card, so carry forward anything worth keeping. Supports a narrow markdown subset, rendered as real formatting (not shown as literal symbols): ## heading, ### subheading, **bold**, _italic_, __underline__, - bullet (or *), 1. numbered list, > blockquote, [text](url) link. Blank lines separate paragraphs. Nothing else (images, tables, code blocks, nested lists) is supported.",
        },
        baseBodyHash: {
          type: "string",
          description:
            "The bodyHtmlHash returned by read_book_card for this card, in this same turn. Never invented.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why the rewrite is better.",
        },
      },
      required: ["subsectionId", "text", "baseBodyHash", "rationale"],
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
    if (card.kind !== "TEXT") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not TEXT — propose_book_card_replace_text only works on TEXT cards. Use the matching update tool for structured cards.`,
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
    const payloadResult = bookCardReplaceTextSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.card.replace_text",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.card.replace_text",
        title: `Rewrite "${card.title}"`,
        message:
          "Rewrite proposed. The couple will see the before/after and Apply or Dismiss it.",
      },
    };
  },
};
