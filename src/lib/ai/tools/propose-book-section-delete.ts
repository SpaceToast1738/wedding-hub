import { z } from "zod";
import { db } from "@/lib/db";
import { bookSectionDeleteSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import {
  clipDisplay,
  DELETE_PROPOSED_MESSAGE,
  reasonFromRationale,
} from "./propose-delete-common";
import type { AiTool } from "./types";

// v2.8.0: destructive kind. Bridges to the book.section.delete apply
// handler (src/lib/ai/apply/deletes.ts). EMPTY sections only — refused
// (here AND at apply) while cards remain, so emptying a section is
// always a separate, visible set of book.card.delete proposals, never
// an implicit cascade.
const inputSchema = z.object({
  sectionId: z
    .string()
    .min(1)
    .describe("Section id from read_book — never invented."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this empty section should be permanently deleted. Shown to the couple.",
    ),
});

export const proposeBookSectionDelete: AiTool<typeof inputSchema> = {
  name: "propose_book_section_delete",
  description:
    "Propose PERMANENTLY deleting an EMPTY Wedding Book section. This is destructive (a JSON snapshot is kept on the proposal for manual recovery, but there is no undo button) and is REFUSED while the section still contains cards — propose book.card deletes first if the whole section truly has to go, so every card's removal is individually visible to the couple. Requires a sectionId from read_book.",
  inputSchema,
  progressLabel: "Proposing section delete…",
  definition: {
    name: "propose_book_section_delete",
    description:
      "Propose permanently deleting an EMPTY Wedding Book section (snapshot-backed, no undo; refused while it still has cards). Requires sectionId from read_book.",
    input_schema: {
      type: "object",
      properties: {
        sectionId: { type: "string", description: "Section id from read_book." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this section should be deleted.",
        },
      },
      required: ["sectionId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const section = await db.bookSection.findUnique({
      where: { id: input.sectionId },
      select: {
        title: true,
        visibility: true,
        _count: { select: { subsections: true } },
      },
    });
    if (!section) {
      return { ok: false, error: unknownIdsError([`bookSection:${input.sectionId}`]) };
    }
    // Section-level twin of the card tools' COUPLE_ONLY check — a
    // non-couple user can't queue deletes against sections they can't
    // see.
    if (!ctx.user.isCouple && section.visibility === "COUPLE_ONLY") {
      return {
        ok: false,
        error: "This section is couple-only — only the couple can propose changes to it.",
      };
    }

    // Same refusal the apply handler enforces — refuse at propose time
    // so an un-appliable proposal never reaches the queue.
    if (section._count.subsections > 0) {
      return {
        ok: false,
        error: `Can't delete "${section.title}" — ${section._count.subsections} card${section._count.subsections === 1 ? "" : "s"} still in this section. Propose deleting the cards first.`,
      };
    }

    const payloadResult = bookSectionDeleteSchema.safeParse({
      sectionId: input.sectionId,
      targetLabel: clipDisplay(section.title, 200),
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
        kind: "book.section.delete",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.section.delete",
        title: `Delete section "${section.title}"`,
        detail: "currently empty · permanent — snapshot kept · re-checked at apply",
        message: DELETE_PROPOSED_MESSAGE,
      },
    };
  },
};
