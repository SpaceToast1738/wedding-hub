import { z } from "zod";
import { db } from "@/lib/db";
import { bookWpAddMemberSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookWpAddMemberSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this person belongs on the card. Shown to the couple."),
});

export const proposeBookWpAddMember: AiTool<typeof inputSchema> = {
  name: "propose_book_weddingparty_add_member",
  description:
    "Propose adding a person (row) to a WEDDING_PARTY Wedding Book card — e.g. a new bridesmaid. Writes a proposal — does NOT change the card; the couple will Apply or Dismiss it. The new member starts with empty status cells against the card's existing items; set them afterwards with propose_book_weddingparty_set_cell once read_book_card shows the new member's id.",
  inputSchema,
  progressLabel: "Proposing wedding-party member…",
  definition: {
    name: "propose_book_weddingparty_add_member",
    description:
      "Propose a new member row on a WEDDING_PARTY card. Writes a proposal — does not change the card directly. The member starts with no status cells filled in.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "WEDDING_PARTY card id from read_book / read_book_card — never invented.",
        },
        name: { type: "string", description: "The person's name, e.g. 'Aimee'." },
        role: {
          type: ["string", "null"],
          description: "Optional sub-label, e.g. 'Maid of Honour', 'Best Man'.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this person belongs on the card.",
        },
      },
      required: ["subsectionId", "name", "rationale"],
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
        error: `That card is ${card.kind}, not WEDDING_PARTY — propose_book_weddingparty_add_member only works on WEDDING_PARTY cards.`,
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
    const payloadResult = bookWpAddMemberSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.weddingparty.add_member",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.weddingparty.add_member",
        title: `Add ${input.name}${input.role ? ` (${input.role})` : ""}`,
        detail: `to "${card.title}"`,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
