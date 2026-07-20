import { z } from "zod";
import { db } from "@/lib/db";
import { bookSectionUpdateSchema } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// v2.9.0: rename a top-level Wedding Book section (title and/or
// subtitle). Only create + delete existed before, so a typo'd section
// title meant delete-and-recreate — which loses the slug and every
// card. The slug NEVER changes on rename (stable-URL rule shared with
// the human EditSectionToggle path), so links keep working. The
// COUPLE_ONLY visibility wall is enforced at apply time, same as
// book.section.delete.
const inputSchema = z
  .object({
    sectionId: z
      .string()
      .min(1)
      .describe("The id of the section to rename — from read_book output."),
    title: z.string().min(1).max(120).optional(),
    subtitle: z
      .string()
      .max(240)
      .optional()
      .nullable()
      .describe("New strapline under the title. null clears it."),
    rationale: z
      .string()
      .min(1)
      .max(500)
      .describe(
        "One or two sentences explaining WHY the section should be renamed. Shown to the couple.",
      ),
  })
  .refine((v) => v.title !== undefined || v.subtitle !== undefined, {
    message: "Nothing to change — set title and/or subtitle.",
  });

export const proposeBookSectionUpdate: AiTool<typeof inputSchema> = {
  name: "propose_book_section_update",
  description:
    "Propose renaming a top-level Wedding Book section — new title and/or subtitle. Writes a proposal — does NOT change the book; the couple will Apply or Dismiss it. The section's URL slug stays the SAME (links and bookmarks keep working), so this is safe for a live section. Omit a field to keep it; subtitle:null clears the strapline. Requires a sectionId from read_book. For renaming a CARD inside a section, use propose_book_card_rename instead.",
  inputSchema,
  progressLabel: "Proposing section rename…",
  definition: {
    name: "propose_book_section_update",
    description:
      "Propose renaming a Wedding Book section's title and/or subtitle (sectionId from read_book). Writes a proposal — does not change the book directly. The URL slug never changes.",
    input_schema: {
      type: "object",
      properties: {
        sectionId: { type: "string", description: "From read_book output." },
        title: { type: "string", description: "New section title. Max 120 chars." },
        subtitle: {
          type: ["string", "null"],
          description: "New strapline under the title (max 240 chars). null clears it.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why. Shown to the couple.",
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
      select: { title: true, slug: true },
    });
    if (!section) {
      // No bookSection family in resolveRefs — same prefix style as
      // the other hand-rolled id checks.
      return {
        ok: false,
        error: `Unknown ids: bookSection:${input.sectionId}. Use ids from a read tool — never invent ids.`,
      };
    }

    const payloadResult = bookSectionUpdateSchema.safeParse({
      sectionId: input.sectionId,
      title: input.title,
      subtitle: input.subtitle,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.section.update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.section.update",
        title:
          input.title !== undefined
            ? `"${section.title}" → "${input.title}"`
            : `Update "${section.title}" subtitle`,
        detail: `URL stays /book/${section.slug}`,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
