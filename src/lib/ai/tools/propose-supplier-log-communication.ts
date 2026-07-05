import { z } from "zod";
import { supplierCommunicationSchema } from "@/lib/ai/proposals/schemas";
import { db } from "@/lib/db";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import type { AiTool } from "./types";

const inputSchema = z.object({
  supplierId: z
    .string()
    .min(1)
    .describe("The id of the supplier this contact is with — get this from a prior read_suppliers call."),
  channel: z.enum(["email", "call", "meeting", "message"]),
  summary: z.string().min(1).max(2000),
  followUpAt: z
    .string()
    .optional()
    .describe(
      "ISO date (YYYY-MM-DD). Setting this auto-creates a follow-up Task on Apply, same as the manual form.",
    ),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining why this communication is worth logging. Shown to the couple."),
});

export const proposeSupplierLogCommunication: AiTool<typeof inputSchema> = {
  name: "propose_supplier_log_communication",
  description:
    "Propose logging a call/email/meeting/message with a supplier — e.g. from something the user just told you happened. Setting followUpAt auto-creates a follow-up Task when Applied, exactly like the manual 'Log communication' form. You MUST call read_suppliers first so you have a valid supplierId.",
  inputSchema,
  progressLabel: "Proposing communication log…",
  definition: {
    name: "propose_supplier_log_communication",
    description:
      "Propose logging a communication with a supplier (email/call/meeting/message). Optional followUpAt auto-creates a follow-up task on Apply. Requires supplierId from read_suppliers.",
    input_schema: {
      type: "object",
      properties: {
        supplierId: { type: "string", description: "From read_suppliers output." },
        channel: { type: "string", enum: ["email", "call", "meeting", "message"] },
        summary: { type: "string", description: "What was discussed / agreed." },
        followUpAt: {
          type: "string",
          description: "ISO date (YYYY-MM-DD). Optional — auto-creates a follow-up task when set.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this is worth logging.",
        },
      },
      required: ["supplierId", "channel", "summary", "rationale"],
    },
  },
  async handler(input, ctx) {
    if (!ctx.canWrite) {
      return {
        ok: false,
        error: "You don't have permission to write proposals. Ask the couple for ai_write access.",
      };
    }

    const { invalid, names } = await resolveRefs({ supplierIds: [input.supplierId] });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    const payloadResult = supplierCommunicationSchema.safeParse({
      supplierId: input.supplierId,
      channel: input.channel,
      summary: input.summary,
      followUpAt: input.followUpAt ?? null,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "supplier.log_communication",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "supplier.log_communication",
        title: `${input.channel} with ${names.suppliers.get(input.supplierId)}`,
        detail: input.followUpAt ? `follow-up ${input.followUpAt}` : undefined,
        message: "Communication log proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
