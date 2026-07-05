import { z } from "zod";
import { db } from "@/lib/db";
import { bookBuildUpdateSchema, BUILD_STATUSES } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookBuildUpdateSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change helps. Shown to the couple."),
});

// Material ids are deliberately NOT validated here — the apply bridge
// re-checks them against the live rows, so a stale id fails the apply
// cleanly instead of blocking an otherwise-valid proposal.
export const proposeBookBuildUpdate: AiTool<typeof inputSchema> = {
  name: "propose_book_build_update",
  description:
    "Propose changes to a BUILD (DIY project) Wedding Book card — quantities, target date, status, prototype notes, and material deltas (add/update/remove). Writes a proposal — does NOT change the card. Express only what changes; anything you don't name is preserved; you cannot see or change money, photos, or layout (material costs, budget links and work sessions are carried through untouched). Material ids come from read_book_card — call it in the SAME turn.",
  inputSchema,
  progressLabel: "Proposing build update…",
  definition: {
    name: "propose_book_build_update",
    description:
      "Propose an update to a BUILD (DIY) card. Writes a proposal — does not change the card directly. Express only what changes; omitted fields and unnamed materials are preserved. Costs and budget links are not visible or writable. materialId values come from read_book_card in this same turn.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "BUILD card id from read_book / read_book_card — never invented.",
        },
        quantityNeeded: {
          type: ["integer", "null"],
          description: "How many units to make. null clears.",
        },
        targetDate: {
          type: ["string", "null"],
          description: "ISO date (YYYY-MM-DD) to finish by. null clears.",
        },
        status: {
          type: ["string", "null"],
          enum: [...BUILD_STATUSES, null],
          description: "Project stage. null clears.",
        },
        prototypeDone: { type: "boolean", description: "Whether the prototype is finished." },
        prototypeNotes: { type: ["string", "null"], description: "null clears." },
        estimatedMinutesPerUnit: {
          type: ["integer", "null"],
          description: "Minutes per unit — drives the time budget. null clears.",
        },
        notes: { type: ["string", "null"], description: "Card notes. null clears." },
        addMaterials: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              quantity: { type: ["number", "null"] },
              unit: { type: ["string", "null"], description: "e.g. 'm', 'sheets', 'rolls'." },
              supplier: { type: ["string", "null"], description: "Free-text supplier name." },
              website: { type: ["string", "null"] },
              ordered: { type: "boolean" },
              arrived: { type: "boolean" },
              notes: { type: ["string", "null"] },
            },
            required: ["name"],
          },
          description: "New materials.",
        },
        updateMaterials: {
          type: "array",
          items: {
            type: "object",
            properties: {
              materialId: { type: "string", description: "From read_book_card, this same turn." },
              name: { type: "string" },
              quantity: { type: ["number", "null"] },
              unit: { type: ["string", "null"] },
              supplier: { type: ["string", "null"] },
              website: { type: ["string", "null"] },
              ordered: { type: "boolean" },
              arrived: { type: "boolean" },
              notes: { type: ["string", "null"] },
            },
            required: ["materialId"],
          },
          description: "Patches to existing materials — only the fields you set change.",
        },
        removeMaterialIds: {
          type: "array",
          items: { type: "string" },
          description: "Materials to delete, by materialId from read_book_card.",
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
          "The update contains no changes. Include at least one field or material delta to change.",
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
    if (card.kind !== "BUILD") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not BUILD — propose_book_build_update only works on BUILD cards.`,
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

    const payloadResult = bookBuildUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.build.update",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.build.update",
        title: `Update build "${card.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
