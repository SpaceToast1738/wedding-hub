"use client";

// v1.22.0: per-supplier custom-field block. Mirrors the guest variant
// from C10/v1.15.0 — same UI from the shared block, different action.

import { CustomFieldsBlock as SharedBlock } from "@/components/ui/CustomFieldsBlock";
import { type CustomFieldDef } from "@/lib/custom-fields";
import { setSupplierCustomField } from "../actions";

type Props = {
  supplierId: string;
  fields: CustomFieldDef[];
  values: Record<string, string | number | null>;
  canEdit: boolean;
};

export function CustomFieldsBlock({ supplierId, fields, values, canEdit }: Props) {
  return (
    <SharedBlock
      fields={fields}
      values={values}
      canEdit={canEdit}
      onSave={(fieldId, rawValue) => setSupplierCustomField(supplierId, fieldId, rawValue)}
    />
  );
}
