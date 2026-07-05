import { z } from "zod";
import { db } from "@/lib/db";
import { householdUpdateSchema, SIDES } from "@/lib/ai/proposals/schemas";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// Membership is out of scope: no server action moves a guest between
// households, and deleteHousehold cascade-hard-deletes every member —
// both stay human-only. This tool only touches the household's own
// name / side / notes.
const inputSchema = z.object({
  householdId: z
    .string()
    .min(1)
    .describe("The id of the household to update — get this from a prior read_guests call."),
  name: z.string().min(1).max(200).optional(),
  side: z.enum(SIDES).optional(),
  notes: z.string().max(2000).optional().nullable(),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this update makes sense. Shown to the couple."),
});

export const proposeHouseholdUpdate: AiTool<typeof inputSchema> = {
  name: "propose_household_update",
  description:
    "Propose an update to a household's name, side, or notes. Only include what you want changed; null clears notes. Moving guests between households is human-only — this never changes who belongs to the household. Requires a valid householdId.",
  inputSchema,
  progressLabel: "Proposing household update…",
  definition: {
    name: "propose_household_update",
    description:
      "Propose a partial update to a household (name, side, notes). Only include fields you want changed. Membership cannot be changed here.",
    input_schema: {
      type: "object",
      properties: {
        householdId: { type: "string", description: "From read_guests output." },
        name: { type: "string" },
        side: { type: "string", enum: [...SIDES] },
        notes: { type: ["string", "null"], description: "Pass null to clear." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this update makes sense.",
        },
      },
      required: ["householdId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const { invalid, names } = await resolveRefs({ householdIds: [input.householdId] });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    const patch: Record<string, unknown> = { householdId: input.householdId };
    if (input.name !== undefined) patch.name = input.name;
    if (input.side !== undefined) patch.side = input.side;
    if (input.notes !== undefined) patch.notes = input.notes;

    if (Object.keys(patch).length === 1) {
      return {
        ok: false,
        error:
          "The update contains no changes. Include at least one field to change (name, side, or notes).",
      };
    }

    const payloadResult = householdUpdateSchema.safeParse(patch);
    if (!payloadResult.success) {
      return {
        ok: false,
        error: `Payload validation failed: ${payloadResult.error.message}`,
      };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "household.update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const touched = Object.keys(patch).filter((k) => k !== "householdId");

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "household.update",
        title: `Update "${names.households.get(input.householdId)}" household`,
        detail: `sets ${touched.join(", ")}`,
        message: "Update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
