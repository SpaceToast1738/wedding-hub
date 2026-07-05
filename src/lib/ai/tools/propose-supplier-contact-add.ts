import { z } from "zod";
import { db } from "@/lib/db";
import { supplierContactAddSchema } from "@/lib/ai/proposals/schemas";
import { resolveRefs, unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// v2.4.3: closes a gap the planner itself reported to the couple —
// "the app doesn't currently support adding a primary contact
// through me". Contacts are the person-level rows on a supplier
// (name/role/email/phone/primary), distinct from communications.
const inputSchema = z.object({
  supplierId: z
    .string()
    .min(1)
    .describe("The id of the supplier this person belongs to — from read_suppliers."),
  name: z.string().min(1).max(200),
  role: z.string().max(100).optional(),
  email: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  primary: z
    .boolean()
    .optional()
    .describe("Marks this person as the primary contact — unmarks any existing one."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining why this contact should be added. Shown to the couple."),
});

export const proposeSupplierContactAdd: AiTool<typeof inputSchema> = {
  name: "propose_supplier_contact_add",
  description:
    "Propose adding a named contact person (name, role, email, phone) to a supplier — e.g. when the user tells you who their rep is. Writes a proposal — does NOT add the contact; the couple will Apply or Dismiss it. Setting primary:true also unmarks the current primary contact when applied. You MUST call read_suppliers first so you have a valid supplierId.",
  inputSchema,
  progressLabel: "Proposing supplier contact…",
  definition: {
    name: "propose_supplier_contact_add",
    description:
      "Propose adding a contact person to a supplier (name/role/email/phone, optional primary flag). Writes a proposal — does not add the contact directly. Requires supplierId from read_suppliers.",
    input_schema: {
      type: "object",
      properties: {
        supplierId: { type: "string", description: "From read_suppliers output." },
        name: { type: "string", description: "The person's name, e.g. 'Louis Brough'." },
        role: { type: "string", description: "e.g. 'Lead photographer', 'Sales manager'." },
        email: { type: "string" },
        phone: { type: "string" },
        primary: {
          type: "boolean",
          description:
            "Mark as THE primary contact. Applying this unmarks any existing primary contact.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why. Shown to the couple.",
        },
      },
      required: ["supplierId", "name", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const { invalid, names } = await resolveRefs({ supplierIds: [input.supplierId] });
    if (invalid.length) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    // Duplicate fence: same name on the same supplier is almost
    // certainly a re-propose (contacts have no unique constraint).
    const existing = await db.supplierContact.findFirst({
      where: {
        supplierId: input.supplierId,
        name: { equals: input.name.trim(), mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) {
      return {
        ok: false,
        error: `"${input.name}" is already a contact on ${names.suppliers.get(input.supplierId)}. Use the supplier page to edit their details.`,
      };
    }

    const payloadResult = supplierContactAddSchema.safeParse({
      supplierId: input.supplierId,
      name: input.name.trim(),
      role: input.role ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      primary: input.primary ?? false,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "supplier.contact.add",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "supplier.contact.add",
        title: `${input.name} → ${names.suppliers.get(input.supplierId)}`,
        detail: input.primary ? "primary contact (replaces the current one)" : undefined,
        message: "Contact proposed. The couple will Apply or Dismiss it.",
      },
    };
  },
};
