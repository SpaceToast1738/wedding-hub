import { z } from "zod";
import { db } from "@/lib/db";
import { supplierDeleteSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import {
  clipDisplay,
  DELETE_PROPOSED_MESSAGE,
  reasonFromRationale,
} from "./propose-delete-common";
import type { AiTool } from "./types";

// v2.8.0: destructive kind. Bridges to the supplier.delete apply
// handler (src/lib/ai/apply/deletes.ts) — a PERMANENT db delete that
// cascades the supplier's contacts, contracts and communications
// (payments and tasks survive with their supplier link cleared).
const inputSchema = z.object({
  supplierId: z
    .string()
    .min(1)
    .describe("The id of the supplier to delete — get this from a prior read_suppliers call."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this supplier should be permanently deleted. Shown to the couple.",
    ),
});

export const proposeSupplierDelete: AiTool<typeof inputSchema> = {
  name: "propose_supplier_delete",
  description:
    "Propose PERMANENTLY deleting a supplier. This is destructive: applying removes the supplier for good, cascading their contacts, contracts and logged communications (a JSON snapshot is kept on the proposal for manual recovery, but there is no undo button). Linked payments and tasks survive — they just lose the supplier link. For a supplier the couple decided against, propose_supplier_update with status REJECTED keeps the history and is almost always better — reserve deletion for genuinely wrong rows (duplicates, test entries). You MUST call read_suppliers first so you have a valid supplierId.",
  inputSchema,
  progressLabel: "Proposing supplier delete…",
  definition: {
    name: "propose_supplier_delete",
    description:
      "Propose permanently deleting a supplier (snapshot-backed, no undo; cascades contacts/contracts/communications, keeps payments+tasks). Prefer propose_supplier_update status REJECTED for rejected vendors. Requires supplierId from a prior read_suppliers call.",
    input_schema: {
      type: "object",
      properties: {
        supplierId: { type: "string", description: "From read_suppliers output." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this supplier should be deleted.",
        },
      },
      required: ["supplierId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const supplier = await db.supplier.findUnique({
      where: { id: input.supplierId },
      select: {
        name: true,
        category: true,
        status: true,
        _count: {
          select: {
            contacts: true,
            contracts: true,
            communications: true,
            payments: true,
            tasks: true,
          },
        },
      },
    });
    if (!supplier) {
      return { ok: false, error: unknownIdsError([`supplier:${input.supplierId}`]) };
    }

    const payloadResult = supplierDeleteSchema.safeParse({
      supplierId: input.supplierId,
      targetLabel: clipDisplay(supplier.name, 200),
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
        kind: "supplier.delete",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const c = supplier._count;
    const detailBits = [
      `${supplier.category} · ${supplier.status}`,
      "permanent — snapshot kept",
    ];
    if (c.contacts || c.contracts || c.communications) {
      detailBits.push(
        `deletes ${c.contacts} contact(s), ${c.contracts} contract(s), ${c.communications} communication(s)`,
      );
    }
    if (c.payments || c.tasks) {
      detailBits.push(`${c.payments} payment(s) + ${c.tasks} task(s) kept, unlinked`);
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "supplier.delete",
        title: `Delete "${supplier.name}"`,
        detail: detailBits.join(" · "),
        message: DELETE_PROPOSED_MESSAGE,
      },
    };
  },
};
