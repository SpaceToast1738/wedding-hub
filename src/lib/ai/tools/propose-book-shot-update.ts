import { z } from "zod";
import { db } from "@/lib/db";
import { bookShotUpdateSchema } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

const inputSchema = bookShotUpdateSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change helps. Shown to the couple."),
});

export const proposeBookShotUpdate: AiTool<typeof inputSchema> = {
  name: "propose_book_shot_update",
  description:
    "Propose changes to one existing shot on a SHOT_LIST Wedding Book card — title, category, location, notes, time estimate, or captured flag. Writes a proposal — does NOT change the card. Express only what changes; anything you don't name is preserved; you cannot see or change money, photos, or layout. shotId comes from read_book_card — call it in the SAME turn.",
  inputSchema,
  progressLabel: "Proposing shot update…",
  definition: {
    name: "propose_book_shot_update",
    description:
      "Propose a partial update to one shot on a SHOT_LIST card. Writes a proposal — does not change the shot directly. Only fields you set change; omitted fields are preserved. shotId comes from read_book_card in this same turn.",
    input_schema: {
      type: "object",
      properties: {
        shotId: {
          type: "string",
          description: "Shot id from read_book_card on the shot-list card, this same turn.",
        },
        title: { type: "string", description: "New shot title." },
        category: {
          type: ["string", "null"],
          description: "Grouping label, e.g. 'Family formals'. null clears.",
        },
        location: { type: ["string", "null"], description: "Where at the venue. null clears." },
        notes: { type: ["string", "null"], description: "Direction notes. null clears." },
        estimatedMinutes: {
          type: ["integer", "null"],
          description: "Time budget in minutes. null clears.",
        },
        captured: {
          type: "boolean",
          description: "Mark the shot captured (or un-captured) on the day.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this change helps.",
        },
      },
      required: ["shotId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const { rationale, ...patch } = input;
    // Structural no-op guard: a shotId alone proposes nothing.
    const hasChange = Object.entries(patch).some(
      ([key, value]) => key !== "shotId" && value !== undefined,
    );
    if (!hasChange) {
      return {
        ok: false,
        error: "The update contains no changes. Include at least one field to change.",
      };
    }

    // The shot is the target ref, so it IS validated here (unlike child
    // deltas) — it's also the only route to the owning card for the
    // couple-only check.
    const shot = await db.bookShot.findUnique({
      where: { id: input.shotId },
      select: {
        title: true,
        shotList: {
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
    });
    if (!shot) {
      return {
        ok: false,
        error:
          "Unknown shot id. Shot ids come from read_book_card on the shot-list card — call it in the same turn; never invent ids.",
      };
    }
    const card = shot.shotList.subsection;
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

    const payloadResult = bookShotUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.shot.update",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.shot.update",
        title: `Update shot "${shot.title}"`,
        detail: `on "${card.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
