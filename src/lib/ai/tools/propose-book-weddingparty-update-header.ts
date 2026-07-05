import { z } from "zod";
import { db } from "@/lib/db";
import { bookWpUpdateHeaderSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookWpUpdateHeaderSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change helps. Shown to the couple."),
});

export const proposeBookWpUpdateHeader: AiTool<typeof inputSchema> = {
  name: "propose_book_weddingparty_update_header",
  description:
    "Propose changes to a WEDDING_PARTY Wedding Book card's header — the group label (e.g. 'Bridesmaids') and/or the card notes. Writes a proposal — does NOT change the card. Express only what changes; anything you don't name is preserved; you cannot see or change money, photos, or layout. Members, items and status cells have their own tools.",
  inputSchema,
  progressLabel: "Proposing wedding-party header…",
  definition: {
    name: "propose_book_weddingparty_update_header",
    description:
      "Propose an update to a WEDDING_PARTY card's group label and/or notes. Writes a proposal — does not change the card directly. Express only what changes; the omitted field is preserved. Members, items and cells are separate tools.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "WEDDING_PARTY card id from read_book / read_book_card — never invented.",
        },
        groupLabel: {
          type: ["string", "null"],
          description: "e.g. 'Bridesmaids', 'Groomsmen'. null clears.",
        },
        notes: { type: ["string", "null"], description: "Card notes. null clears." },
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
        error:
          "The update contains no changes. Include groupLabel and/or notes to change.",
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
    if (card.kind !== "WEDDING_PARTY") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not WEDDING_PARTY — propose_book_weddingparty_update_header only works on WEDDING_PARTY cards.`,
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

    const payloadResult = bookWpUpdateHeaderSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.weddingparty.update_header",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.weddingparty.update_header",
        title: `Update "${card.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
