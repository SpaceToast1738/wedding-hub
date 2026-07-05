import { z } from "zod";
import { db } from "@/lib/db";
import { bookStayUpdateSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookStayUpdateSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change helps. Shown to the couple."),
});

export const proposeBookStayUpdate: AiTool<typeof inputSchema> = {
  name: "propose_book_stay_update",
  description:
    "Propose changes to a STAY Wedding Book card (an accommodation booking) — property details, booking reference, check-in/out dates, occupant names (add/remove), and notes. Writes a proposal — does NOT change the card. Express only what changes; anything you don't name is preserved; you cannot see or change money, photos, or layout (cost, who-paid and guest links are carried through untouched). Occupants are free-text names, not guest ids.",
  inputSchema,
  progressLabel: "Proposing stay update…",
  definition: {
    name: "propose_book_stay_update",
    description:
      "Propose an update to a STAY (accommodation) card. Writes a proposal — does not change the card directly. Express only what changes; omitted fields are preserved. Cost and payment fields are not visible or writable. Occupants are free-text names.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "STAY card id from read_book / read_book_card — never invented.",
        },
        propertyName: { type: ["string", "null"], description: "null clears." },
        propertyContact: {
          type: ["string", "null"],
          description: "Phone/email/address for the property. null clears.",
        },
        bookingReference: { type: ["string", "null"], description: "null clears." },
        checkInDate: {
          type: ["string", "null"],
          description: "ISO date (YYYY-MM-DD). null clears.",
        },
        checkOutDate: {
          type: ["string", "null"],
          description: "ISO date (YYYY-MM-DD). null clears.",
        },
        addOccupants: {
          type: "array",
          items: { type: "string" },
          description: "Free-text names to add to the occupant list.",
        },
        removeOccupants: {
          type: "array",
          items: { type: "string" },
          description: "Exact occupant names to remove — as shown by read_book_card.",
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
    if (card.kind !== "STAY") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not STAY — propose_book_stay_update only works on STAY cards.`,
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

    const payloadResult = bookStayUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.stay.update",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.stay.update",
        title: `Update stay "${card.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
