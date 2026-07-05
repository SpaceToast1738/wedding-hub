import { z } from "zod";
import { db } from "@/lib/db";
import { customFieldSetSchema } from "@/lib/ai/proposals/schemas";
import {
  parseCustomFieldValue,
  type CustomFieldDef,
  type CustomFieldType,
} from "@/lib/custom-fields";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// `.trim().min(1)` matters: the underlying setters treat an
// empty-after-trim value as "delete the key" (mergeCustomFieldValue
// drops it), and clearing values is a human-only call by design.
const inputSchema = z.object({
  entity: z.enum(["guest", "task", "supplier"]),
  targetId: z
    .string()
    .min(1)
    .describe("The guest / task / supplier id the value goes on."),
  fieldId: z
    .string()
    .min(1)
    .describe("CustomField definition id — from the read tool that listed the fields."),
  value: z.string().trim().min(1).max(2000),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this value is right. Shown to the couple."),
});

export const proposeCustomFieldSet: AiTool<typeof inputSchema> = {
  name: "propose_custom_field_set",
  description:
    "Propose setting one custom-field value on a guest, task, or supplier. The value is validated against the field's type (select values must match an option; numbers must be numeric; dates must parse). Clearing a value is out of scope — humans do that in the UI. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing custom field…",
  definition: {
    name: "propose_custom_field_set",
    description:
      "Propose one custom-field value on a guest, task, or supplier. Value must match the field's type; select fields only accept their defined options.",
    input_schema: {
      type: "object",
      properties: {
        entity: {
          type: "string",
          enum: ["guest", "task", "supplier"],
          description: "Which kind of row the field belongs to.",
        },
        targetId: { type: "string", description: "Id of the guest / task / supplier." },
        fieldId: { type: "string", description: "CustomField definition id." },
        value: { type: "string", description: "The value to set, as text." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this value is right.",
        },
      },
      required: ["entity", "targetId", "fieldId", "value", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const def = await db.customField.findUnique({ where: { id: input.fieldId } });
    if (!def) {
      return { ok: false, error: unknownIdsError([`customField:${input.fieldId}`]) };
    }
    if (def.entity !== input.entity) {
      return {
        ok: false,
        error: `Field "${def.name}" belongs to ${def.entity} rows, not ${input.entity}.`,
      };
    }

    // Same strict parser the apply-time setters use — select-option
    // membership, numeric, and date checks all fail here instead of
    // surfacing as an Apply error days later.
    const typedDef: CustomFieldDef = {
      id: def.id,
      entity: def.entity,
      name: def.name,
      type: def.type as CustomFieldType,
      options: def.options,
      order: def.order,
    };
    try {
      parseCustomFieldValue(typedDef, input.value);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Invalid value for this field.",
      };
    }

    let targetName: string;
    if (input.entity === "guest") {
      const guest = await db.guest.findUnique({
        where: { id: input.targetId },
        select: { firstName: true, lastName: true, archived: true },
      });
      if (!guest) {
        return { ok: false, error: unknownIdsError([`guest:${input.targetId}`]) };
      }
      if (guest.archived) {
        return {
          ok: false,
          error: "That guest is archived — the couple would need to restore them first.",
        };
      }
      targetName = `${guest.firstName} ${guest.lastName}`.trim();
    } else if (input.entity === "task") {
      const task = await db.task.findUnique({
        where: { id: input.targetId },
        select: { title: true },
      });
      if (!task) {
        return { ok: false, error: unknownIdsError([`task:${input.targetId}`]) };
      }
      targetName = task.title;
    } else {
      const supplier = await db.supplier.findUnique({
        where: { id: input.targetId },
        select: { name: true },
      });
      if (!supplier) {
        return { ok: false, error: unknownIdsError([`supplier:${input.targetId}`]) };
      }
      targetName = supplier.name;
    }

    const payloadResult = customFieldSetSchema.safeParse({
      entity: input.entity,
      targetId: input.targetId,
      fieldId: input.fieldId,
      value: input.value,
      // Display-only: the verified field name, so the review card says
      // which field this lands in.
      fieldName: def.name,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "custom_field.set",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const clipped =
      input.value.length > 60 ? `${input.value.slice(0, 60)}…` : input.value;

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "custom_field.set",
        title: `Set "${def.name}" on ${targetName}`,
        detail: `${def.name} → ${clipped}`,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
