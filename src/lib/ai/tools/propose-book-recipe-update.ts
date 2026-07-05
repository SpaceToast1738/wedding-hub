import { z } from "zod";
import { db } from "@/lib/db";
import { bookRecipeUpdateSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookRecipeUpdateSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change helps. Shown to the couple."),
});

// Step ids are deliberately NOT validated here — the apply bridge
// re-checks them against the live rows, so a stale id fails the apply
// cleanly instead of blocking an otherwise-valid proposal.
export const proposeBookRecipeUpdate: AiTool<typeof inputSchema> = {
  name: "propose_book_recipe_update",
  description:
    "Propose changes to a RECIPE Wedding Book card — notes, servings, the ingredient list, and step deltas. Writes a proposal — does NOT change the card. Express only what changes; anything you don't name is preserved; you cannot see or change money, photos, or layout. setIngredients REPLACES the whole ingredient list, so include every ingredient you want kept. Step ids (stepId) come from read_book_card — call it in the SAME turn.",
  inputSchema,
  progressLabel: "Proposing recipe update…",
  definition: {
    name: "propose_book_recipe_update",
    description:
      "Propose an update to a RECIPE card. Writes a proposal — does not change the card directly. Express only what changes; omitted fields and unnamed steps are preserved. setIngredients replaces the full ingredient list. stepId values come from read_book_card in this same turn.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "RECIPE card id from read_book / read_book_card — never invented.",
        },
        setIngredients: {
          type: "array",
          items: { type: "string" },
          description:
            "FULL replacement ingredient list (plain strings, quantities inline). Omit to keep the current list — this is not a delta.",
        },
        notes: { type: ["string", "null"], description: "Recipe notes. null clears." },
        servingsBase: {
          type: ["integer", "null"],
          description: "Base servings the quantities are written for. null clears.",
        },
        addSteps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              instruction: { type: "string" },
              durationMinutes: { type: ["integer", "null"] },
              dayBefore: { type: "boolean", description: "True if done the day before." },
            },
            required: ["instruction"],
          },
          description: "New steps, appended in order.",
        },
        updateSteps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              stepId: { type: "string", description: "From read_book_card, this same turn." },
              instruction: { type: "string" },
              durationMinutes: { type: ["integer", "null"] },
              dayBefore: { type: "boolean" },
            },
            required: ["stepId"],
          },
          description: "Patches to existing steps — only the fields you set change.",
        },
        removeStepIds: {
          type: "array",
          items: { type: "string" },
          description: "Steps to delete, by stepId from read_book_card.",
        },
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
        error:
          "The update contains no changes. Include at least one field or step delta to change.",
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
    if (card.kind !== "RECIPE") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not RECIPE — propose_book_recipe_update only works on RECIPE cards.`,
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

    const payloadResult = bookRecipeUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.recipe.update",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.recipe.update",
        title: `Update recipe "${card.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
