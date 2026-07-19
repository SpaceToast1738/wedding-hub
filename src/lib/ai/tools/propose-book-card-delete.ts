import { z } from "zod";
import { db } from "@/lib/db";
import { bookCardDeleteSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import {
  clipDisplay,
  DELETE_PROPOSED_MESSAGE,
  reasonFromRationale,
} from "./propose-delete-common";
import type { AiTool } from "./types";

// v2.8.0: destructive kind. Bridges to the book.card.delete apply
// handler (src/lib/ai/apply/deletes.ts) — a PERMANENT delete of one
// Wedding Book card, cascading ALL of its structured content (fields,
// recipe steps, menu options, build materials, …).
const inputSchema = z.object({
  subsectionId: z
    .string()
    .min(1)
    .describe("Card id from read_book / read_book_card — never invented."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this card should be permanently deleted. Shown to the couple.",
    ),
});

export const proposeBookCardDelete: AiTool<typeof inputSchema> = {
  name: "propose_book_card_delete",
  description:
    "Propose PERMANENTLY deleting a Wedding Book card of any kind. This is destructive: applying removes the card AND all of its structured content — field values, recipe steps, shot lists, build materials and sessions, menu courses and options, bar/setup/lodging items, wedding-party matrix — for good (a JSON snapshot is kept on the proposal for manual recovery, but there is no undo button). Reserve this for cards that are genuinely wrong (duplicates, abandoned experiments); content that's merely outdated is better rewritten via the card-update tools. You MUST have the card id from read_book or read_book_card.",
  inputSchema,
  progressLabel: "Proposing card delete…",
  definition: {
    name: "propose_book_card_delete",
    description:
      "Propose permanently deleting a Wedding Book card and ALL its structured content (snapshot-backed, no undo). Prefer the card-update tools for outdated content. Requires subsectionId from read_book / read_book_card.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "Card id from read_book / read_book_card.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this card should be deleted.",
        },
      },
      required: ["subsectionId", "rationale"],
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
        section: { select: { title: true, visibility: true } },
      },
    });
    if (!card) {
      return { ok: false, error: unknownIdsError([`bookSubsection:${input.subsectionId}`]) };
    }
    // Mirrors assertBookCardWritable in @/lib/ai/apply/common — checked at
    // propose time too so a non-couple user can't queue deletes against
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

    const payloadResult = bookCardDeleteSchema.safeParse({
      subsectionId: input.subsectionId,
      targetLabel: clipDisplay(card.title, 200),
      reason: reasonFromRationale(input.rationale),
    });
    if (!payloadResult.success) {
      return {
        ok: false,
        error: `Payload validation failed: ${payloadResult.error.message}`,
      };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.card.delete",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.card.delete",
        title: `Delete ${card.kind} card "${card.title}"`,
        detail: `in "${card.section.title}" · permanent — all structured card content goes with it · snapshot kept`,
        message: DELETE_PROPOSED_MESSAGE,
      },
    };
  },
};
