import { z } from "zod";
import { db } from "@/lib/db";
import { bookFieldSetSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookFieldSetSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this value is right. Shown to the couple."),
});

export const proposeBookFieldSet: AiTool<typeof inputSchema> = {
  name: "propose_book_field_set",
  description:
    "Propose setting one field's value on a FIELD Wedding Book card. Writes a proposal — does NOT change the card; the couple will Apply or Dismiss it. defId comes from read_book_card — call it in the SAME turn to see the card's field definitions, types and current values. null clears the value (required fields can't be cleared). The server validates type/range rules at apply time.",
  inputSchema,
  progressLabel: "Proposing field value…",
  definition: {
    name: "propose_book_field_set",
    description:
      "Propose one field value on a FIELD card. Writes a proposal — does not change the card directly. defId must come from read_book_card in this same turn. Pass null to clear a non-required field.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "FIELD card id from read_book / read_book_card — never invented.",
        },
        defId: {
          type: "string",
          description: "Field definition id from read_book_card on this card, in this same turn.",
        },
        value: {
          type: ["string", "null"],
          description:
            "The new value as a string (numbers and dates as strings — e.g. \"120\", \"2026-09-26\"). null clears the value.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this value is right.",
        },
      },
      required: ["subsectionId", "defId", "value", "rationale"],
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
    if (card.kind !== "FIELD") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not FIELD — propose_book_field_set only works on FIELD cards.`,
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

    // The def must live on THIS card — a defId from another card would
    // pass the apply's own lookup semantics but write a dead key into
    // the wrong Json bag.
    const def = await db.bookFieldDef.findUnique({
      where: { id: input.defId },
      select: { subsectionId: true, label: true, required: true },
    });
    if (!def || def.subsectionId !== input.subsectionId) {
      return {
        ok: false,
        error:
          "That defId is not a field on this card — field definition ids come from read_book_card; call it in the same turn.",
      };
    }
    if (input.value === null && def.required) {
      return {
        ok: false,
        error: `"${def.label}" is a required field — it can't be cleared, only given a new value.`,
      };
    }

    const { rationale, ...patch } = input;
    // Denormalise the verified def's label so the review card names
    // the field ('Budget → £2000', not 'Field → £2000').
    const payloadResult = bookFieldSetSchema.safeParse({ ...patch, fieldName: def.label });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.field.set",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.field.set",
        title: `Set field on "${card.title}"`,
        detail: `${def.label} → ${input.value === null ? "(cleared)" : input.value}`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
