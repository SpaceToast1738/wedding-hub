import { z } from "zod";
import { db } from "@/lib/db";
import { supplierContactUpdateSchema } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// v2.9.0: closes the gap propose_supplier_contact_remove used to
// apologise for ("there is no contact-update kind yet — remove and
// re-add"). Patches one contact-person row in place: name, role,
// email, phone, primary flag. Deltas only — omitted fields keep their
// current value; null clears role/email/phone.
const inputSchema = z
  .object({
    contactId: z
      .string()
      .min(1)
      .describe(
        "The id of the contact to update — from read_suppliers output (contacts are listed under each supplier).",
      ),
    name: z.string().min(1).max(200).optional(),
    role: z.string().max(100).optional().nullable(),
    email: z.string().max(200).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    primary: z
      .boolean()
      .optional()
      .describe(
        "true makes this THE primary contact (unmarks any existing one); false unmarks it — the supplier may be left without a primary.",
      ),
    rationale: z
      .string()
      .min(1)
      .max(500)
      .describe(
        "One or two sentences explaining why this contact should change. Shown to the couple.",
      ),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.role !== undefined ||
      v.email !== undefined ||
      v.phone !== undefined ||
      v.primary !== undefined,
    { message: "Nothing to change — set at least one of name/role/email/phone/primary." },
  );

export const proposeSupplierContactUpdate: AiTool<typeof inputSchema> = {
  name: "propose_supplier_contact_update",
  description:
    "Propose updating an existing supplier contact person's name, role, email, phone or primary flag — e.g. when a rep's number changed or someone new took over. Writes a proposal — does NOT change the contact; the couple will Apply or Dismiss it. Only send the fields that change (null clears role/email/phone); primary:true replaces the current primary contact when applied. You MUST call read_suppliers first so the contactId comes from live data.",
  inputSchema,
  progressLabel: "Proposing contact update…",
  definition: {
    name: "propose_supplier_contact_update",
    description:
      "Propose patching a supplier contact person (name/role/email/phone/primary) by contactId from read_suppliers. Writes a proposal — does not change the contact directly. Omit fields to keep them; null clears role/email/phone.",
    input_schema: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "From read_suppliers output (contacts array)." },
        name: { type: "string", description: "New name for the person." },
        role: {
          type: ["string", "null"],
          description: "New role, e.g. 'Lead photographer'. null clears it.",
        },
        email: { type: ["string", "null"], description: "New email. null clears it." },
        phone: { type: ["string", "null"], description: "New phone. null clears it." },
        primary: {
          type: "boolean",
          description:
            "true makes this the primary contact (replaces the current one); false unmarks it.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why. Shown to the couple.",
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
      // No supplierContact family in resolveRefs — same prefix style
      // as propose_supplier_contact_remove, hand-rolled.
      return {
        ok: false,
        error: `Unknown ids: supplierContact:${input.contactId}. Use ids from a read tool — never invent ids.`,
      };
    }

    const payloadResult = supplierContactUpdateSchema.safeParse({
      contactId: input.contactId,
      name: input.name,
      role: input.role,
      email: input.email,
      phone: input.phone,
      primary: input.primary,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "supplier.contact.update",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detailBits: string[] = [`contact of ${contact.supplier.name}`];
    if (input.primary === true && !contact.primary) {
      detailBits.push("becomes PRIMARY (replaces the current primary contact)");
    }
    if (input.primary === false && contact.primary) {
      detailBits.push("unmarks primary — the supplier is left without one");
    }

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "supplier.contact.update",
        title: `Update contact "${contact.name}"`,
        detail: detailBits.join(" · "),
        message: "Contact update proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
