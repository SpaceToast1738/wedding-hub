// v2.4.0: pure merge logic for the book card child-row delta kinds.
//
// The trap this module defuses: every structured-card bulk save in
// src/app/(app)/book/actions.ts (saveRecipeCard, saveOutfitCard,
// saveBuildCard, saveMenuCard, saveBarCard, saveSetupCard,
// saveLodgingCard) REPLACES the card's child rows as a unit — any
// existing row id missing from the payload is hard-deleted
// (deleteMany), and ids starting "new-" create fresh rows. AI
// proposals only ever express DELTAS (add / update / removeIds), so
// the apply bridge loads the card's CURRENT children and reconstructs
// the complete array here. Rows the AI never named are re-emitted
// verbatim — every field, including costPence / fileIds / guestIds /
// flags, byte-identical — which is what keeps the money-parity
// invariant intact through the full-replace actions.
//
// Pure function — no db, no action imports. Unit-tested in
// tests/unit/merge-book-children.test.ts.

export type ChildRowDelta = {
  /** New rows, appended after the current ones. Any `id` the caller
   *  accidentally includes is discarded — ids are generated here with
   *  the "new-" prefix the save* actions use to discriminate creates. */
  add?: Record<string, unknown>[];
  /** Patches over existing rows. Only DEFINED fields apply — an
   *  omitted key keeps the current value; an explicit null clears it
   *  (matching the payload schemas' .optional().nullable() split). */
  update?: ({ id: string } & Record<string, unknown>)[];
  /** The ONLY way a row leaves the output. */
  removeIds?: string[];
};

/**
 * Reconstruct the complete child array a bulk-save action expects,
 * from the live rows + an AI delta.
 *
 * - Output preserves the current rows' order; adds are appended.
 * - An update/remove id that no longer exists in `current` THROWS —
 *   the card changed between propose and apply, and silently dropping
 *   the stale edit (or worse, guessing) would betray the review the
 *   human just approved. The caller surfaces the message and the
 *   proposal stays pending for a re-read + re-propose.
 * - `newIdPrefix` defaults to "new-" (verified against every save*
 *   action's `id.startsWith("new-")` reconcile). Overridable in case
 *   a future action picks a different sentinel.
 */
export function mergeChildren<C extends { id: string }>(
  current: C[],
  delta: ChildRowDelta,
  opts?: { newIdPrefix?: string },
): Record<string, unknown>[] {
  const prefix = opts?.newIdPrefix ?? "new-";
  const currentIds = new Set(current.map((row) => row.id));

  const staleId = (id: string): Error =>
    new Error(
      `Row ${id} no longer exists — the card changed since this was proposed; re-read and re-propose.`,
    );

  for (const id of delta.removeIds ?? []) {
    if (!currentIds.has(id)) throw staleId(id);
  }
  // Patches collected per id so a (weird but legal) double-update to
  // the same row applies in sequence, last write winning per field.
  const patchesById = new Map<string, Record<string, unknown>[]>();
  for (const patch of delta.update ?? []) {
    if (!currentIds.has(patch.id)) throw staleId(patch.id);
    const list = patchesById.get(patch.id) ?? [];
    list.push(patch);
    patchesById.set(patch.id, list);
  }

  const removed = new Set(delta.removeIds ?? []);
  const out: Record<string, unknown>[] = [];
  for (const row of current) {
    if (removed.has(row.id)) continue;
    const patches = patchesById.get(row.id);
    if (!patches) {
      // Untouched row: verbatim copy, every field carried through.
      out.push({ ...row });
      continue;
    }
    const merged: Record<string, unknown> = { ...row };
    for (const patch of patches) {
      for (const [key, value] of Object.entries(patch)) {
        if (key === "id") continue;
        if (value !== undefined) merged[key] = value;
      }
    }
    out.push(merged);
  }

  let addCounter = 0;
  for (const add of delta.add ?? []) {
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(add)) {
      if (key === "id") continue;
      if (value !== undefined) row[key] = value;
    }
    row.id = `${prefix}${addCounter}`;
    addCounter += 1;
    out.push(row);
  }
  return out;
}
