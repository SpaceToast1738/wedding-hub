import { z } from "zod";
import { db } from "@/lib/db";
import { bookRunsheetUpdateSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// v2.16.0: RUNSHEET card — time-ordered rows {time, event, owner,
// notes, done}. Same delta shape as propose_book_setup_update: add /
// update / remove rows by id, header notes; anything unnamed is
// preserved. Row ids are validated at apply time against the live rows
// (a stale id fails the apply cleanly).

const inputSchema = bookRunsheetUpdateSchema.extend({
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this change helps. Shown to the couple."),
});

export const proposeBookRunsheetUpdate: AiTool<typeof inputSchema> = {
  name: "propose_book_runsheet_update",
  description:
    "Propose changes to a RUNSHEET Wedding Book card (a time-ordered schedule: the ceremony running order, the morning setup window, supplier arrivals, the day-of runsheet). Row deltas add/update/remove {time, event, owner, notes, done} rows by rowId, plus header notes. Times are free text ('12:45', '1:35/1:45', 'after speeches'); new rows are appended, so give them in schedule order — the couple can re-sort by time in the editor. Writes a proposal — does NOT change the card. Express only what changes; anything you don't name is preserved. rowId values come from read_book_card — call it in the SAME turn. To START a runsheet, create the card with propose_book_card_create kind RUNSHEET first, then add rows here.",
  inputSchema,
  progressLabel: "Proposing runsheet update…",
  definition: {
    name: "propose_book_runsheet_update",
    description:
      "Propose an update to a RUNSHEET card (time-ordered schedule rows). Writes a proposal — does not change the card directly. Add/update/remove rows by rowId (from read_book_card, same turn); omitted fields and unnamed rows are preserved. Times are free text; new rows append in the order given. Create the card first with propose_book_card_create kind RUNSHEET.",
    input_schema: {
      type: "object",
      properties: {
        subsectionId: {
          type: "string",
          description: "RUNSHEET card id from read_book / read_book_card — never invented.",
        },
        notes: { type: ["string", "null"], description: "Card-level notes shown above the schedule. null clears." },
        addRows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              time: { type: ["string", "null"], description: "Free text, e.g. '12:45', '1:35/1:45', 'after speeches'." },
              event: { type: "string", description: "What happens, e.g. 'Groomsmen chair sweep'." },
              owner: { type: ["string", "null"], description: "Who owns it, e.g. 'Josh'." },
              notes: { type: ["string", "null"] },
              done: { type: "boolean" },
            },
            required: ["event"],
          },
          description: "New rows, appended in the order given.",
        },
        updateRows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              rowId: { type: "string", description: "From read_book_card, this same turn." },
              time: { type: ["string", "null"] },
              event: { type: "string" },
              owner: { type: ["string", "null"] },
              notes: { type: ["string", "null"] },
              done: { type: "boolean" },
            },
            required: ["rowId"],
          },
          description: "Patches to existing rows — only the fields you set change.",
        },
        removeRowIds: {
          type: "array",
          items: { type: "string" },
          description: "Rows to delete, by rowId from read_book_card.",
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
    const hasChange = Object.entries(patch).some(
      ([key, value]) =>
        key !== "subsectionId" &&
        value !== undefined &&
        !(Array.isArray(value) && value.length === 0),
    );
    if (!hasChange) {
      return {
        ok: false,
        error: "The update contains no changes. Include notes or at least one row delta.",
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
    if (card.kind !== "RUNSHEET") {
      return {
        ok: false,
        error: `That card is ${card.kind}, not RUNSHEET — propose_book_runsheet_update only works on RUNSHEET cards.`,
      };
    }
    if (
      !ctx.user.isCouple &&
      (card.visibility === "COUPLE_ONLY" || card.section.visibility === "COUPLE_ONLY")
    ) {
      return {
        ok: false,
        error: "This card is couple-only — only the couple can propose changes to it.",
      };
    }

    const payloadResult = bookRunsheetUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "book.runsheet.update",
        payload: payloadResult.data as unknown as object,
        rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "book.runsheet.update",
        title: `Update runsheet "${card.title}"`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
