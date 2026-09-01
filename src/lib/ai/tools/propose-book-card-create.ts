import { z } from "zod";
import { db } from "@/lib/db";
import { bookCardCreateSchema, BOOK_KINDS } from "@/lib/ai/proposals/schemas";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// v2.13.2: `.strict()` — an unknown key is an error that NAMES the key,
// not a silent drop. Zod's default strips unrecognised keys, so a caller
// that sent the body as `bodyText` (the name read_book_card returns it
// under) or `text` (replace_text's name) got a proposal that applied as
// a blank card with no hint why. Loud beats lost.
const inputSchema = bookCardCreateSchema
  .extend({
    rationale: z
      .string()
      .min(1)
      .max(500)
      .describe("One or two sentences explaining WHY this card belongs in the book. Shown to the couple."),
  })
  .strict();

export const proposeBookCardCreate: AiTool<typeof inputSchema> = {
  name: "propose_book_card_create",
  description:
    "Propose a new Wedding Book card inside an existing section. Writes a proposal — does NOT change the book; the couple will Apply or Dismiss it. The card's content goes in `body` (that exact field name — not bodyText or text; unknown fields are rejected) and is only allowed on TEXT cards. `body` supports the same narrow markdown subset as propose_book_card_replace_text, rendered as real formatting: ## heading, ### subheading, **bold**, _italic_, __underline__, - bullet (or *), 1. numbered list, > blockquote, [text](url) link; blank lines separate paragraphs. Note: MENU cards are seeded with placeholder Starter/Main/Dessert courses and WEDDING_PARTY cards with a placeholder member plus Dress/Shoes/Accessories items — edit those with the matching update tools afterwards.",
  inputSchema,
  progressLabel: "Proposing book card…",
  definition: {
    name: "propose_book_card_create",
    description:
      "Propose a new Wedding Book card in an existing section. Writes a proposal — does not create the card directly. Card content goes in `body` (exactly that name; unknown fields are rejected), only valid when kind is TEXT, and supports the same markdown subset as propose_book_card_replace_text (headings, bold/italic/underline, bullets, numbered lists, blockquote, links; blank line = new paragraph). MENU and WEDDING_PARTY cards are created with placeholder rows the couple can edit later.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        sectionId: {
          type: "string",
          description: "Book section id from the reference directory or read_book — never invented.",
        },
        title: { type: "string", description: "Card title. Max 120 chars." },
        kind: {
          type: "string",
          enum: [...BOOK_KINDS],
          description: "Card kind. TEXT by default.",
        },
        body: {
          type: ["string", "null"],
          description:
            "Card content — TEXT cards only. Markdown subset (## / ### headings, **bold**, _italic_, __underline__, - bullets, 1. numbered, > blockquote, [text](url)); blank lines separate paragraphs. Max 20,000 chars.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this card belongs in the book.",
        },
      },
      required: ["sectionId", "title", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const { invalid, names } = await resolveRefs({ bookSectionIds: [input.sectionId] });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    // Section-level couple-only wall. assertBookCardWritable only covers
    // existing cards, so creating INTO a couple-only section needs its
    // own check or a non-couple ai_write holder could add cards to a
    // section they can't see.
    const section = await db.bookSection.findUnique({
      where: { id: input.sectionId },
      select: { visibility: true },
    });
    if (!ctx.user.isCouple && section?.visibility === "COUPLE_ONLY") {
      return {
        ok: false,
        error: "This section is couple-only — only the couple can propose changes to it.",
      };
    }

    if (typeof input.body === "string" && input.body.length > 0 && input.kind !== "TEXT") {
      return {
        ok: false,
        error: `body is only allowed on TEXT cards — a ${input.kind} card's content is structured. Create the card without a body, then fill it with the matching update tool.`,
      };
    }

    const { rationale, ...patch } = input;
    const payloadResult = bookCardCreateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.card.create",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.card.create",
        title: input.title,
        detail: `${input.kind} card in "${names.bookSections.get(input.sectionId)}"`,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
