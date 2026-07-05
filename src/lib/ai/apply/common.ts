// v2.4.0: shared guards for the AI proposal apply layer.
//
// Apply bridges live in src/lib/ai/apply/* (one module per domain)
// and are called from applyLoadedProposal in
// src/app/(app)/ai/actions.ts. They throw on any failure so the
// caller's claim-rollback path fires and the proposal stays PENDING.

import { db } from "@/lib/db";

/** Some server actions signal failure with a result object instead of
 *  throwing ({ ok: false, error } — DeleteResult / BookActionResult
 *  convention). A bridge that ignores that shape would record the
 *  proposal APPLIED while nothing happened. Funnel every such call
 *  through this: it throws so rollbackClaim fires. */
export function ensureOk<T extends { ok: boolean; error?: string } | void | undefined>(
  result: T,
): void {
  if (result && typeof result === "object" && "ok" in result && !result.ok) {
    throw new Error(
      ("error" in result && result.error) || "The underlying action refused the change.",
    );
  }
}

/** Patch-else-current for scalar fields on full-record-replace
 *  actions. `undefined` in the patch = keep the current value;
 *  `null` = explicit clear; anything else = the new value.
 *  Returns the value to post — callers decide how to append it
 *  (skip nulls for `formData.get(x) || null` parsers). */
export function patchOrCurrent<T>(
  patchValue: T | null | undefined,
  currentValue: T | null,
): T | null {
  if (patchValue === undefined) return currentValue;
  return patchValue;
}

/** COUPLE_ONLY wall for every book bridge. The book server actions
 *  gate on requireEdit("book") but do NOT check per-card visibility —
 *  in the UI that's enforced by never rendering couple-only cards to
 *  non-couple users. The AI apply path must enforce it explicitly or
 *  a non-couple ai_write holder could modify cards they can't see. */
export async function assertBookCardWritable(
  user: { isCouple: boolean },
  subsectionId: string,
): Promise<void> {
  const card = await db.bookSubsection.findUnique({
    where: { id: subsectionId },
    select: {
      visibility: true,
      section: { select: { visibility: true } },
    },
  });
  if (!card) {
    throw new Error("Book card not found — it may have been deleted since the proposal was made.");
  }
  if (
    !user.isCouple &&
    (card.visibility === "COUPLE_ONLY" || card.section.visibility === "COUPLE_ONLY")
  ) {
    throw new Error("This card is couple-only — only the couple can apply changes to it.");
  }
}
