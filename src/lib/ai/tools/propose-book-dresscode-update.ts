import { z } from "zod";
import { db } from "@/lib/db";
import { bookDressCodeUpdateSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookDressCodeUpdateSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change helps. Shown to the couple."),
});

export const proposeBookDresscodeUpdate: AiTool<typeof inputSchema> = {
  name: "propose_book_dresscode_update",
  description:
    "Propose changes to a DRESS_CODE Wedding Book card — dress-code label, summary, longer body text, and guidance on colours, footwear, weather and accessories. Writes a proposal — does NOT change the card. Express only what changes; anything you don't name is preserved; you cannot see or change money, photos, or layout. bodyText supports a narrow markdown subset (see its field description) and REPLACES the card's whole body when set, so carry forward anything worth keeping (read it via read_book_card first).",
  inputSchema,
  progressLabel: "Proposing dress-code update…",
  definition: {
    name: "propose_book_dresscode_update",
    description:
      "Propose an update to a DRESS_CODE card. Writes a proposal — does not change the card directly. Express only what changes; omitted fields are preserved. bodyText supports a narrow markdown subset and replaces the whole body when set — read the card first via read_book_card.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "DRESS_CODE card id from read_book / read_book_card — never invented.",
        },
        dressCode: {
          type: ["string", "null"],
          description: "The headline code, e.g. 'Formal', 'Cocktail', 'Garden party'. null clears.",
        },
        summary: { type: ["string", "null"], description: "One-line summary. null clears." },
        bodyText: {
          type: ["string", "null"],
          description:
            "REPLACES the current body entirely when set. null clears. Supports a narrow markdown subset, rendered as real formatting: ## heading, ### subheading, **bold**, _italic_, __underline__, - bullet, 1. numbered list, > blockquote, [text](url) link.",
        },
        colourGuidance: {
          type: ["string", "null"],
          description: "Colours to wear or avoid. null clears.",
        },
        footwear: { type: ["string", "null"], description: "null clears." },
        weather: {
          type: ["string", "null"],
          description: "What to expect in late September. null clears.",
        },
        accessories: { type: ["string", "null"], description: "null clears." },
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
    // Structural no-op guard: a subsectionId alone proposes nothing.
    const hasChange = Object.entries(patch).some(
      ([key, value]) => key !== "subsectionId" && value !== undefined,
    );
    if (!hasChange) {
      return {
        ok: false,
        error: "The update contains no changes. Include at least one field to change.",
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
    if (card.kind !== "DRESS_CODE") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not DRESS_CODE — propose_book_dresscode_update only works on DRESS_CODE cards.`,
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

    const payloadResult = bookDressCodeUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.dresscode.update",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.dresscode.update",
        title: `Update dress code "${card.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
