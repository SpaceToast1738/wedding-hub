import { z } from "zod";
import { db } from "@/lib/db";
import { bookShotAddSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookShotAddSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this shot is worth capturing. Shown to the couple."),
});

export const proposeBookShotAdd: AiTool<typeof inputSchema> = {
  name: "propose_book_shot_add",
  description:
    "Propose adding one shot to a SHOT_LIST Wedding Book card (the photographer's shot list). Writes a proposal — does NOT change the card; the couple will Apply or Dismiss it. withWhom is free-text names, not guest ids. Call this once per distinct shot.",
  inputSchema,
  progressLabel: "Proposing photo shot…",
  definition: {
    name: "propose_book_shot_add",
    description:
      "Propose one new shot on a SHOT_LIST card. Writes a proposal — does not add the shot directly. withWhom is free-text names (e.g. 'Bryony, Aimee'), not ids.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "SHOT_LIST card id from read_book / read_book_card — never invented.",
        },
        title: { type: "string", description: "What the shot is, e.g. 'First look on the lawn'." },
        category: {
          type: ["string", "null"],
          description: "Grouping label, e.g. 'Pre-ceremony', 'Family formals', 'Reception'.",
        },
        location: { type: ["string", "null"], description: "Where at the venue." },
        notes: { type: ["string", "null"], description: "Direction or timing notes." },
        estimatedMinutes: {
          type: ["integer", "null"],
          description: "Time budget in minutes — rolls up into the card header.",
        },
        withWhom: {
          type: "array",
          items: { type: "string" },
          description: "Free-text names of who's in the shot.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this shot is worth capturing.",
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
        kind: true,
        visibility: true,
        section: { select: { visibility: true } },
      },
    });
    if (!card) {
      return { ok: false, error: unknownIdsError([`bookSubsection:${input.subsectionId}`]) };
    }
    if (card.kind !== "SHOT_LIST") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not SHOT_LIST — propose_book_shot_add only works on SHOT_LIST cards.`,
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
    const payloadResult = bookShotAddSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.shot.add",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.shot.add",
        title: input.title,
        detail: `on "${card.title}"`,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
