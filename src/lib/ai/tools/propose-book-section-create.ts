import { z } from "zod";
import { db } from "@/lib/db";
import { bookSectionCreateSchema } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// No target to validate: the slug is auto-derived and disambiguated by
// createBookSection at apply time, and new sections default to
// EVERYONE visibility, so there's no couple-only wall to check here.
const inputSchema = bookSectionCreateSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this section belongs in the book. Shown to the couple."),
});

export const proposeBookSectionCreate: AiTool<typeof inputSchema> = {
  name: "propose_book_section_create",
  description:
    "Propose a new top-level Wedding Book section (e.g. 'Honeymoon', 'Day After'). Writes a proposal — does NOT change the book; the couple will Apply or Dismiss it. Cards go inside sections via propose_book_card_create once the section exists.",
  inputSchema,
  progressLabel: "Proposing book section…",
  definition: {
    name: "propose_book_section_create",
    description:
      "Propose a new top-level Wedding Book section. Writes a proposal — does not create the section directly. The URL slug is derived from the title automatically.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Section title, e.g. 'Honeymoon'. Max 120 chars." },
        subtitle: {
          type: ["string", "null"],
          description: "Optional strapline shown under the title. Max 240 chars.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this section belongs in the book.",
        },
      },
      required: ["title", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const { rationale, ...patch } = input;
    const payloadResult = bookSectionCreateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.section.create",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.section.create",
        title: input.title,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
