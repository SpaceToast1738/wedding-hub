"use client";

// v1.22.0: thin wrapper around the shared CustomFieldsBlock that
// pre-binds the guest server action. Pre-v1.22.0 this was the only
// implementation; now Supplier and Task have their own wrappers
// pointing at the same shared block.

import { CustomFieldsBlock as SharedBlock } from "@/components/ui/CustomFieldsBlock";
import { type CustomFieldDef } from "@/lib/custom-fields";
import { setGuestCustomField } from "../actions";

type Props = {
  guestId: string;
  fields: CustomFieldDef[];
  values: Record<string, string | number | null>;
  canEdit: boolean;
};

export function CustomFieldsBlock({ guestId, fields, values, canEdit }: Props) {
  return (
    <SharedBlock
      fields={fields}
      values={values}
      canEdit={canEdit}
      onSave={(fieldId, rawValue) => setGuestCustomField(guestId, fieldId, rawValue)}
    />
  );
}
