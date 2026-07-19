import { z } from "zod";
import { db } from "@/lib/db";
import { supplierContractUpdateSchema } from "@/lib/ai/proposals/schemas";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// Records a contract on a supplier — the signed flag, the date it was
// signed, free-text notes, and an optional link to an already-uploaded
// contract file. Deliberately carries NO amount: money stays off the AI
// write surface (read_suppliers only exposes a hasAmount flag), so the
// apply path always writes amount:null. The human contract form keeps
// its own amount field.
const inputSchema = z.object({
  supplierId: z
    .string()
    .min(1)
    .describe("The id of the supplier this contract belongs to — from read_suppliers."),
  signed: z
    .boolean()
    .optional()
    .describe("Whether the contract is signed. When true and no signedAt is given, today is used."),
  signedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .describe("The date the contract was signed (YYYY-MM-DD)."),
  notes: z.string().max(2000).optional().describe("Any contract detail to remember."),
  fileId: z
    .string()
    .optional()
    .describe("Optional id of an already-uploaded contract file (from read_files). Dropped if unknown."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this contract record should be added. Shown to the couple."),
});

export const proposeSupplierContractUpdate: AiTool<typeof inputSchema> = {
  name: "propose_supplier_contract_update",
  description:
    "Propose recording a contract on a supplier — the signed flag, the signed date, notes, and an optional link to an uploaded contract file. Writes a proposal — does NOT record the contract; the couple will Apply or Dismiss it. Contract AMOUNTS are never set through me (money stays couple-only on the budget/payments surfaces). You MUST call read_suppliers first so you have a valid supplierId.",
  inputSchema,
  progressLabel: "Proposing supplier contract…",
  definition: {
    name: "propose_supplier_contract_update",
    description:
      "Propose recording a contract on a supplier (signed flag, signed date, notes, optional file link). Writes a proposal — does not record it directly. No amount is ever set. Requires supplierId from read_suppliers.",
    input_schema: {
      type: "object",
      properties: {
        supplierId: { type: "string", description: "From read_suppliers output." },
        signed: {
          type: "boolean",
          description: "Whether the contract is signed. true + no signedAt ⇒ today.",
        },
        signedAt: {
          type: "string",
          description: "Date the contract was signed (YYYY-MM-DD).",
        },
        notes: { type: "string", description: "Any contract detail to remember." },
        fileId: {
          type: "string",
          description: "Optional id of an uploaded contract file (from read_files). Dropped if unknown.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why. Shown to the couple.",
        },
      },
      required: ["supplierId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const { invalid, names } = await resolveRefs({ supplierIds: [input.supplierId] });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    const payloadResult = supplierContractUpdateSchema.safeParse({
      supplierId: input.supplierId,
      signed: input.signed ?? false,
      signedAt: input.signedAt ?? null,
      notes: input.notes ?? null,
      fileId: input.fileId ?? null,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "supplier.contract_update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detailBits: string[] = [];
    if (input.signed) {
      detailBits.push(input.signedAt ? `signed ${input.signedAt}` : "signed (today)");
    } else {
      detailBits.push("unsigned");
    }
    if (input.fileId) detailBits.push("links a contract file");

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "supplier.contract_update",
        title: `Contract → ${names.suppliers.get(input.supplierId)}`,
        detail: detailBits.join(" · "),
        message: "Contract record proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
