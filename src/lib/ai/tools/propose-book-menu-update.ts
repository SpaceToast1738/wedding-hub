import { z } from "zod";
import { db } from "@/lib/db";
import { bookMenuUpdateSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookMenuUpdateSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change helps. Shown to the couple."),
});

// Course/option ids are deliberately NOT validated here — the apply
// bridge re-checks them against the live rows, so a stale id fails the
// apply cleanly instead of blocking an otherwise-valid proposal.
// There is intentionally NO removeCourses delta: deleting a course
// cascades all its options, so that stays a human-only action.
export const proposeBookMenuUpdate: AiTool<typeof inputSchema> = {
  name: "propose_book_menu_update",
  description:
    "Propose changes to a MENU Wedding Book card — service details, notes, courses (add/rename only — courses can't be removed here) and dish options (add/update/remove). Writes a proposal — does NOT change the card. Express only what changes; anything you don't name is preserved; you cannot see or change money, photos, or layout (per-head pricing and budget links are carried through untouched). Course and option ids come from read_book_card — call it in the SAME turn.",
  inputSchema,
  progressLabel: "Proposing menu update…",
  definition: {
    name: "propose_book_menu_update",
    description:
      "Propose an update to a MENU card. Writes a proposal — does not change the card directly. Express only what changes; omitted fields, courses and options are preserved. Courses can be added or renamed but never removed. Pricing is not visible or writable. courseId/optionId values come from read_book_card in this same turn.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "MENU card id from read_book / read_book_card — never invented.",
        },
        serviceType: {
          type: ["string", "null"],
          description: "e.g. 'Plated', 'Buffet', 'Family style'. null clears.",
        },
        serviceTime: { type: ["string", "null"], description: "e.g. '5:30pm'. null clears." },
        notes: { type: ["string", "null"], description: "Card notes. null clears." },
        addCourses: {
          type: "array",
          items: {
            type: "object",
            properties: { courseLabel: { type: "string", description: "e.g. 'Canapés'." } },
            required: ["courseLabel"],
          },
          description: "New courses, appended after the existing ones.",
        },
        renameCourses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              courseId: { type: "string", description: "From read_book_card, this same turn." },
              courseLabel: { type: "string" },
            },
            required: ["courseId", "courseLabel"],
          },
          description: "Relabel existing courses — their options are untouched.",
        },
        addOptions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "Which course the dish goes under — from read_book_card.",
              },
              label: { type: "string", description: "Dish name." },
              description: { type: ["string", "null"] },
              dietary: {
                type: "array",
                items: { type: "string" },
                description: "Tags like 'V', 'VG', 'GF'.",
              },
              isVegetarianMain: { type: "boolean" },
              isKidsMeal: { type: "boolean" },
            },
            required: ["courseId", "label"],
          },
          description: "New dish options.",
        },
        updateOptions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              optionId: { type: "string", description: "From read_book_card, this same turn." },
              label: { type: "string" },
              description: { type: ["string", "null"] },
              dietary: { type: "array", items: { type: "string" } },
              isVegetarianMain: { type: "boolean" },
              isKidsMeal: { type: "boolean" },
            },
            required: ["optionId"],
          },
          description: "Patches to existing options — only the fields you set change.",
        },
        removeOptionIds: {
          type: "array",
          items: { type: "string" },
          description: "Options to delete, by optionId from read_book_card.",
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
          "The update contains no changes. Include at least one field, course or option delta to change.",
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
    if (card.kind !== "MENU") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not MENU — propose_book_menu_update only works on MENU cards.`,
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

    const payloadResult = bookMenuUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.menu.update",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.menu.update",
        title: `Update menu "${card.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
