import { z } from "zod";
import { db } from "@/lib/db";
import { supplierContactRemoveSchema } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import {
  clipDisplay,
  DELETE_PROPOSED_MESSAGE,
  reasonFromRationale,
} from "./propose-delete-common";
import type { AiTool } from "./types";

// v2.8.0: destructive kind. Bridges to the supplier.contact_remove
// apply handler (src/lib/ai/apply/deletes.ts) — a PERMANENT delete of
// one contact-person row; the supplier itself is untouched.
const inputSchema = z.object({
  contactId: z
    .string()
    .min(1)
    .describe(
      "The id of the contact to remove — from a prior read_suppliers call (contacts are listed under each supplier).",
    ),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this contact should be removed. Shown to the couple.",
    ),
});

export const proposeSupplierContactRemove: AiTool<typeof inputSchema> = {
  name: "propose_supplier_contact_remove",
  description:
    "Propose PERMANENTLY removing a named contact person from a supplier (the supplier itself is untouched). This is destructive: applying deletes the contact row for good (a JSON snapshot is kept on the proposal for manual recovery). For a contact whose details merely changed, there is no contact-update kind yet — but removing and re-adding loses nothing except the row id, so pair this with propose_supplier_contact_add when replacing someone. Requires a contactId from read_suppliers.",
  inputSchema,
  progressLabel: "Proposing contact removal…",
  definition: {
    name: "propose_supplier_contact_remove",
    description:
      "Propose permanently removing a supplier contact person (snapshot-backed, no undo; the supplier survives). Requires contactId from a prior read_suppliers call.",
    input_schema: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "From read_suppliers output." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this contact should be removed.",
        },
      },
      required: ["contactId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const contact = await db.supplierContact.findUnique({
      where: { id: input.contactId },
      select: {
        name: true,
        role: true,
        primary: true,
        supplier: { select: { name: true } },
      },
    });
    if (!contact) {
      // No supplierContact family in resolveRefs — same prefix style,
      // hand-rolled.
      return {
        ok: false,
        error: `Unknown ids: supplierContact:${input.contactId}. Use ids from a read tool — never invent ids.`,
      };
    }

    const payloadResult = supplierContactRemoveSchema.safeParse({
      contactId: input.contactId,
      targetLabel: clipDisplay(`${contact.name} (${contact.supplier.name})`, 200),
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
        kind: "supplier.contact_remove",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detailBits = [`contact of ${contact.supplier.name}`, "permanent — snapshot kept"];
    if (contact.role) detailBits.unshift(contact.role);
    if (contact.primary) {
      detailBits.push("this is the PRIMARY contact — the supplier is left without one");
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "supplier.contact_remove",
        title: `Remove contact "${contact.name}"`,
        detail: detailBits.join(" · "),
        message: DELETE_PROPOSED_MESSAGE,
      },
    };
  },
};
