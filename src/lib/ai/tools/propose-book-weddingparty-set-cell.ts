import { z } from "zod";
import { db } from "@/lib/db";
import { bookWpSetCellSchema, WP_CELL_STATUSES } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookWpSetCellSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this status is right. Shown to the couple."),
});

export const proposeBookWpSetCell: AiTool<typeof inputSchema> = {
  name: "propose_book_weddingparty_set_cell",
  description:
    "Propose setting one member × item status cell on a WEDDING_PARTY Wedding Book card (e.g. Aimee's shoes → ORDERED). Writes a proposal — does NOT change the card; the couple will Apply or Dismiss it. memberId and itemId come from read_book_card on the wedding-party card — call it in the SAME turn; both must belong to the same card. The apply is an idempotent upsert.",
  inputSchema,
  progressLabel: "Proposing wedding-party status…",
  definition: {
    name: "propose_book_weddingparty_set_cell",
    description:
      "Propose one status cell (member × item) on a WEDDING_PARTY card. Writes a proposal — does not change the card directly. memberId and itemId come from read_book_card in this same turn and must belong to the same card.",
    input_schema: {
      type: "object",
      properties: {
        memberId: {
          type: "string",
          description: "Wedding-party member id from read_book_card, this same turn.",
        },
        itemId: {
          type: "string",
          description: "Wedding-party item id from read_book_card — same card as the member.",
        },
        status: {
          type: "string",
          enum: [...WP_CELL_STATUSES],
          description: "NEED, ORDERED, HAVE, ALREADY_OWN or N_A.",
        },
        notes: {
          type: ["string", "null"],
          description: "Optional cell note, e.g. sizing or delivery date. null clears.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this status is right.",
        },
      },
      required: ["memberId", "itemId", "status", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    // Both halves of the cell are target refs, so they ARE validated
    // here — and they must sit on the SAME card, or the apply's upsert
    // would stitch a cell across two different wedding-party matrices.
    const [member, item] = await Promise.all([
      db.bookWeddingPartyMember.findUnique({
        where: { id: input.memberId },
        select: {
          name: true,
          cardId: true,
          card: {
            select: {
              subsection: {
                select: {
                  title: true,
                  visibility: true,
                  section: { select: { visibility: true } },
                },
              },
            },
          },
        },
      }),
      db.bookWeddingPartyItem.findUnique({
        where: { id: input.itemId },
        select: { label: true, cardId: true },
      }),
    ]);
    if (!member || !item) {
      return {
        ok: false,
        error:
          "Unknown member or item id. Both come from read_book_card on the wedding-party card — call it in the same turn; never invent ids.",
      };
    }
    if (member.cardId !== item.cardId) {
      return {
        ok: false,
        error:
          "That member and item belong to different wedding-party cards — a cell must pair a member and item from the same card.",
      };
    }
    const card = member.card.subsection;
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
    const payloadResult = bookWpSetCellSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.weddingparty.set_cell",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.weddingparty.set_cell",
        title: `${member.name} · ${item.label}`,
        detail: `→ ${input.status} on "${card.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
