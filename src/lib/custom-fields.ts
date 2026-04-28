// C10 (v1.15.0): pure helpers for the custom-field registry + per-entity
// value bag. The schema's `CustomField` table holds *definitions*
// (entity, name, type, options); each entity's `customFieldValues Json?`
// column holds the *values* keyed by CustomField.id.
//
// These helpers parse, validate, and format values for each supported
// type. Kept pure so unit tests can lock the contract without a DB.

export type CustomFieldType = "text" | "number" | "date" | "select";

export type CustomFieldDef = {
  id: string;
  entity: string;
  name: string;
  type: CustomFieldType;
  options: string[];
  order: number;
};

// The on-disk shape: a record keyed by CustomField.id.
export type CustomFieldValues = Record<string, string | number | null>;

// Parses a raw form-input string into the typed value the JSON column
// stores. Returns:
//   - the typed value when valid
//   - `null` when the input is empty (clear the field)
//   - throws `Error` when the input is invalid for the field's type.
// Validation here is intentionally strict — strict at write time means
// the read path can trust whatever's in the JSON column.
export function parseCustomFieldValue(
  def: CustomFieldDef,
  raw: string | null | undefined,
): string | number | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;

  switch (def.type) {
    case "text":
      // Hard length cap matches the existing Guest.notes 2000-char
      // ceiling — generous but bounded.
      if (trimmed.length > 2000) {
        throw new Error(`${def.name}: too long (max 2000 chars)`);
      }
      return trimmed;

    case "number": {
      const n = Number(trimmed.replace(/[, ]/g, ""));
      if (Number.isNaN(n) || !Number.isFinite(n)) {
        throw new Error(`${def.name}: must be a number`);
      }
      return n;
    }

    case "date": {
      // Accept either an ISO date (YYYY-MM-DD from <input type="date">)
      // or a full ISO timestamp. Normalise to YYYY-MM-DD for storage.
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) {
        throw new Error(`${def.name}: not a valid date`);
      }
      return d.toISOString().slice(0, 10);
    }

    case "select": {
      if (!def.options.includes(trimmed)) {
        throw new Error(`${def.name}: must be one of ${def.options.join(", ")}`);
      }
      return trimmed;
    }
  }
}

// Formats a stored value for display. Mirrors `parseCustomFieldValue`
// but inverse — handles the "no value" case with a sensible "—" so
// the UI doesn't render an awkward "null".
export function formatCustomFieldValue(
  def: CustomFieldDef,
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) return "—";
  switch (def.type) {
    case "number":
      // Formatted with a thousands separator. Wedding-scale numbers
      // (counts, simple amounts) read better that way.
      return typeof value === "number"
        ? value.toLocaleString("en-GB")
        : String(value);
    case "date":
      // Server stored as YYYY-MM-DD. Render as "1 Sep 2026" for UK readers.
      return new Date(String(value)).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    case "text":
    case "select":
      return String(value);
  }
}

// Merges a single field's value into the existing values map. Returns
// the new map (never mutates). Removing a value is `null` — the key
// is dropped so the JSON stays compact.
export function mergeCustomFieldValue(
  existing: CustomFieldValues | null | undefined,
  fieldId: string,
  value: string | number | null,
): CustomFieldValues {
  const next: CustomFieldValues = { ...(existing ?? {}) };
  if (value === null) delete next[fieldId];
  else next[fieldId] = value;
  return next;
}
