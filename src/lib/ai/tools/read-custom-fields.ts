// v2.8.1 (Tier 2, Slice B): lists the CustomField definitions so the
// model can resolve a fieldId before calling propose_custom_field_set.
// read_guests / read_tasks surface custom-field VALUES keyed by field
// NAME; this tool gives the id ⇄ name ⇄ type mapping the write path
// needs.
//
// No gate beyond reaching the registry (mirrors read_enhancements): a
// field definition is schema metadata — field name + type + select
// options — not wedding data or money.

import { z } from "zod";
import { db } from "@/lib/db";
import type { AiTool } from "./types";

const ENTITIES = ["guest", "supplier", "task"] as const;

const inputSchema = z.object({
  entity: z
    .enum(ENTITIES)
    .optional()
    .describe("Only fields for this entity. Omit for all entities."),
});

export const readCustomFields: AiTool<typeof inputSchema> = {
  name: "read_custom_fields",
  description:
    "List the custom field definitions (id, entity, name, type, and select options) configured in Settings. Custom-field VALUES appear on read_guests / read_tasks keyed by field name; use THIS tool to get the fieldId (and its type / allowed options) you need to call propose_custom_field_set. Filter by entity (guest | supplier | task) or omit for all.",
  inputSchema,
  progressLabel: "Reading custom fields…",
  definition: {
    name: "read_custom_fields",
    description:
      "List custom field definitions (id, entity, name, type, options) so you can resolve a fieldId for propose_custom_field_set. Optional entity filter: guest | supplier | task.",
    input_schema: {
      type: "object",
      properties: {
        entity: {
          type: "string",
          enum: [...ENTITIES],
          description: "Only fields for this entity.",
        },
      },
    },
  },
  async handler(input) {
    const rows = await db.customField.findMany({
      where: input.entity ? { entity: input.entity } : {},
      orderBy: [{ entity: "asc" }, { order: "asc" }],
      select: { id: true, entity: true, name: true, type: true, options: true },
    });

    return {
      ok: true,
      data: {
        count: rows.length,
        fields: rows.map((f) => ({
          id: f.id,
          entity: f.entity,
          name: f.name,
          type: f.type,
          // Only "select" fields carry options — omit the empty array
          // on the other types to keep the payload lean.
          ...(f.options.length ? { options: f.options } : {}),
        })),
      },
    };
  },
};
