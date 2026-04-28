// C4 (v1.14.0): per-field manual-edit tracking.
//
// `Guest.lastEditedFields` is a `{ "fieldName": "<ISO timestamp>" }`
// JSON map. The `updateGuest` action calls `mergeEditedFields` to
// merge in timestamps for fields that actually changed. The CSV import
// preview reads it to warn "you edited dietary 3 weeks ago — overwrite?"
// before re-importing data that would clobber a recent manual edit.
//
// Pure functions so unit tests can cover the matrix without a DB.

export type EditedFieldsMap = Record<string, string>;

// Returns a list of field names that differ between `previous` and `next`.
// Both objects must have the same keys (we don't try to detect missing
// keys — Prisma's update payload is partial; we just diff what's present).
// Arrays compare by sorted-stringified equality (order-insensitive — a
// re-ordered tag list isn't a "real" edit).
export function diffEditedFields<T extends Record<string, unknown>>(
  previous: T,
  next: Partial<T>,
): string[] {
  const changed: string[] = [];
  for (const key of Object.keys(next) as Array<keyof T>) {
    const oldValue = previous[key];
    const newValue = next[key];
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      const a = [...oldValue].sort().join("|");
      const b = [...newValue].sort().join("|");
      if (a !== b) changed.push(String(key));
      continue;
    }
    if (oldValue !== newValue) {
      // Treat null/undefined/empty-string as equivalent so a switch
      // between "" and null isn't recorded as an edit.
      const oldEmpty = oldValue === null || oldValue === undefined || oldValue === "";
      const newEmpty = newValue === null || newValue === undefined || newValue === "";
      if (oldEmpty && newEmpty) continue;
      changed.push(String(key));
    }
  }
  return changed;
}

// Stamps the given fields in the existing map with `now`. Existing
// timestamps for unchanged fields are preserved.
export function mergeEditedFields(
  existing: EditedFieldsMap | null | undefined,
  changedFields: readonly string[],
  now: Date = new Date(),
): EditedFieldsMap {
  const next: EditedFieldsMap = { ...(existing ?? {}) };
  const stamp = now.toISOString();
  for (const f of changedFields) next[f] = stamp;
  return next;
}

// Helper: how long ago (in days, rounded) was a field last manually
// edited? Returns null if never edited (or no map). Used by the import
// preview to format the warning.
export function daysSinceEdited(
  edited: EditedFieldsMap | null | undefined,
  field: string,
  now: Date = new Date(),
): number | null {
  const stamp = edited?.[field];
  if (!stamp) return null;
  const ts = Date.parse(stamp);
  if (Number.isNaN(ts)) return null;
  const diffMs = now.getTime() - ts;
  return Math.max(0, Math.round(diffMs / 86_400_000));
}
