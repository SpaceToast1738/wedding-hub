// v2.8.0: shared bits for the 12 propose_*_delete tools.
//
// Every delete tool stamps the same two display-only payload fields
// (targetLabel + reason — see the destructive-kinds section of
// src/lib/ai/proposals/schemas.ts) and closes with the same message,
// so the clipping rules and wording live here once.

/** Clip a display string to a schema cap. The payload schemas cap
 *  targetLabel at 200 and reason at 300 — a source string over the
 *  cap (a long task title, a 500-char rationale) must still produce
 *  a valid payload, so clip with an ellipsis instead of failing. */
export function clipDisplay(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** The rationale doubles as the payload's display-only `reason` so
 *  summariseProposal can say WHY next to the "permanent" warning
 *  everywhere summaries render (review card, read_proposals). */
export function reasonFromRationale(rationale: string): string {
  return clipDisplay(rationale, 300);
}

/** Closing line of every delete tool result — mirrors the propose
 *  tools' "The couple will Apply or Dismiss it." convention but keeps
 *  the destructive stakes in the model's face. */
export const DELETE_PROPOSED_MESSAGE =
  "Delete proposed — NOT yet applied. Applying is permanent (a recovery snapshot is kept on the proposal).";
