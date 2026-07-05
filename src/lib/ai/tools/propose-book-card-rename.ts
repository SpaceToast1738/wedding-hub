import { z } from "zod";
import { db } from "@/lib/db";
import { bookCardRenameSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookCardRenameSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY the rename helps. Shown to the couple."),
});

export const proposeBookCardRename: AiTool<typeof inputSchema> = {
  name: "propose_book_card_rename",
  description:
    "Propose renaming a Wedding Book card (any kind — the title lives on the card itself). Writes a proposal — does NOT change the card; the couple will Apply or Dismiss it. Content, layout and the URL slug are untouched.",
  inputSchema,
  progressLabel: "Proposing card rename…",
  definition: {
    name: "propose_book_card_rename",
    description:
      "Propose a new title for an existing Wedding Book card of any kind. Writes a proposal — does not rename the card directly. Only the title changes; content is untouched.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "Card id from read_book / read_book_card — never invented.",
        },
        title: { type: "string", description: "The new card title. Max 120 chars." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why the rename helps.",
        },
      },
      required: ["subsectionId", "title", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const card = await db.bookSubsection.findUnique({
      where: { id: input.subsectionId },
      select: {
        title: true,
        visibility: true,
        section: { select: { visibility: true } },
      },
    });
    if (!card) {
      return { ok: false, error: unknownIdsError([`bookSubsection:${input.subsectionId}`]) };
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
    if (input.title === card.title) {
      return {
        ok: false,
        error: "The new title is the same as the current title — nothing to change.",
      };
    }

    const { rationale, ...patch } = input;
    const payloadResult = bookCardRenameSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.card.rename",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.card.rename",
        title: `Rename "${card.title}"`,
        detail: `→ "${input.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
